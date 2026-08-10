import { inArray, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { Resend } from "resend";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";
import { db, schema } from "@/db";
import {
  buildTicketEmailHtml,
  qrContentId,
  qrDataUrlToBuffer,
  type TicketForEmail,
} from "./brote-email";

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
  /**
   * Every ticket this email delivers, in the order they should be shown.
   * One buyer can hold several (bought for friends), and they arrive in a
   * single message rather than N messages.
   */
  tickets: TicketForEmail[];
  to: string;
  buyerName: string;
  paymentId: string;
}

/**
 * Send one BROTE ticket email (QR inline as a CID attachment).
 *
 * Throws on failure and never writes the `emailSent` flag itself — call
 * `markBroteTicketEmailSent` after this resolves. Keeping the two apart is
 * what makes it impossible to stamp "sent" on a send that didn't happen.
 *
 * The Resend SDK returns `{data, error}` instead of throwing on API errors
 * (429s included), so success means BOTH: no `error`, and a message id in
 * `data`. All three call sites this helper replaces read `result.data?.id`
 * without checking `error` — the same defect that cost 19 undelivered
 * emails on 2026-04-19 (see `bulk-email.ts`). There it silently miscounted;
 * here it silently marked an undelivered ticket as sent, suppressing the
 * webhook's retry. Resolving therefore guarantees a real message id, which
 * is what makes it safe for the caller to stamp the flag next.
 */
export async function sendBroteTicketEmail(
  params: SendBroteTicketEmailParams,
  sender: TicketEmailSender = defaultSender(),
): Promise<{ resendId: string }> {
  if (params.tickets.length === 0) {
    throw new Error("sendBroteTicketEmail called with no tickets");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

  // One QR per ticket, each encoding ITS OWN gate URL. Generating one and
  // attaching it N times is the silent failure this loop exists to avoid:
  // the email looks right and two of three people are turned away.
  const attachments = await Promise.all(
    params.tickets.map(async (ticket, i) => {
      const qrDataUrl = await QRCode.toDataURL(
        `${baseUrl}/es/brote/gate?ticket=${ticket.ticketId}`,
        { width: 300, margin: 2, color: { dark: "#2D4A3E", light: "#FAF6F1" } },
      );
      const cid = qrContentId(i);
      return {
        filename: `${cid}.png`,
        content: qrDataUrlToBuffer(qrDataUrl),
        contentType: "image/png",
        contentId: cid,
      };
    }),
  );

  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  // Every id in the failure message: with a batch, knowing only the first
  // leaves an operator guessing which tickets did not go out.
  const ticketList = params.tickets.map((t) => t.ticketId).join(", ");
  const count = params.tickets.length;
  const subject =
    count > 1
      ? `Tus ${count} entradas para BROTE 🌱`
      : `Tu entrada para BROTE 🌱 Árbol #${params.tickets[0].treeNumber}`;

  const result = await sender.emails.send({
    from: `BROTE <${fromEmail}>`,
    to: params.to,
    subject,
    html: buildTicketEmailHtml(params.tickets, params.buyerName),
    attachments,
  });

  if (result.error) {
    const { name, message, statusCode } = result.error as {
      name?: string;
      message?: string;
      statusCode?: number | null;
    };
    const detail = [
      name ?? "error",
      statusCode == null ? null : `status ${statusCode}`,
      message || null,
    ]
      .filter(Boolean)
      .join(" — ");
    throw new Error(
      `Resend rejected the BROTE ticket email for ${ticketList}: ${detail}`,
    );
  }

  // `{data: null, error: null}` shouldn't happen per Resend's types, but
  // treating it as success is the same failure as ignoring `error`: the
  // caller stamps `emailSent` on a ticket that was never accepted, and in
  // the webhook that also kills MercadoPago's retry. Same defence as
  // `bulk-email.ts`.
  if (!result.data?.id) {
    throw new Error(
      `Resend returned neither data nor error for the BROTE ticket email for ${ticketList}`,
    );
  }

  return { resendId: result.data.id };
}

/**
 * Stamp `emailSent` on the participation. Separate from the send so the
 * flag is only ever written after a send that actually succeeded.
 */
export async function markBroteTicketEmailSent(
  ticketIds: string[],
): Promise<void> {
  // `WHERE id IN ()` is a syntax error, and "handling" it by dropping the
  // predicate would stamp emailSent on EVERY ticket in the table and kill
  // MercadoPago's retry for all of them. Return before building the query.
  if (ticketIds.length === 0) return;

  await db
    .update(schema.participations)
    .set({
      metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
        emailSent: true,
      })}::jsonb`,
      updatedAt: sql`NOW()`,
    })
    .where(inArray(schema.participations.id, ticketIds));
}
