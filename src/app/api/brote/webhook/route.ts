import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getRedis } from "@/lib/redis";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import type { BroteTicket } from "@/lib/brote-types";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});
const resend = new Resend(process.env.RESEND_API_KEY!);

function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not set

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

  return hash === expected;
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
  const existing = await redis.get(`brote:payment:${mpPaymentId}`);
  if (existing) {
    return NextResponse.json({ ok: true, ticketId: existing });
  }

  // Fetch payment details from MercadoPago
  const payment = await new Payment(mp).get({ id: mpPaymentId });

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const type = "ticket" as const;
  const buyerEmail = payment.payer?.email || "";
  const buyerName =
    [payment.payer?.first_name, payment.payer?.last_name]
      .filter(Boolean)
      .join(" ") || "Asistente";

  // Generate ticket
  const ticketId = `BROTE-${nanoid(8).toUpperCase()}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://harisolaas.com";

  const ticket: BroteTicket = {
    id: ticketId,
    type,
    paymentId: mpPaymentId,
    buyerEmail,
    buyerName,
    status: "valid",
    createdAt: new Date().toISOString(),
  };

  // Generate QR code
  const qrUrl = `${baseUrl}/es/brote/gate?ticket=${ticketId}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#2D4A3E", light: "#FAF6F1" },
  });

  // Store in Redis
  await redis.set(`brote:ticket:${ticketId}`, JSON.stringify(ticket));
  await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
  const treeNumber = await redis.incr("brote:counter");

  // Store attendee for export
  await redis.sadd("brote:attendees", JSON.stringify({
    email: buyerEmail,
    name: buyerName,
    ticketId,
    createdAt: ticket.createdAt,
  }));

  // Send email
  if (buyerEmail) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";

    await resend.emails.send({
      from: `BROTE <${fromEmail}>`,
      to: buyerEmail,
      subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
      html: buildTicketEmailHtml(ticket, treeNumber),
      attachments: [{
        filename: "qr.png",
        content: qrDataUrlToBuffer(qrDataUrl),
        contentType: "image/png",
        contentId: "qr",
      }],
    });
  }

  return NextResponse.json({ ok: true, ticketId });
}
