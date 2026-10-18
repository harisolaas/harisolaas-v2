import { customAlphabet } from "nanoid";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  canonicalPhoneDigits,
  findPersonIdByPhone,
  lockPhoneNumber,
  phoneMatchCandidates,
  recordParticipation,
  type AttributionTouch,
  type ParticipationStatus,
} from "@/lib/community";
import { hackeaConfig, HACKEA_PARTICIPATION_PREFIX } from "@/data/hackea";

// Hackeá tu mente — server-side lead + payment lifecycle.
//
// Flow: form submit → createHackeaLead (person + `pending` participation, so
// the lead is in the CRM even if they never pay) → MP checkout → webhook →
// confirmHackeaPayment. Email is optional on this form; WhatsApp is the
// required identifier, so people can exist with phone only.

const idSuffix = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

/**
 * Canonical storage form for phones in this flow: `+` + canonical digits.
 * AR spellings with the area code — local ("11 1234-5678", "0351 …"),
 * with the 54/9/0054 prefixes, and for area 11 the mobile 15 ("011 15 …",
 * "11 15 …", "+54 11 15 …") — → "+5491112345678". Another country's number
 * keeps its digits ("+34 612…" → "+34612…"); anything else (e.g. 8 digits
 * without area) is stored as `+` + wa.me digits, unchanged.
 */
export function normalizeArPhone(raw: string): string {
  return `+${canonicalPhoneDigits(raw)}`;
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
 * What the buyer typed on their latest submit, stored on the participation
 * as `metadata.contact`. Delivery (buyer mail, host wa.me link) and the CRM
 * read this, not the person row — the person may carry older data from
 * other flows that this flow deliberately doesn't overwrite.
 */
export interface HackeaContact {
  name: string;
  /** `+549…` form (normalizeArPhone). */
  phone: string;
  email: string | null;
}

type Runner = Pick<typeof db, "execute">;

/**
 * This event's existing lead for the number or the email, or null.
 * Matches on the participation's contact snapshot and on the person row;
 * a phone match wins over an email match when they point at different
 * rows, then paid rows before pending ones, then oldest.
 */
async function findEventLead(
  tx: Runner,
  eventId: string,
  phone: string,
  email: string | null,
): Promise<{ id: string; status: ParticipationStatus; personId: number } | null> {
  const digits = sql.join(
    phoneMatchCandidates(phone).map((c) => sql`${c}`),
    sql`, `,
  );
  const phoneHit = sql`(
    regexp_replace(COALESCE(pa.metadata->'contact'->>'phone', ''), '\\D', '', 'g') IN (${digits})
    OR regexp_replace(COALESCE(pe.phone, ''), '\\D', '', 'g') IN (${digits})
  )`;
  const emailHit = email
    ? sql`(
        lower(pa.metadata->'contact'->>'email') = lower(${email})
        OR lower(pe.email) = lower(${email})
      )`
    : sql`false`;
  const res = await tx.execute<{
    id: string;
    status: ParticipationStatus;
    person_id: number;
  }>(sql`
    SELECT pa.id, pa.status, pa.person_id
    FROM participations pa
    JOIN people pe ON pe.id = pa.person_id
    WHERE pa.event_id = ${eventId}
      AND pa.role = 'attendee'
      AND (${phoneHit} OR ${emailHit})
    ORDER BY
      CASE WHEN ${phoneHit} THEN 0 ELSE 1 END,
      CASE WHEN pa.status IN ('confirmed', 'used') THEN 0 ELSE 1 END,
      pa.created_at,
      pa.id
    LIMIT 1
  `);
  const row = res.rows?.[0];
  return row
    ? { id: row.id, status: row.status, personId: Number(row.person_id) }
    : null;
}

/**
 * Fill empty phone/email slots on the person. Never overwrites, and skips
 * an email another person already owns (people.email is unique).
 */
async function fillInPerson(
  tx: Runner,
  personId: number,
  phone: string,
  email: string | null,
): Promise<void> {
  await tx.execute(sql`
    UPDATE people SET
      phone = COALESCE(phone, ${phone}),
      email = CASE
        WHEN email IS NULL
          AND ${email}::text IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM people p2 WHERE p2.email = ${email})
          THEN ${email}
        ELSE email
      END,
      updated_at = NOW()
    WHERE id = ${personId}
  `);
}

/**
 * Persist the lead before checkout.
 *
 * One transaction holding an advisory lock on the WhatsApp number, so two
 * submits for one number (double click, two tabs, one with email and one
 * without) can't both miss the lookup and write two people / two leads:
 *
 * 1. Dedupe per event first — an existing lead whose snapshot or person
 *    matches the number (or, failing that, the email) is reused. Its
 *    status comes back so the caller answers 409 when it is `confirmed` /
 *    `used`; a pending one gets its contact snapshot refreshed.
 * 2. Otherwise resolve the person WhatsApp-first: a known number lands on
 *    that person, else the email path matches by email. Existing person
 *    values are never overwritten — what the buyer typed this time lives
 *    in `metadata.contact`.
 */
export async function createHackeaLead(
  params: CreateHackeaLeadParams,
): Promise<CreateHackeaLeadResult> {
  const eventId = params.eventId ?? hackeaConfig.eventId;
  if (eventId === hackeaConfig.eventId) await ensureHackeaEvent();

  const name = params.name.trim();
  const phone = normalizeArPhone(params.phone);
  const email = params.email?.trim() || null;
  const contact: HackeaContact = { name, phone, email };

  return db.transaction(async (tx) => {
    await lockPhoneNumber(tx, phone);

    const existing = await findEventLead(tx, eventId, phone, email);
    if (existing) {
      let status = existing.status;
      if (status === "pending") {
        // The phone lock doesn't cover the webhook, which locks the row
        // instead. Re-checking `pending` inside the UPDATE waits on that
        // row lock and re-reads it after the webhook commits: a lead paid
        // meanwhile keeps the snapshot its mails were built from, and the
        // caller sees `confirmed` (409) instead of opening a second checkout.
        const refreshed = await tx.execute<{ id: string }>(sql`
          UPDATE participations SET
            metadata = COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object('contact', ${JSON.stringify(contact)}::jsonb),
            updated_at = NOW()
          WHERE id = ${existing.id} AND status = 'pending'
          RETURNING id
        `);
        if (!refreshed.rows?.length) {
          const cur = await tx.execute<{ status: ParticipationStatus }>(sql`
            SELECT status FROM participations WHERE id = ${existing.id}
          `);
          status = cur.rows?.[0]?.status ?? status;
        }
      }
      await fillInPerson(tx, existing.personId, phone, email);
      return {
        participationId: existing.id,
        status,
        created: false,
      };
    }

    const phonePersonId = await findPersonIdByPhone(tx, phone);

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
      metadata: { contact },
    };

    // Number already known → write through the phone path so it lands on
    // that person; otherwise the email (when given) picks the person.
    const result =
      phonePersonId != null || !email
        ? await recordParticipation(common, tx)
        : await recordParticipation({ ...common, email }, tx);

    await fillInPerson(tx, result.personId, phone, email);

    // Defensive: recordParticipation returns an existing (person, event)
    // row untouched, so read the real status rather than assume pending.
    const statusRes = await tx.execute<{ status: ParticipationStatus }>(sql`
      SELECT status FROM participations WHERE id = ${result.participationId}
    `);
    return {
      participationId: result.participationId,
      status: statusRes.rows?.[0]?.status ?? "pending",
      created: result.created,
    };
  });
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
  /**
   * The approved amount is below the configured ticket price (a tampered or
   * stale preference). The outcome is unchanged — the caller alerts.
   */
  underpaid: boolean;
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
  const underpaid = params.amountCents < hackeaConfig.ticketPriceCents;
  if (underpaid) {
    console.warn("Hackea: approved amount below ticket price", {
      participationId: params.participationId,
      paymentId: params.paymentId,
      amountCents: params.amountCents,
      expected: hackeaConfig.ticketPriceCents,
    });
  }

  return db.transaction(async (tx): Promise<ConfirmHackeaPaymentResult> => {
    const eventRes = await tx.execute<{ capacity: number | null }>(
      sql`SELECT capacity FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    if (!eventRes.rows?.[0]) return { outcome: "not_found", underpaid };
    const capacity = eventRes.rows[0].capacity ?? null;

    const rowRes = await tx.execute<{
      id: string;
      status: string;
      external_payment_id: string | null;
      name: string;
      phone: string | null;
      email: string | null;
      contact: Partial<HackeaContact> | null;
    }>(sql`
      SELECT pa.id, pa.status, pa.external_payment_id, pe.name, pe.phone, pe.email,
        pa.metadata->'contact' AS contact
      FROM participations pa
      JOIN people pe ON pe.id = pa.person_id
      WHERE pa.id = ${params.participationId} AND pa.event_id = ${eventId}
      FOR UPDATE OF pa
    `);
    const row = rowRes.rows?.[0];
    if (!row) return { outcome: "not_found", underpaid };

    // The snapshot of what the buyer typed wins; the person row is the
    // fallback for rows written before the snapshot existed (and per field
    // if one is somehow missing). A snapshot email of null means the buyer
    // left it blank — don't mail an address they didn't give this time.
    const c = row.contact;
    const participant: HackeaParticipant = c
      ? {
          id: row.id,
          name: c.name || row.name,
          phone: c.phone || row.phone,
          email: "email" in c ? (c.email ?? null) : row.email,
        }
      : { id: row.id, name: row.name, phone: row.phone, email: row.email };

    // A recorded payment means this entrada was paid, whatever its status
    // now: a row the operator cancelled ("No vendrá") must not flip back to
    // `confirmed` on an MP redelivery, nor have its payment id overwritten.
    if (
      row.status === "confirmed" ||
      row.status === "used" ||
      row.external_payment_id != null
    ) {
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
      return { outcome: "already", participant, underpaid };
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
        return { outcome: "capacity", participant, underpaid };
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
    return { outcome: "confirmed", participant, underpaid };
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
