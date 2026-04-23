import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import {
  markSinergiaDonationReceiptSent,
  recordSinergiaDonation,
} from "@/lib/community";
import { buildSinergiaDonationReceiptEmailHtml } from "@/lib/sinergia-email";

// MercadoPago webhook target for Sinergia donation payments. Shares
// MP_ACCESS_TOKEN and MP_WEBHOOK_SECRET with BROTE — the notification_url
// registered in the MP dashboard is what routes payments here vs. there.

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not set

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) {
    console.warn("Sinergia webhook missing signature headers:", {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
    });
    return false;
  }

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v.trim()];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  let dataId: string;
  try {
    const parsed = JSON.parse(body);
    dataId = String(parsed.data?.id ?? "");
  } catch {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  if (hash !== expected) {
    console.warn("Sinergia webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }

  return true;
}

interface CheckoutStash {
  rsvpId: string;
  sessionDate: string;
  name: string;
  email: string;
  amountCents: number;
}

export async function POST(req: Request) {
  const body = await req.text();

  if (!verifySignature(req, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: { type?: string; data?: { id?: string } };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (parsed.type !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const mpPaymentId = String(parsed.data?.id ?? "");
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();
  const idempotencyKey = `sinergia:payment:${mpPaymentId}`;
  const existingRsvpId = await redis.get(idempotencyKey);

  let rsvpId: string;
  let buyerName = "";
  let buyerEmail = "";
  let sessionDate = "";
  let amountCents = 0;
  let currency = "ARS";
  let receiptAlreadySent = false;

  if (existingRsvpId) {
    // Retry path: the payment was already applied. Load the participation
    // to decide whether the receipt email still needs to go out (webhook
    // can fire before the mark-sent UPDATE lands, or email delivery can
    // fail on the first try).
    rsvpId = existingRsvpId;
    const existing = await db
      .select({
        id: schema.participations.id,
        metadata: schema.participations.metadata,
        priceCents: schema.participations.priceCents,
        currency: schema.participations.currency,
        email: schema.people.email,
        name: schema.people.name,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.id, rsvpId))
      .limit(1);

    if (existing.length === 0) {
      console.warn("Orphaned Sinergia idempotency key:", {
        mpPaymentId,
        rsvpId,
      });
      return NextResponse.json({ ok: true, rsvpId });
    }

    const row = existing[0];
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    const donation =
      meta.donation && typeof meta.donation === "object"
        ? (meta.donation as Record<string, unknown>)
        : {};

    receiptAlreadySent = Boolean(donation.receiptSent);
    if (receiptAlreadySent) {
      return NextResponse.json({ ok: true, rsvpId });
    }

    buyerName = row.name ?? "Asistente";
    buyerEmail = row.email ?? "";
    amountCents = Number(row.priceCents ?? 0);
    currency = row.currency ?? "ARS";

    // Recover sessionDate from checkout stash if still present; the
    // template reads fine without it (falls back to "miércoles"), but
    // we prefer the actual date when we have it.
    const preferenceId = await loadPreferenceId(mpPaymentId);
    if (preferenceId) {
      const stash = await loadCheckoutStash(redis, preferenceId);
      if (stash) sessionDate = stash.sessionDate;
    }
  } else {
    // Fresh payment — fetch from MP and apply.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payment: any;
    try {
      payment = await new Payment(getMp()).get({ id: mpPaymentId });
    } catch (err) {
      console.error("Sinergia MP payment fetch failed:", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // external_reference is the RSVP id. Preference metadata carries it
    // as a backup in case MP drops external_reference on some payment
    // sources (it shouldn't, but defensive).
    const fromExternal =
      typeof payment.external_reference === "string"
        ? payment.external_reference
        : "";
    const fromMetadata =
      typeof payment.metadata?.rsvp_id === "string"
        ? payment.metadata.rsvp_id
        : "";
    rsvpId = fromExternal || fromMetadata;

    if (!rsvpId) {
      console.error("Sinergia webhook: no rsvpId on payment", mpPaymentId);
      return NextResponse.json({ error: "Missing rsvpId" }, { status: 200 });
    }

    amountCents = Math.round(Number(payment.transaction_amount ?? 0) * 100);
    currency = payment.currency_id ?? "ARS";

    const applyResult = await recordSinergiaDonation({
      participationId: rsvpId,
      amountCents,
      currency,
      paymentId: mpPaymentId,
    });
    receiptAlreadySent = applyResult.receiptAlreadySent;

    await redis.set(idempotencyKey, rsvpId);

    // Pull buyer info from checkout stash first (authoritative — matches
    // what the user typed on the form). Fall back to MP payer fields.
    const preferenceId = payment.preference_id as string | undefined;
    if (preferenceId) {
      const stash = await loadCheckoutStash(redis, preferenceId);
      if (stash) {
        buyerName = stash.name;
        buyerEmail = stash.email;
        sessionDate = stash.sessionDate;
      }
    }
    if (!buyerEmail) {
      buyerEmail = payment.payer?.email ?? "";
    }
    if (!buyerName) {
      buyerName =
        [payment.payer?.first_name, payment.payer?.last_name]
          .filter(Boolean)
          .join(" ") || "Asistente";
    }
  }

  // Send the receipt email. Idempotent via markSinergiaDonationReceiptSent.
  if (!receiptAlreadySent && buyerEmail) {
    try {
      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
      await getResend().emails.send({
        from: `Sinergia <${fromEmail}>`,
        to: buyerEmail,
        subject: "Gracias por tu aporte — Sinergia",
        html: buildSinergiaDonationReceiptEmailHtml({
          name: buyerName,
          amountCents,
          currency,
          sessionDate,
          paymentId: mpPaymentId,
        }),
      });

      await markSinergiaDonationReceiptSent(rsvpId);
    } catch (err) {
      console.error("Sinergia donation receipt email failed:", rsvpId, err);
      // Don't fail the webhook — MP retries, and the mark-sent call only
      // runs after a successful send, so the next webhook fires the email.
    }
  }

  return NextResponse.json({ ok: true, rsvpId });
}

async function loadCheckoutStash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redis: any,
  preferenceId: string,
): Promise<CheckoutStash | null> {
  try {
    const raw = await redis.get(`sinergia:checkout:${preferenceId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutStash;
  } catch (err) {
    console.error("Sinergia checkout stash parse failed:", err);
    return null;
  }
}

// Best-effort recovery of preference_id on the retry path, where the
// signature-only webhook body doesn't carry it. Returns null if MP is
// unreachable — the receipt email still sends, just without the
// sessionDate line.
async function loadPreferenceId(mpPaymentId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment: any = await new Payment(getMp()).get({ id: mpPaymentId });
    return (payment.preference_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}
