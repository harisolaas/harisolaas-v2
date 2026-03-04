import { NextResponse } from "next/server";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import type { BroteTicket } from "@/lib/brote-types";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.BROTE_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, name, treeNumber } = (await req.json()) as {
    email?: string;
    name?: string;
    treeNumber?: number;
  };

  const to = email || "test@example.com";
  const tree = treeNumber ?? 42;

  const ticketId = `BROTE-TEST${nanoid(4).toUpperCase()}`;
  const ticket: BroteTicket = {
    id: ticketId,
    type: "ticket",
    paymentId: "test",
    buyerEmail: to,
    buyerName: name || "Test Attendee",
    status: "valid",
    createdAt: new Date().toISOString(),
  };

  const qrDataUrl = await QRCode.toDataURL(`https://harisolaas.com/es/brote/gate?ticket=${ticketId}`, {
    width: 300,
    margin: 2,
    color: { dark: "#2D4A3E", light: "#FAF6F1" },
  });

  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  const result = await resend.emails.send({
    from: `BROTE <${fromEmail}>`,
    to,
    subject: `Tu entrada para BROTE 🌱 Arbol #${tree}`,
    html: buildTicketEmailHtml(ticket, tree),
    attachments: [{
      filename: "qr.png",
      content: qrDataUrlToBuffer(qrDataUrl),
      contentType: "image/png",
      contentId: "qr",
    }],
  });

  return NextResponse.json({ ok: true, ticketId, to, treeNumber: tree, resendId: result.data?.id });
}
