import { eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { Resend } from "resend";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";
import { db, schema } from "@/db";
import { buildTicketEmailHtml, qrDataUrlToBuffer } from "./brote-email";
import type { BroteTicket } from "./brote-types";

// Minimal shape so tests can pass a fake. A real `Resend` instance satisfies
// it. Same idiom as `bulk-email.ts`.
export type TicketEmailSender = {
  emails: { send(payload: CreateEmailOptions): Promise<CreateEmailResponse> };
};

let _resend: Resend | null = null;
function defaultSender(): TicketEmailSender {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export interface SendBroteTicketEmailParams {
  /** Participation id — also what the QR encodes and the gate validates. */
  ticketId: string;
  to: string;
  buyerName: string;
  paymentId: string;
  /** Display-only "Árbol #N" for the subject and body. */
  treeNumber: number;
}

/**
 * Send one BROTE ticket email (QR inline as a CID attachment).
 *
 * Throws on failure and never writes the `emailSent` flag itself — call
 * `markBroteTicketEmailSent` after this resolves. Keeping the two apart is
 * what makes it impossible to stamp "sent" on a send that didn't happen.
 *
 * The Resend SDK returns `{data, error}` instead of throwing on API errors
 * (429s included), so `error` is inspected explicitly. All three call sites
 * this helper replaces read `result.data?.id` without checking `error`,
 * which is the same defect that cost 19 undelivered emails on 2026-04-19
 * (see `bulk-email.ts`) — there it silently miscounted, here it silently
 * marked an undelivered ticket as sent, suppressing the webhook's retry.
 */
export async function sendBroteTicketEmail(
  params: SendBroteTicketEmailParams,
  sender: TicketEmailSender = defaultSender(),
): Promise<{ resendId: string | undefined }> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  const qrDataUrl = await QRCode.toDataURL(
    `${baseUrl}/es/brote/gate?ticket=${params.ticketId}`,
    { width: 300, margin: 2, color: { dark: "#2D4A3E", light: "#FAF6F1" } },
  );

  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  const ticketForTemplate: BroteTicket = {
    id: params.ticketId,
    type: "ticket",
    paymentId: params.paymentId,
    buyerEmail: params.to,
    buyerName: params.buyerName,
    status: "valid",
    createdAt: new Date().toISOString(),
  };

  const result = await sender.emails.send({
    from: `BROTE <${fromEmail}>`,
    to: params.to,
    subject: `Tu entrada para BROTE 🌱 Árbol #${params.treeNumber}`,
    html: buildTicketEmailHtml(ticketForTemplate, params.treeNumber),
    attachments: [
      {
        filename: "qr.png",
        content: qrDataUrlToBuffer(qrDataUrl),
        contentType: "image/png",
        contentId: "qr",
      },
    ],
  });

  if (result.error) {
    const { name, message, statusCode } = result.error as {
      name?: string;
      message?: string;
      statusCode?: number | null;
    };
    throw new Error(
      `Resend rejected the BROTE ticket email for ${params.ticketId}: ${name ?? "error"} (${statusCode ?? "no status"}) — ${message ?? ""}`,
    );
  }

  return { resendId: result.data?.id };
}

/**
 * Stamp `emailSent` on the participation. Separate from the send so the
 * flag is only ever written after a send that actually succeeded.
 */
export async function markBroteTicketEmailSent(ticketId: string): Promise<void> {
  await db
    .update(schema.participations)
    .set({
      metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
        emailSent: true,
      })}::jsonb`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(schema.participations.id, ticketId));
}
