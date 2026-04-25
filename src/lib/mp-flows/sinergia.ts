import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Payment } from "mercadopago";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import {
  markSinergiaDonationReceiptSent,
  recordSinergiaDonation,
} from "@/lib/community";
import { buildSinergiaDonationReceiptEmailHtml } from "@/lib/sinergia-email";
import { getMpClient } from "@/lib/mp-webhook";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

interface CheckoutStash {
  rsvpId: string;
  sessionDate: string;
  name: string;
  email: string;
  amountCents: number;
}

export async function handleSinergiaPayment(args: {
  mpPaymentId: string;
}): Promise<NextResponse> {
  const { mpPaymentId } = args;

  const redis = await getRedis();
  const idempotencyKey = `sinergia:payment:${mpPaymentId}`;
  const PROCESSING = "__processing__";

  // Atomic claim: if the key is absent, we write the sentinel and get
  // "OK" back; if it already exists, we get null. Prevents a race where
  // two concurrent webhook deliveries both read "no existing rsvpId"
  // and race through the fresh-payment path, double-applying the
  // donation and double-sending the receipt.
  const claimed = await redis.set(idempotencyKey, PROCESSING, {
    NX: true,
    EX: 300,
  });

  let existingRsvpId: string | null = null;
  if (!claimed) {
    const val = await redis.get(idempotencyKey);
    if (!val || val === PROCESSING) {
      // Another invocation is mid-processing. Bail out with 200 so MP
      // doesn't mark this delivery as failed; the in-flight handler
      // will persist the final rsvpId shortly.
      return NextResponse.json({ ok: true, status: "processing" });
    }
    existingRsvpId = val;
  }

  let rsvpId: string;
  let buyerName = "";
  let buyerEmail = "";
  let sessionDate = "";
  let amountCents = 0;
  let currency = "ARS";
  let receiptAlreadySent = false;

  if (existingRsvpId) {
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

    const preferenceId = await loadPreferenceId(mpPaymentId);
    if (preferenceId) {
      const stash = await loadCheckoutStash(redis, preferenceId);
      if (stash) sessionDate = stash.sessionDate;
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payment: any;
    try {
      payment = await new Payment(getMpClient()).get({ id: mpPaymentId });
    } catch (err) {
      console.error("Sinergia MP payment fetch failed:", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

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

    // Overwrite the processing sentinel with the real rsvpId. 90d TTL
    // covers MP's retry horizon while keeping the key pool bounded.
    await redis.set(idempotencyKey, rsvpId, { EX: 60 * 60 * 24 * 90 });

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

async function loadPreferenceId(mpPaymentId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment: any = await new Payment(getMpClient()).get({
      id: mpPaymentId,
    });
    return (payment.preference_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}
