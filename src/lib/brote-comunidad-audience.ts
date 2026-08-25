/**
 * Who already came — the audience for the "Comunidad BROTE" campaign and for
 * `/es/brote/invitacion/comunidad`.
 *
 * Everyone who actually took part in BROTE 1 or the planting day, minus
 * anyone who already bought for BROTE 2 (sending them a discount for a ticket
 * they own reads as a mistake, and invites a refund request).
 *
 * "Actually took part" is an allow-list of `confirmed` / `used` / `no_show` —
 * see the comment on QUALIFIES for why `waitlist` and `pending` are not the
 * same thing as having been there.
 *
 * This lives in `src/lib` rather than in the script that first wrote it
 * because two things read it now — `scripts/brote-returning-audience.ts` and
 * the campaign runner — and two copies of this SQL would drift the first time
 * someone adjusted one of them.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BROTE_EVENT_ID, BROTE_1_EVENT_ID } from "@/data/brote";

export const PLANT_EVENT_ID = "plant-2026-04";

export interface ComunidadAudienceRow {
  personId: number;
  name: string | null;
  email: string;
  phone: string | null;
  cameToBrote1: boolean;
  cameToPlant: boolean;
}

interface RawRow {
  person_id: string | number;
  name: string | null;
  email: string | null;
  phone: string | null;
  came_to_brote1: boolean;
  came_to_plant: boolean;
}

/**
 * Everything that decides whether a person belongs, EXCEPT whether we can
 * reach them.
 *
 * Composed rather than written twice because two queries need it: the one
 * that builds the audience (`email IS NOT NULL`) and the one that counts who
 * qualified but has no address (`email IS NULL`). The second feeds
 * `missingEmails` on the admin alert, which exists precisely to surface
 * people the send never saw — and it can only be trusted if both halves ask
 * the same question.
 */
const QUALIFIES = sql`
  pa.event_id IN (${BROTE_1_EVENT_ID}, ${PLANT_EVENT_ID})
  -- Allow-list, not "anything except cancelled".
  --
  -- The copy makes a specific claim — "el 28 de marzo estuviste en la
  -- primera", "el 19 de abril plantaste con las manos" — and waitlist and
  -- pending are people that never happened to. The plantación waitlist rows
  -- in particular were seeded with the email address as the name, so those
  -- would also have been greeted by their own inbox.
  --
  -- no_show stays: they paid and didn't make it, which is a reason to invite
  -- them back, not a reason to drop them. Same three statuses the BROTE 2
  -- exclusion below counts as "already has a ticket", which is the symmetry
  -- you want — held a place then, holds one now.
  AND pa.status IN ('confirmed', 'used', 'no_show')
  -- An explicit opt-out is the one preference we do have on record.
  -- communication_opt_ins is NOT filtered on: the consent flow that would
  -- populate it meaningfully was never built, so every row carries the same
  -- default and filtering on it would be theatre.
  AND p.opted_out_at IS NULL
  -- Already holds a BROTE 2 ticket: don't offer them a discount on something
  -- they have already paid for. Re-evaluated on every wave, so anyone who
  -- buys between sends drops out of the next one by itself.
  AND NOT EXISTS (
    SELECT 1 FROM participations b2
    WHERE b2.person_id = p.id
      AND b2.event_id = ${BROTE_EVENT_ID}
      AND b2.status IN ('confirmed', 'used', 'no_show')
  )
`;

export async function loadComunidadAudience(): Promise<
  ComunidadAudienceRow[]
> {
  const result = await db.execute(sql`
    SELECT
      p.id AS person_id,
      p.name,
      p.email,
      p.phone,
      bool_or(pa.event_id = ${BROTE_1_EVENT_ID}) AS came_to_brote1,
      bool_or(pa.event_id = ${PLANT_EVENT_ID})   AS came_to_plant
    FROM people p
    JOIN participations pa ON pa.person_id = p.id
    WHERE ${QUALIFIES}
      AND p.email IS NOT NULL
    GROUP BY p.id, p.name, p.email, p.phone
    ORDER BY p.name NULLS LAST
  `);

  return (result.rows as unknown as RawRow[]).map((r) => ({
    // `bigserial` comes back as a string from the driver; the Redis
    // idempotency key is built from it, so it is normalised once here rather
    // than producing `...:NaN:w1` at the call site.
    personId: Number(r.person_id),
    name: r.name,
    email: (r.email ?? "").toLowerCase(),
    phone: r.phone,
    cameToBrote1: Boolean(r.came_to_brote1),
    cameToPlant: Boolean(r.came_to_plant),
  }));
}

/**
 * How many people belong in this campaign but have no address on file.
 *
 * They never enter the audience, so `sendBulkEmails` cannot see them and the
 * reconciliation gap stays at zero while real people go uncontacted. This is
 * the number `notifyAdminOfCampaign`'s `missingEmails` bucket reports, and
 * the runbook's instruction is to fix `people` before the next wave.
 */
export async function countComunidadAudienceMissingEmail(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id)::int AS n
    FROM people p
    JOIN participations pa ON pa.person_id = p.id
    WHERE ${QUALIFIES}
      AND p.email IS NULL
  `);
  return Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
}
