/**
 * Who already came — the audience for the "Comunidad BROTE" campaign and for
 * `/es/brote/invitacion/comunidad`.
 *
 * Everyone with a real participation in BROTE 1 or the planting day, minus
 * anyone who already bought for BROTE 2 (sending them a discount for a ticket
 * they own reads as a mistake, and invites a refund request).
 *
 * `cancelled` is excluded: they signed up and pulled out. `no_show` is kept —
 * they paid and didn't make it, which is a reason to invite them back, not a
 * reason to drop them.
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
    WHERE pa.event_id IN (${BROTE_1_EVENT_ID}, ${PLANT_EVENT_ID})
      AND pa.status <> 'cancelled'
      AND p.email IS NOT NULL
      -- An explicit opt-out is the one preference we do have on record.
      -- communication_opt_ins is NOT filtered on: the consent flow that would
      -- populate it meaningfully was never built, so every row carries the
      -- same default and filtering on it would be theatre.
      AND p.opted_out_at IS NULL
      -- Already holds a BROTE 2 ticket: don't offer them a discount on
      -- something they have already paid for. Re-evaluated on every wave, so
      -- anyone who buys between sends drops out of the next one by itself.
      AND NOT EXISTS (
        SELECT 1 FROM participations b2
        WHERE b2.person_id = p.id
          AND b2.event_id = ${BROTE_EVENT_ID}
          AND b2.status IN ('confirmed', 'used', 'no_show')
      )
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
