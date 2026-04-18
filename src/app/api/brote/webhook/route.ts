import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import { recordParticipation } from "@/lib/community";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";
import { sendMetaEvent } from "@/lib/meta-capi";
import type { BroteTicket } from "@/lib/brote-types";

const BROTE_EVENT_ID = "brote-2026-03-28";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not set

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) {
    console.warn("Webhook missing signature headers:", {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
      headers: Object.fromEntries(
        [...new Headers(req.headers)].filter(([k]) => !k.includes("auth")),
      ),
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
    console.warn("Webhook signature mismatch:", { dataId, xRequestId, ts, manifest });
    return false;
  }

  return true;
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

  const mpPaymentId = String(parsed.data?.id);
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();

  // Idempotency: Redis maps MP payment id → ticket id. Fast path for retries.
  const existingTicketId = await redis.get(`brote:payment:${mpPaymentId}`);

  let ticketId: string;
  let buyerEmail: string;
  let buyerName: string;
  let participationMetadata: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  if (existingTicketId) {
    // Participation already exists. Load it to decide whether to retry email.
    const existing = await db
      .select({
        id: schema.participations.id,
        metadata: schema.participations.metadata,
        email: schema.people.email,
        name: schema.people.name,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.id, existingTicketId))
      .limit(1);

    if (existing.length === 0) {
      // Redis mapping exists but DB row doesn't — orphaned state.
      // Log and treat as success to avoid a webhook retry loop.
      console.warn("Orphaned MP idempotency key:", {
        mpPaymentId,
        existingTicketId,
      });
      return NextResponse.json({ ok: true, ticketId: existingTicketId });
    }

    const row = existing[0];
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    if (meta.emailSent) {
      return NextResponse.json({ ok: true, ticketId: row.id });
    }

    // Email wasn't sent — fall through to retry it.
    console.log("Retrying email for existing ticket:", row.id);
    ticketId = row.id;
    buyerEmail = row.email ?? "";
    buyerName = row.name ?? "Asistente";
    participationMetadata = meta;
  } else {
    // New payment — fetch from MP and create participation.
    try {
      payment = await new Payment(mp).get({ id: mpPaymentId });
    } catch (err) {
      console.error("MP payment fetch failed:", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    buyerEmail = payment.payer?.email || "";
    buyerName =
      [payment.payer?.first_name, payment.payer?.last_name]
        .filter(Boolean)
        .join(" ") || "Asistente";

    console.log("Webhook processing:", {
      mpPaymentId,
      status: payment.status,
      buyerEmail,
      buyerName,
    });

    ticketId = `BROTE-${nanoid(8).toUpperCase()}`;

    // Recover Meta CAPI attribution data from checkout stash (24h TTL).
    const preferenceId = payment.preference_id as string | undefined;
    let attribution: Record<string, string> | undefined;
    if (preferenceId) {
      const raw = await redis.get(`brote:checkout:${preferenceId}`);
      if (raw) {
        try {
          const meta = JSON.parse(raw);
          if (meta.source || meta.medium || meta.campaign || meta.linkSlug) {
            attribution = {
              ...(meta.source && { source: meta.source }),
              ...(meta.medium && { medium: meta.medium }),
              ...(meta.campaign && { campaign: meta.campaign }),
              ...(meta.linkSlug && { linkSlug: meta.linkSlug }),
              capturedAt: new Date().toISOString(),
            };
          }
        } catch {
          /* ignore malformed stash */
        }
      }
    }

    await recordParticipation({
      email: buyerEmail,
      name: buyerName,
      eventId: BROTE_EVENT_ID,
      participationId: ticketId,
      role: "attendee",
      status: "confirmed",
      externalPaymentId: mpPaymentId,
      priceCents: Math.round(Number(payment.transaction_amount ?? 0) * 100),
      currency: payment.currency_id ?? "ARS",
      attribution: attribution
        ? { ...attribution, capturedAt: attribution.capturedAt }
        : undefined,
    });

    // Save MP → ticket idempotency mapping for webhook retries.
    await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
  }

  // Tree number for the email = ticket count for this event (display-only).
  const treeCountRes = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  const treeNumber = Number(treeCountRes[0]?.n ?? 1);

  // Send email (runs for both new tickets and retries).
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  if (buyerEmail) {
    try {
      const qrUrl = `${baseUrl}/es/brote/gate?ticket=${ticketId}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#2D4A3E", light: "#FAF6F1" },
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      // buildTicketEmailHtml expects a BroteTicket shape for its template.
      const ticketForTemplate: BroteTicket = {
        id: ticketId,
        type: "ticket",
        paymentId: mpPaymentId,
        buyerEmail,
        buyerName,
        status: "valid",
        createdAt: new Date().toISOString(),
      };
      await getResend().emails.send({
        from: `BROTE <${fromEmail}>`,
        to: buyerEmail,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml(ticketForTemplate, treeNumber),
        attachments: [
          {
            filename: "qr.png",
            content: qrDataUrlToBuffer(qrDataUrl),
            contentType: "image/png",
            contentId: "qr",
          },
        ],
      });

      // Mark email as sent in participation metadata.
      await db
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
            ...participationMetadata,
            emailSent: true,
          })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, ticketId));

      console.log("Email sent:", { to: buyerEmail, ticketId });
    } catch (err) {
      console.error("Email send failed:", ticketId, err);
      // Don't fail the webhook — MP will retry and we'll try email again.
    }
  }

  // Fire Meta CAPI Purchase event — production only, new tickets only.
  if (
    !existingTicketId &&
    payment &&
    process.env.VERCEL_ENV === "production"
  ) {
    try {
      const preferenceId = payment.preference_id as string | undefined;
      let checkoutMeta: {
        eventId?: string;
        fbp?: string;
        fbc?: string;
        ip?: string;
        ua?: string;
      } = {};

      if (preferenceId) {
        const raw = await redis.get(`brote:checkout:${preferenceId}`);
        if (raw) checkoutMeta = JSON.parse(raw);
      }

      const paymentAmount = payment.transaction_amount ?? 0;

      const ip =
        checkoutMeta.ip ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const ua = checkoutMeta.ua || req.headers.get("user-agent");

      if (ip || ua) {
        sendMetaEvent({
          event_name: "Purchase",
          event_id: `brote-purchase-${ticketId}`,
          event_source_url: "https://www.harisolaas.com/es/brote",
          user_data: {
            client_ip_address: ip || undefined,
            client_user_agent: ua || undefined,
            fbp: checkoutMeta.fbp || undefined,
            fbc: checkoutMeta.fbc || undefined,
          },
          custom_data: { currency: "ARS", value: paymentAmount },
        }).catch(() => {}); // fire and forget
      } else {
        console.warn(
          "Meta CAPI: skipping Purchase event — no user_data available for ticket:",
          ticketId,
        );
      }
    } catch (err) {
      console.error("Meta CAPI Purchase error (non-fatal):", err);
    }
  }

  return NextResponse.json({ ok: true, ticketId });
}
