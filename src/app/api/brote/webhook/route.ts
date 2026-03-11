import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getRedis } from "@/lib/redis";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import type { BroteTicket } from "@/lib/brote-types";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";
import { sendMetaEvent } from "@/lib/meta-capi";

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
      // Log all headers for debugging (redact auth)
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

  // Parse the data.id from the body
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

  // Only process payment notifications
  if (parsed.type !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const mpPaymentId = String(parsed.data?.id);
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();

  // Idempotency: check if we already processed this payment
  const existingTicketId = await redis.get(`brote:payment:${mpPaymentId}`);

  let ticket: BroteTicket;
  let treeNumber: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  if (existingTicketId) {
    // Already processed — but check if email was sent
    const raw = await redis.get(`brote:ticket:${existingTicketId}`);
    if (!raw) {
      return NextResponse.json({ ok: true, ticketId: existingTicketId });
    }
    ticket = JSON.parse(raw);
    if (ticket.emailSent) {
      return NextResponse.json({ ok: true, ticketId: existingTicketId });
    }
    // Email wasn't sent — fall through to retry it
    console.log("Retrying email for existing ticket:", existingTicketId);
    treeNumber = Number(await redis.get("brote:counter")) || 1;
  } else {
    // New payment — fetch from MP and create ticket
    try {
      payment = await new Payment(mp).get({ id: mpPaymentId });
    } catch (err) {
      console.error("MP payment fetch failed:", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const buyerEmail = payment.payer?.email || "";
    const buyerName =
      [payment.payer?.first_name, payment.payer?.last_name]
        .filter(Boolean)
        .join(" ") || "Asistente";

    console.log("Webhook processing:", { mpPaymentId, status: payment.status, buyerEmail, buyerName });

    const ticketId = `BROTE-${nanoid(8).toUpperCase()}`;

    ticket = {
      id: ticketId,
      type: "ticket",
      paymentId: mpPaymentId,
      buyerEmail,
      buyerName,
      status: "valid",
      createdAt: new Date().toISOString(),
    };

    // Store in Redis
    await redis.set(`brote:ticket:${ticketId}`, JSON.stringify(ticket));
    await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
    treeNumber = await redis.incr("brote:counter");

    // Store attendee for export
    await redis.sAdd("brote:attendees", JSON.stringify({
      email: buyerEmail,
      name: buyerName,
      ticketId,
      createdAt: ticket.createdAt,
    }));
  }

  // Send email (runs for both new tickets and retries)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  if (ticket.buyerEmail) {
    try {
      const qrUrl = `${baseUrl}/es/brote/gate?ticket=${ticket.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#2D4A3E", light: "#FAF6F1" },
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      await getResend().emails.send({
        from: `BROTE <${fromEmail}>`,
        to: ticket.buyerEmail,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml(ticket, treeNumber),
        attachments: [{
          filename: "qr.png",
          content: qrDataUrlToBuffer(qrDataUrl),
          contentType: "image/png",
          contentId: "qr",
        }],
      });

      // Mark email as sent
      ticket.emailSent = true;
      await redis.set(`brote:ticket:${ticket.id}`, JSON.stringify(ticket));
      console.log("Email sent:", { to: ticket.buyerEmail, ticketId: ticket.id });
    } catch (err) {
      console.error("Email send failed:", ticket.id, err);
      // Don't fail the webhook — MP will retry and we'll try email again
    }
  }

  // Fire Meta CAPI Purchase event (only for new tickets, not email retries)
  if (!existingTicketId && payment) {
    try {
      // MP stores preference_id on the payment object
      const preferenceId = payment.preference_id as string | undefined;
      let checkoutMeta: { eventId?: string; fbp?: string; fbc?: string; ip?: string; ua?: string } = {};

      // Try to recover tracking data stored at checkout time
      if (preferenceId) {
        const raw = await redis.get(`brote:checkout:${preferenceId}`);
        if (raw) checkoutMeta = JSON.parse(raw);
      }

      const paymentAmount = payment.transaction_amount ?? 0;

      const ip = checkoutMeta.ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const ua = checkoutMeta.ua || req.headers.get("user-agent");

      if (ip || ua) {
        sendMetaEvent({
          event_name: "Purchase",
          event_id: `brote-purchase-${ticket.id}`,
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
        console.warn("Meta CAPI: skipping Purchase event — no user_data available for ticket:", ticket.id);
      }
    } catch (err) {
      console.error("Meta CAPI Purchase error (non-fatal):", err);
    }
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
