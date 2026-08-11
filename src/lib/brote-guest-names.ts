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
 * THE canonical order of one purchase's tickets. Every reader of a group
 * must use this, or two of them will number the same tickets differently.
 *
 * 1. the buyer's own row first (`attendee` before `companion`);
 * 2. then `metadata.seq`, the position stamped at insert time.
 *
 * `created_at` is NOT a usable tiebreak: the companions of a purchase are
 * written by one multi-row INSERT, so they all share the transaction
 * timestamp and the real ordering falls through to `id` — which is
 * sha256-derived and therefore in a different sequence from the one the
 * buyer's email was numbered in. Measured, that disagrees for roughly half
 * of 3-ticket purchases and most 4-ticket ones. It stays as a last resort
 * only for rows written before `seq` existed, where the group is a single
 * ticket and the order cannot matter.
 */
export const purchaseOrder = [
  sql`(role = 'companion')`,
  sql`COALESCE((metadata->>'seq')::int, 0)`,
  sql`created_at`,
  sql`id`,
];

/**
 * Every ticket of one payment, in the order the buyer's email numbered them.
 *
 * Anchored on `external_payment_id`, the same anchor the webhook's retry
 * path and the contact resend use.
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
    .orderBy(...purchaseOrder);

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
