import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import { CapacityReachedError, recordParticipation } from "@/lib/community";
import type { AttributionTouch } from "@/lib/community";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";
import {
  buildSinergiaParrafoTicketEmailHtml,
  buildSinergiaParrafoHostNotificationHtml,
  qrDataUrlToBuffer,
} from "@/lib/sinergia-parrafo-email";

const EVENT_ID = sinergiaParrafoConfig.eventId;

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

// HMAC verification — same envelope as BROTE / Sinergia. MP signs
// `id:{dataId};request-id:{xRequestId};ts:{ts};` with the dashboard secret.
function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip when unset (dev/preview without webhook).

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

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
    console.warn("sinergia-parrafo webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }
  return true;
}

interface CheckoutMeta {
  name?: string;
  email?: string;
  phone?: string;
  locale?: string;
  attribution?: AttributionTouch | null;
  ip?: string;
  ua?: string;
}

async function readCheckoutMeta(
  preferenceId: string | undefined,
): Promise<CheckoutMeta | null> {
  if (!preferenceId) return null;
  try {
    const redis = await getRedis();
    const raw = await redis.get(
      `sinergia-parrafo:checkout:${preferenceId}`,
    );
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutMeta;
  } catch (err) {
    console.error("sinergia-parrafo: failed to read checkout meta:", err);
    return null;
  }
}

async function ensureEvent(): Promise<void> {
  const { eventId, eventName, startIso, capacity } = sinergiaParrafoConfig;
  const eventDate = new Date(startIso);
  const status = eventDate < new Date() ? "past" : "upcoming";
  await db
    .insert(schema.events)
    .values({
      id: eventId,
      type: "sinergia-parrafo",
      series: "sinergia-parrafo",
      name: eventName,
      date: eventDate,
      capacity,
      status,
    })
    .onConflictDoNothing();
}

async function countOccupied(): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, EVENT_ID),
        inArray(schema.participations.status, ["confirmed", "used"]),
      ),
    );
  return Number(res[0]?.n ?? 0);
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

  // Idempotency: Redis maps MP payment id → ticket id. Fast path for retries.
  const existingTicketId = await redis.get(
    `sinergia-parrafo:payment:${mpPaymentId}`,
  );

  let ticketId: string;
  let buyerEmail: string;
  let buyerName: string;
  let participationMetadata: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  if (existingTicketId) {
    // Participation already exists. Decide whether to retry email.
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
      console.warn("sinergia-parrafo: orphaned MP idempotency key", {
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
    ticketId = row.id;
    buyerEmail = row.email ?? "";
    buyerName = row.name ?? "Asistente";
    participationMetadata = meta;
  } else {
    // New payment — fetch from MP and create participation.
    try {
      payment = await new Payment(getMp()).get({ id: mpPaymentId });
    } catch (err) {
      console.error("sinergia-parrafo: MP payment fetch failed", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // Buyer info: prefer the Redis stash (captured at checkout from our
    // form). MP's payer object is unreliable for Account Money flows.
    const checkoutMeta = await readCheckoutMeta(
      payment.preference_id as string | undefined,
    );

    buyerEmail =
      checkoutMeta?.email?.trim() ||
      payment.payer?.email ||
      "";
    buyerName =
      checkoutMeta?.name?.trim() ||
      [payment.payer?.first_name, payment.payer?.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Asistente";
    const buyerPhone = checkoutMeta?.phone?.trim() || undefined;

    if (!buyerEmail) {
      console.error(
        "sinergia-parrafo: no buyer email available for payment",
        mpPaymentId,
      );
      return NextResponse.json(
        { error: "No buyer email" },
        { status: 200 },
      );
    }

    ticketId = `SP-${nanoid(8).toUpperCase()}`;

    await ensureEvent();

    try {
      await recordParticipation({
        email: buyerEmail,
        name: buyerName,
        phone: buyerPhone,
        eventId: EVENT_ID,
        participationId: ticketId,
        role: "attendee",
        status: "confirmed",
        externalPaymentId: mpPaymentId,
        priceCents: Math.round(
          Number(payment.transaction_amount ?? 0) * 100,
        ),
        currency: payment.currency_id ?? sinergiaParrafoConfig.currency,
        attribution: checkoutMeta?.attribution ?? undefined,
        bypassLinkSlug: checkoutMeta?.attribution?.linkSlug,
      });
    } catch (err) {
      if (err instanceof CapacityReachedError) {
        // The event filled between checkout and payment confirmation.
        // The buyer paid and we can't seat them — flag for manual refund.
        // Don't 500 (MP would retry); return 200 with a clear log line.
        console.error(
          "sinergia-parrafo: capacity reached after payment — manual refund needed",
          { mpPaymentId, buyerEmail, buyerName },
        );
        return NextResponse.json(
          { ok: false, error: "Capacity reached after payment" },
          { status: 200 },
        );
      }
      throw err;
    }

    await redis.set(`sinergia-parrafo:payment:${mpPaymentId}`, ticketId);
  }

  // Send the ticket email. Runs for both fresh tickets and retry replays.
  if (buyerEmail) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
      const qrPayload = `${baseUrl}/sinergia-parrafo/ticket/${ticketId}`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
        color: { dark: "#0E6BA8", light: "#F1ECDA" },
      });

      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
      const amountCents = payment
        ? Math.round(Number(payment.transaction_amount ?? 0) * 100)
        : sinergiaParrafoConfig.ticketPriceCents;
      const paymentRef = payment?.id ? String(payment.id) : mpPaymentId;

      await getResend().emails.send({
        from: `Sinergia × Párrafo <${fromEmail}>`,
        to: buyerEmail,
        subject: "Tu lugar para Sinergia × Párrafo (16/05) 📖",
        html: buildSinergiaParrafoTicketEmailHtml({
          name: buyerName,
          ticketId,
          amountCents,
          paymentId: paymentRef,
        }),
        attachments: [
          {
            filename: "qr.png",
            content: qrDataUrlToBuffer(qrDataUrl),
            contentType: "image/png",
            contentId: "qr",
          },
        ],
      });

      // Mark email as sent on the participation row so a webhook retry
      // doesn't double-send.
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

      // Host notification. Only on fresh tickets — retries shouldn't
      // re-spam the host. Recompute occupancy after the insert above.
      if (!existingTicketId) {
        const notifyList = (
          process.env.SINERGIA_PARRAFO_NOTIFY_EMAILS ||
          process.env.SINERGIA_NOTIFY_EMAILS ||
          ""
        )
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

        if (notifyList.length > 0) {
          const occupied = await countOccupied();
          const remaining = Math.max(
            0,
            sinergiaParrafoConfig.capacity - occupied,
          );
          try {
            // Look up the phone we just stored (recordParticipation may
            // have preserved an existing one; this is the source of truth).
            const personRow = await db
              .select({ phone: schema.people.phone })
              .from(schema.participations)
              .innerJoin(
                schema.people,
                eq(schema.people.id, schema.participations.personId),
              )
              .where(eq(schema.participations.id, ticketId))
              .limit(1);
            const phone = personRow[0]?.phone ?? undefined;

            await getResend().emails.send({
              from: `Sinergia × Párrafo <${fromEmail}>`,
              to: notifyList,
              subject: `Nueva entrada Sinergia × Párrafo — ${buyerName}`,
              html: buildSinergiaParrafoHostNotificationHtml({
                name: buyerName,
                email: buyerEmail,
                phone: phone ?? undefined,
                ticketId,
                amountCents,
                totalRegistered: occupied,
                remaining,
                capacity: sinergiaParrafoConfig.capacity,
              }),
            });
          } catch (err) {
            console.error(
              "sinergia-parrafo: host notification failed",
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error("sinergia-parrafo: ticket email failed", ticketId, err);
      // Non-fatal: MP will retry the webhook and we'll try email again.
    }
  }

  return NextResponse.json({ ok: true, ticketId });
}
