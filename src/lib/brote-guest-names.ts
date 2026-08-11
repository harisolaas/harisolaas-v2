import "server-only";

import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Per-ticket guest names.
 *
 * A buyer of several tickets can put a name on each one, optionally, on
 * `/brote/success`. The name lives in `participations.metadata.guestName`
 * and NOT as a row in `people`: that table is the cross-event identity
 * table behind every mailing audience, and a friend whose email we do not
 * have is not an identity — it is a name written on a ticket.
 */

export const MAX_GUEST_NAME = 80;

/** Trim, cap, and drop anything that is only whitespace. */
export function normalizeGuestName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_GUEST_NAME);
}

/**
 * Every ticket of one payment, in the order they are numbered.
 *
 * Anchored on `external_payment_id`, the same anchor the webhook's retry
 * path and the contact resend use, with the same ordering — so the position
 * a buyer sees in the form is the position the email showed.
 */
export async function ticketsForPayment(
  paymentId: string,
): Promise<{ id: string; guestName: string }[]> {
  if (!paymentId) return [];
  const rows = await db
    .select({
      id: schema.participations.id,
      metadata: schema.participations.metadata,
    })
    .from(schema.participations)
    .where(eq(schema.participations.externalPaymentId, paymentId))
    .orderBy(
      sql`(${schema.participations.role} = 'companion')`,
      schema.participations.createdAt,
      schema.participations.id,
    );

  return rows.map((r) => ({
    id: r.id,
    guestName: String(
      (r.metadata as Record<string, unknown>)?.guestName ?? "",
    ),
  }));
}

/**
 * Write one name per ticket, positionally.
 *
 * `names` is ordered, NOT a map of id → name, and that is deliberate: the
 * ids are resolved on the server from the payment, so nothing in the
 * request body can choose which row gets written. A caller holding the
 * capability token for payment A cannot reach a ticket of payment B even by
 * naming its id.
 *
 * Returns how many rows were actually touched.
 */
export async function applyGuestNames(
  paymentId: string,
  names: string[],
): Promise<number> {
  const tickets = await ticketsForPayment(paymentId);
  if (tickets.length === 0) return 0;

  let written = 0;
  for (const [i, ticket] of tickets.entries()) {
    const name = normalizeGuestName(names[i]);
    // An empty slot means "leave this one alone", not "clear it" — the form
    // sends every field on every submit, and a buyer who fills two of three
    // should not wipe a name they set earlier.
    if (!name || name === ticket.guestName) continue;
    await db
      .update(schema.participations)
      .set({
        metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
          guestName: name,
        })}::jsonb`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.participations.id, ticket.id));
    written++;
  }
  return written;
}
