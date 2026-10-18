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
import { parseHackeaWhatsApp } from "@/lib/hackea-phone";

// Hackeá tu mente — server-side lead + payment lifecycle.
//
// Flow: form submit → createHackeaLead (person + `pending` participation, so
// the lead is in the CRM even if they never pay) → MP checkout → webhook →
// confirmHackeaPayment. Email is optional on this form; WhatsApp is the
// required identifier, so people can exist with phone only.

const idSuffix = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

/**
 * Canonical storage form for phones in this flow: the E.164 WhatsApp number
 * from `parseHackeaWhatsApp` — the same parser the form validates with, so
 * every accepted spelling of one AR mobile ("11 1234-5678", "011 15 …",
 * "0351 15 …", "+54 9 …", "0054 …") lands on "+549" + the 10-digit national
 * number, and a foreign mobile on its own E.164 ("0034 612…" → "+34612…").
 * Only input the validator rejects (never reaches the checkout) falls back
 * to `+` + `canonicalPhoneDigits`, the shared helper's old behaviour.
 */
export function normalizeArPhone(raw: string): string {
  return parseHackeaWhatsApp(raw) ?? `+${canonicalPhoneDigits(raw)}`;
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
  /** The entrada is paid (see `paidSql`) — the checkout answers 409. */
  paid: boolean;
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
 * Whether a participation (aliased `pa`) holds a paid entrada: a recorded
 * payment that wasn't refunded / charged back (`metadata.refund` on that
 * same payment id), whatever the status — "No vendrá" doesn't give the
 * money back. With no payment on record, `confirmed`/`used` (a comp set by
 * hand) counts as paid. A refunded entrada can be bought again.
 */
const paidSql = sql`(CASE WHEN pa.external_payment_id IS NOT NULL
  THEN pa.external_payment_id IS DISTINCT FROM pa.metadata->'refund'->>'paymentId'
  ELSE pa.status IN ('confirmed', 'used') END)`;

async function readLeadState(
  tx: Runner,
  id: string,
): Promise<{ status: ParticipationStatus; paid: boolean } | null> {
  const res = await tx.execute<{ status: ParticipationStatus; paid: boolean }>(
    sql`SELECT pa.status, ${paidSql} AS paid FROM participations pa WHERE pa.id = ${id}`,
  );
  const row = res.rows?.[0];
  return row ? { status: row.status, paid: Boolean(row.paid) } : null;
}

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
): Promise<{
  id: string;
  status: ParticipationStatus;
  paid: boolean;
  personId: number;
} | null> {
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
    paid: boolean;
    person_id: number;
  }>(sql`
    SELECT pa.id, pa.status, ${paidSql} AS paid, pa.person_id
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
    ? {
        id: row.id,
        status: row.status,
        paid: Boolean(row.paid),
        personId: Number(row.person_id),
      }
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
      let { status, paid } = existing;
      if (!paid) {
        // The phone lock doesn't cover the webhook, which locks the row
        // instead. Re-checking "not paid" inside the UPDATE waits on that
        // row lock and re-reads it after the webhook commits: a lead paid
        // meanwhile keeps the snapshot its mails were built from, and the
        // caller sees it paid (409) instead of opening a second checkout.
        const refreshed = await tx.execute<{ id: string }>(sql`
          UPDATE participations pa SET
            metadata = COALESCE(pa.metadata, '{}'::jsonb)
              || jsonb_build_object('contact', ${JSON.stringify(contact)}::jsonb),
            updated_at = NOW()
          WHERE pa.id = ${existing.id} AND NOT ${paidSql}
          RETURNING pa.id
        `);
        if (!refreshed.rows?.length) {
          const cur = await readLeadState(tx, existing.id);
          if (cur) ({ status, paid } = cur);
        }
      }
      await fillInPerson(tx, existing.personId, phone, email);
      return {
        participationId: existing.id,
        status,
        created: false,
        paid,
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
    const cur = await readLeadState(tx, result.participationId);
    return {
      participationId: result.participationId,
      status: cur?.status ?? "pending",
      created: result.created,
      paid: cur?.paid ?? false,
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
      paid: boolean;
    }>(sql`
      SELECT pa.id, pa.status, pa.external_payment_id, pe.name, pe.phone, pe.email,
        pa.metadata->'contact' AS contact, ${paidSql} AS paid
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

    // A paid entrada (paidSql) stays as the operator left it: a row
    // cancelled ("No vendrá") or set back to `pending` in the admin must not
    // flip to `confirmed` on an MP redelivery — admin status wins — nor have
    // its payment id overwritten. Only a refunded payment frees the row for
    // a fresh purchase, which confirms below like a first one.
    if (row.paid || row.external_payment_id === params.paymentId) {
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
          AND id <> ${row.id}
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

    // A repurchase after a refund mails again: drop the first purchase's
    // delivery flags and check-in. A never-paid lead has none. The refunded
    // payment id moves to refundedPaymentIds so a refund alert still
    // pending for it stays retryable (handleReversal looks there).
    const prev = row.external_payment_id;
    await tx.execute(sql`
      UPDATE participations SET
        status = 'confirmed',
        used_at = NULL,
        external_payment_id = ${params.paymentId},
        price_cents = ${params.amountCents},
        currency = ${params.currency},
        metadata = (COALESCE(metadata, '{}'::jsonb)
          - 'buyerEmailSent' - 'buyerEmailSentSendingAt' - 'buyerEmailSentSendingFor'
          - 'hostNotified' - 'hostNotifiedSendingAt' - 'hostNotifiedSendingFor')
          || CASE WHEN ${prev}::text IS NULL THEN '{}'::jsonb
             ELSE jsonb_build_object(
               'refundedPaymentIds',
               COALESCE(metadata->'refundedPaymentIds', '[]'::jsonb)
                 || to_jsonb(${prev}::text)
             ) END,
        updated_at = NOW()
      WHERE id = ${row.id}
    `);
    return { outcome: "confirmed", participant, underpaid };
  });
}

/**
 * jsonb-merge a delivery flag into participations.metadata — only while the
 * claim still belongs to `paymentId` (`${flag}SendingFor`, written by the
 * webhook's claim). A send for a refunded payment that finishes after a
 * repurchase reset the flags must not mark the new purchase as delivered.
 */
export async function markHackeaFlag(
  participationId: string,
  flag: "buyerEmailSent" | "hostNotified",
  paymentId: string,
): Promise<void> {
  const forKey = `${flag}SendingFor`;
  await db.execute(sql`
    UPDATE participations SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(${flag}::text, true),
      updated_at = NOW()
    WHERE id = ${participationId} AND metadata->>${forKey} = ${paymentId}
  `);
}
