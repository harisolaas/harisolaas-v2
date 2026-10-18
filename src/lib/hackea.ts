import { customAlphabet } from "nanoid";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  findPersonIdByPhone,
  recordParticipation,
  type AttributionTouch,
  type ParticipationStatus,
} from "@/lib/community";
import { phoneToWaMe } from "@/lib/plant-types";
import { hackeaConfig, HACKEA_PARTICIPATION_PREFIX } from "@/data/hackea";

// Hackeá tu mente — server-side lead + payment lifecycle.
//
// Flow: form submit → createHackeaLead (person + `pending` participation, so
// the lead is in the CRM even if they never pay) → MP checkout → webhook →
// confirmHackeaPayment. Email is optional on this form; WhatsApp is the
// required identifier, so people can exist with phone only.

const idSuffix = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

/**
 * Canonical storage form for phones in this flow: `+` + wa.me digits.
 * "11 1234-5678" → "+5491112345678".
 */
export function normalizeArPhone(raw: string): string {
  return `+${phoneToWaMe(raw)}`;
}

/** Idempotently create the `events` row from hackeaConfig. */
export async function ensureHackeaEvent(): Promise<void> {
  await db.execute(sql`
    INSERT INTO events (id, type, name, date, capacity, status, landing_path)
    VALUES (
      ${hackeaConfig.eventId},
      ${hackeaConfig.eventType},
      ${hackeaConfig.eventName},
      ${hackeaConfig.startIso}::timestamptz,
      ${hackeaConfig.capacity},
      'upcoming',
      ${hackeaConfig.landingPath}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

export interface CreateHackeaLeadParams {
  name: string;
  phone: string;
  email?: string;
  attribution?: AttributionTouch;
  /** Link slug from attribution; resolved by recordParticipation (bypass). */
  linkSlug?: string;
  /** Tests only. Defaults to hackeaConfig.eventId (and ensures that row). */
  eventId?: string;
}

export interface CreateHackeaLeadResult {
  participationId: string;
  status: ParticipationStatus;
  /** False when this person already had a row for the event. */
  created: boolean;
}

/**
 * Persist the lead before checkout. Identity is WhatsApp-first: if the
 * number already belongs to someone, that person is reused (and gets the
 * email if they had none); otherwise the email path matches by email and
 * fills in the phone. Existing values are never overwritten.
 *
 * Returns the existing row when the person already has one for the event —
 * the caller answers 409 when its status is `confirmed` / `used`.
 */
export async function createHackeaLead(
  params: CreateHackeaLeadParams,
): Promise<CreateHackeaLeadResult> {
  const eventId = params.eventId ?? hackeaConfig.eventId;
  if (eventId === hackeaConfig.eventId) await ensureHackeaEvent();

  const name = params.name.trim();
  const phone = normalizeArPhone(params.phone);
  const email = params.email?.trim() || undefined;

  const phonePersonId = await findPersonIdByPhone(db, phone);

  const common = {
    name,
    phone,
    eventId,
    participationId: `${HACKEA_PARTICIPATION_PREFIX}${idSuffix()}`,
    role: "attendee",
    status: "pending" as const,
    attribution: params.attribution,
    bypassLinkSlug: params.linkSlug,
    priceCents: hackeaConfig.ticketPriceCents,
    currency: hackeaConfig.currency,
  };

  // Number already known → write through the phone path so it lands on
  // that person, then attach the email only if the slot is empty and no
  // other person owns the address (people.email is unique).
  const result =
    phonePersonId != null
      ? await recordParticipation(common)
      : await recordParticipation({ ...common, email });

  if (phonePersonId != null && email) {
    await db.execute(sql`
      UPDATE people SET email = ${email}, updated_at = NOW()
      WHERE id = ${result.personId}
        AND email IS NULL
        AND NOT EXISTS (SELECT 1 FROM people WHERE email = ${email})
    `);
  }

  const statusRes = await db.execute<{ status: ParticipationStatus }>(sql`
    SELECT status FROM participations WHERE id = ${result.participationId}
  `);
  const status = statusRes.rows?.[0]?.status ?? "pending";

  return {
    participationId: result.participationId,
    status,
    created: result.created,
  };
}

export interface HackeaParticipant {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface ConfirmHackeaPaymentResult {
  outcome: "confirmed" | "already" | "not_found" | "capacity";
  participant?: HackeaParticipant;
}

/**
 * Webhook side: mark a lead as paid. One transaction, event row locked so
 * the capacity count can't race a concurrent confirmation. On overflow the
 * lead stays `pending` with `metadata.overflowPaymentId` so ops can refund
 * or squeeze them in by hand.
 *
 * A participation that belongs to a different event is `not_found` — the
 * external_reference must point at a Hackeá row.
 */
export async function confirmHackeaPayment(params: {
  participationId: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  /** Tests only. Defaults to hackeaConfig.eventId. */
  eventId?: string;
}): Promise<ConfirmHackeaPaymentResult> {
  const eventId = params.eventId ?? hackeaConfig.eventId;

  return db.transaction(async (tx) => {
    const eventRes = await tx.execute<{ capacity: number | null }>(
      sql`SELECT capacity FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    if (!eventRes.rows?.[0]) return { outcome: "not_found" };
    const capacity = eventRes.rows[0].capacity ?? null;

    const rowRes = await tx.execute<{
      id: string;
      status: string;
      external_payment_id: string | null;
      name: string;
      phone: string | null;
      email: string | null;
    }>(sql`
      SELECT pa.id, pa.status, pa.external_payment_id, pe.name, pe.phone, pe.email
      FROM participations pa
      JOIN people pe ON pe.id = pa.person_id
      WHERE pa.id = ${params.participationId} AND pa.event_id = ${eventId}
      FOR UPDATE OF pa
    `);
    const row = rowRes.rows?.[0];
    if (!row) return { outcome: "not_found" };

    const participant: HackeaParticipant = {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
    };

    if (row.status === "confirmed" || row.status === "used") {
      if (row.external_payment_id !== params.paymentId) {
        // A second approved payment for an already-paid entrada (two tabs,
        // two checkouts). Don't overwrite the first; keep a trail for a
        // manual refund.
        console.warn("Hackea: second distinct payment for a paid entrada", {
          participationId: row.id,
          stored: row.external_payment_id,
          incoming: params.paymentId,
        });
        await tx.execute(sql`
          UPDATE participations SET
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'extraPaymentIds',
              COALESCE(metadata->'extraPaymentIds', '[]'::jsonb)
                || to_jsonb(${params.paymentId}::text)
            ),
            updated_at = NOW()
          WHERE id = ${row.id}
            AND NOT (COALESCE(metadata->'extraPaymentIds', '[]'::jsonb)
                     ? ${params.paymentId})
        `);
      }
      return { outcome: "already", participant };
    }

    if (capacity != null) {
      const countRes = await tx.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM participations
        WHERE event_id = ${eventId} AND status IN ('confirmed', 'used')
      `);
      if (Number(countRes.rows?.[0]?.n ?? 0) >= capacity) {
        await tx.execute(sql`
          UPDATE participations SET
            metadata = COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object('overflowPaymentId', ${params.paymentId}::text),
            updated_at = NOW()
          WHERE id = ${row.id}
        `);
        return { outcome: "capacity", participant };
      }
    }

    await tx.execute(sql`
      UPDATE participations SET
        status = 'confirmed',
        external_payment_id = ${params.paymentId},
        price_cents = ${params.amountCents},
        currency = ${params.currency},
        updated_at = NOW()
      WHERE id = ${row.id}
    `);
    return { outcome: "confirmed", participant };
  });
}

/** jsonb-merge a delivery flag into participations.metadata. */
export async function markHackeaFlag(
  participationId: string,
  flag: "buyerEmailSent" | "hostNotified",
): Promise<void> {
  await db.execute(sql`
    UPDATE participations SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(${flag}::text, true),
      updated_at = NOW()
    WHERE id = ${participationId}
  `);
}
