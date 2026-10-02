import { NextResponse } from "next/server";
import { count, eq, sql } from "drizzle-orm";
import { Payment } from "mercadopago";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import { recordParticipation } from "@/lib/community";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";
import { sendMetaEvent } from "@/lib/meta-capi";
import { getMpClient } from "@/lib/mp-webhook";
import type { BroteTicket } from "@/lib/brote-types";

const BROTE_EVENT_ID = "brote-2026-03-28";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

// TODO: When BROTE checkout is reactivated for a future event, this
// handler should also catch CapacityReachedError from recordParticipation
// (mirror the sinergia/rsvp pattern). Not wired today because checkout
// itself is disabled (see src/app/api/brote/checkout/route.ts).
export async function handleBrotePayment(args: {
  mpPaymentId: string;
  req: Request;
}): Promise<NextResponse> {
  const { mpPaymentId, req } = args;

  const redis = await getRedis();
  const existingTicketId = await redis.get(`brote:payment:${mpPaymentId}`);

  let ticketId: string;
  let buyerEmail: string;
  let buyerName: string;
  let participationMetadata: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  if (existingTicketId) {
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

    console.log("Retrying email for existing ticket:", row.id);
    ticketId = row.id;
    buyerEmail = row.email ?? "";
    buyerName = row.name ?? "Asistente";
    participationMetadata = meta;
  } else {
    try {
      payment = await new Payment(getMpClient()).get({ id: mpPaymentId });
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

    await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
  }

  const treeCountRes = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  const treeNumber = Number(treeCountRes[0]?.n ?? 1);

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
    }
  }

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
        }).catch(() => {});
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
