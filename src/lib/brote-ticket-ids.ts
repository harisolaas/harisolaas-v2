import { createHash } from "crypto";

/**
 * Ticket ids for the extra ("companion") tickets of one payment.
 *
 * These MUST be derived from the payment rather than minted fresh, and that
 * is a correctness requirement, not a style preference.
 *
 * The unique index on `(person_id, event_id)` is partial — it exempts
 * `role = 'companion'` precisely so one buyer can hold several tickets. It
 * was also, before that change, the only thing stopping two concurrent
 * MercadoPago deliveries of the same payment from double-issuing: the
 * second insert tripped 23505. Companion rows no longer get that.
 *
 * The webhook's own idempotency is a plain `redis.get` with no atomic claim,
 * so it does not close the window either. What does is `ON CONFLICT (id) DO
 * NOTHING` in `addCompanionTickets` — and that can only dedup if both
 * deliveries compute the SAME ids. A `nanoid()` per invocation defeats it
 * silently: two deliveries, `2 × qty` tickets, two emails, an inflated tree
 * counter, and double credit to the collaborator who sold them.
 *
 * Note `recordParticipation` does not need this: its person upsert takes a
 * row lock on `people` that serialises same-buyer calls. `addCompanionTickets`
 * deliberately never touches that row, so it inherits no such protection.
 */
export function companionTicketId(mpPaymentId: string, index: number): string {
  const digest = createHash("sha256")
    .update(`brote-companion:${mpPaymentId}:${index}`)
    .digest("hex");
  // 40 bits of the digest in base36 — same shape and length as the
  // `nanoid(8).toUpperCase()` ids the primary ticket uses, so nothing
  // downstream (the QR, the gate, the admin lookup) can tell them apart.
  const suffix = parseInt(digest.slice(0, 10), 16)
    .toString(36)
    .toUpperCase()
    .padStart(8, "0")
    .slice(0, 8);
  return `BROTE2-${suffix}`;
}

/** Every companion id for a payment, in order. `count` excludes the primary. */
export function companionTicketIds(
  mpPaymentId: string,
  count: number,
): string[] {
  return Array.from({ length: count }, (_, i) =>
    companionTicketId(mpPaymentId, i),
  );
}

/** Hard ceiling on tickets per purchase. Enforced at checkout AND at the webhook. */
export const MAX_TICKETS_PER_PURCHASE = 10;

/**
 * How many tickets a payment is for.
 *
 * Deliberately tolerant of the shape: MercadoPago's SDK types
 * `additional_info.items[].quantity` as a `number`, but the REST payment
 * response returns it as a **string**, so the coercion here is load-bearing
 * rather than defensive. Anything that isn't a whole number in range falls
 * back to 1 — a purchase that issues one ticket is recoverable by hand; one
 * that issues 10,000 rows is not.
 */
export function parseTicketQuantity(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim())
        : NaN;
  if (!Number.isFinite(n)) return 1;
  const floored = Math.floor(n);
  if (floored < 1) return 1;
  return Math.min(floored, MAX_TICKETS_PER_PURCHASE);
}
