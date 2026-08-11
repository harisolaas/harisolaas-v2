import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  Event,
  NewParticipation,
  Participation,
  Person,
} from "@/db/schema";

// ============================================================
// Types
// ============================================================

export interface AttributionTouch {
  linkSlug?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  referrer?: string;
  capturedAt: string; // ISO
}

export type ParticipationStatus =
  | "pending"
  | "confirmed"
  | "waitlist"
  | "cancelled"
  | "no_show"
  | "used";

export interface RecordParticipationParams {
  /** Primary identifier. Trimmed; CITEXT handles case-insensitive uniqueness. */
  email: string;
  name: string;
  phone?: string;
  instagram?: string;

  eventId: string;
  /** Existing id generators stay: BROTE-XXX, PLANT-XXX, SIN-XXX. */
  participationId: string;
  role: string;
  status?: Exclude<ParticipationStatus, "cancelled" | "no_show" | "used">;

  attribution?: AttributionTouch;
  externalPaymentId?: string;
  priceCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  referralNote?: string;
  /** Override opt-in defaults for non-site signups. */
  communicationOptIns?: string[];
  /**
   * When set, the slug is resolved inside the signup transaction. If the
   * resulting link is active with `bypassCapacity=true`, the capacity
   * check is skipped and `referred_by_person_id` is stamped from the
   * link row. Resolving inside the tx closes the race window where an
   * admin could archive the link between request resolution and insert
   * and the signup would still bypass — status is re-checked at write
   * time.
   */
  bypassLinkSlug?: string;
}

export interface RecordParticipationResult {
  personId: number;
  participationId: string;
  /** True when a new participation row was inserted. */
  created: boolean;
  /** True when an existing waitlist row was promoted to confirmed. */
  promoted: boolean;
  /** True if this person row was newly created (vs. upsert into existing). */
  personCreated: boolean;
}

export class CapacityReachedError extends Error {
  constructor(public readonly eventId: string) {
    super(`Capacity reached for event ${eventId}`);
    this.name = "CapacityReachedError";
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Single transactional entry point for every signup/ticket/RSVP.
 *
 * - Upserts person by email (preserves first_seen / first_touch on existing).
 * - Enforces event capacity via row-level lock on the events row.
 * - Inserts or promotes the participation with ON CONFLICT semantics.
 *
 * Side-effects (email send, Meta CAPI) are the caller's responsibility and
 * run AFTER this function returns.
 */
export async function recordParticipation(
  params: RecordParticipationParams,
): Promise<RecordParticipationResult> {
  const email = params.email.trim();
  const name = params.name.trim();
  if (!email) throw new Error("email required");
  if (!name) throw new Error("name required");

  const status: ParticipationStatus = params.status ?? "confirmed";

  return db.transaction(async (tx) => {
    // A cookie-provided linkSlug can reference a link that was later deleted.
    // Rather than failing the whole signup on FK violation, drop the slug
    // (and its mirror on attribution) if the target row no longer exists.
    // Run inside the tx so there's no TOCTOU gap between the existence check
    // and the subsequent INSERT.
    const attribution = await sanitizeAttribution(tx, params.attribution);

    // Resolve the override link inside the tx so archiving between the
    // request hitting the server and the participation insert kills the
    // bypass (and thus enforces capacity as expected). A row-level lock
    // isn't needed — we only read the row, and archiving is monotonic
    // (active → archived doesn't flip back during a signup).
    let bypassCapacity = false;
    let referredByPersonId: number | undefined;
    if (params.bypassLinkSlug) {
      const linkRes = await tx.execute<{
        status: string;
        bypass_capacity: boolean;
        referred_by_person_id: number | null;
      }>(sql`
        SELECT status, bypass_capacity, referred_by_person_id
        FROM links WHERE slug = ${params.bypassLinkSlug}
        LIMIT 1
      `);
      const row = linkRes.rows?.[0];
      if (row && row.status === "active") {
        bypassCapacity = Boolean(row.bypass_capacity);
        referredByPersonId = row.referred_by_person_id ?? undefined;
      }
    }

    // 1. Upsert person. Uses the xmax trick: xmax = 0 iff this row was
    //    freshly INSERTed (ON CONFLICT DO UPDATE sets xmax to the txn id).
    const personResult = await tx.execute<{
      id: number;
      was_inserted: boolean;
    }>(sql`
      INSERT INTO people (email, name, phone, instagram, first_touch, communication_opt_ins)
      VALUES (
        ${email},
        ${name},
        ${params.phone ?? null},
        ${params.instagram ?? null},
        ${attribution ? JSON.stringify(attribution) : null}::jsonb,
        ${
          params.communicationOptIns
            ? sql`${toPgArrayLiteral(params.communicationOptIns)}::text[]`
            : sql`ARRAY['email:transactional','email:marketing']::text[]`
        }
      )
      ON CONFLICT (email) DO UPDATE SET
        -- 'Asistente' is the documented placeholder used when no real
        -- name is available; treat it as if the name slot were empty
        -- so a later write with a real name can replace it. Any other
        -- existing name is sticky. EXCLUDED.name must be non-empty so
        -- the placeholder stays detectable until a real name arrives.
        name = CASE
          WHEN (people.name IS NULL OR people.name = '' OR people.name = 'Asistente')
               AND EXCLUDED.name IS NOT NULL AND EXCLUDED.name <> ''
            THEN EXCLUDED.name
          ELSE people.name
        END,
        phone = COALESCE(people.phone, EXCLUDED.phone),
        instagram = COALESCE(people.instagram, EXCLUDED.instagram),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS was_inserted
    `);

    const personRow = personResult.rows?.[0];
    if (!personRow) {
      throw new Error("person upsert returned no rows");
    }
    const personId = Number(personRow.id);
    const personCreated = Boolean(personRow.was_inserted);

    // 2. Capacity enforcement — lock the event row, then count.
    //    Waitlist rows don't count toward capacity. Promotion of an existing
    //    waitlist row to confirmed IS subject to capacity (it grows the count
    //    by 1), so no exception here. `bypassCapacity` skips this entirely —
    //    invite links deliberately overflow the cap.
    if (status === "confirmed" && !bypassCapacity) {
      const eventRow = await tx.execute<{ capacity: number | null }>(
        sql`SELECT capacity FROM events WHERE id = ${params.eventId} FOR UPDATE`,
      );
      const capacity = eventRow.rows?.[0]?.capacity ?? null;
      if (capacity != null) {
        const countRes = await tx.execute<{ n: number }>(
          sql`SELECT COUNT(*)::int AS n FROM participations
              WHERE event_id = ${params.eventId}
                AND status IN ('confirmed', 'used')`,
        );
        const currentCount = Number(countRes.rows?.[0]?.n ?? 0);
        if (currentCount >= capacity) {
          throw new CapacityReachedError(params.eventId);
        }
      }
    }

    // 3. Upsert participation.
    //    Primary conflict target: id (idempotent retries of the same
    //    participationId). Secondary: (person_id, event_id) uniqueness.
    //    The ORDER BY is load-bearing, not cosmetic. Since companion rows
    //    exist, a buyer can have several rows for one event and an unordered
    //    `limit(1)` returns whichever the planner reaches first — verified:
    //    after the attendee tuple is rewritten by any UPDATE, a seq scan
    //    hands back a companion. That row's `status` drives the waitlist
    //    promotion branch below, and its id becomes every downstream Redis
    //    anchor. Non-companion first, then oldest, so this is total.
    const existing = await tx
      .select()
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.personId, personId),
          eq(schema.participations.eventId, params.eventId),
        ),
      )
      .orderBy(
        sql`(${schema.participations.role} = 'companion')`,
        schema.participations.createdAt,
        schema.participations.id,
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      // Waitlist → confirmed: UPDATE in place, preserve attribution + referral.
      if (row.status === "waitlist" && status === "confirmed") {
        await tx
          .update(schema.participations)
          .set({
            status: "confirmed",
            externalPaymentId:
              params.externalPaymentId ?? row.externalPaymentId,
            priceCents: params.priceCents ?? row.priceCents,
            currency: params.currency ?? row.currency,
            metadata: mergeMetadata(row.metadata, params.metadata),
            updatedAt: sql`NOW()`,
          })
          .where(eq(schema.participations.id, row.id));
        return {
          personId,
          participationId: row.id,
          created: false,
          promoted: true,
          personCreated,
        };
      }

      // Idempotent no-op: same-or-earlier status, same person+event.
      return {
        personId,
        participationId: row.id,
        created: false,
        promoted: false,
        personCreated,
      };
    }

    // Fresh insert.
    const insertRes = await tx
      .insert(schema.participations)
      .values({
        id: params.participationId,
        personId,
        eventId: params.eventId,
        buyerPersonId: personId,
        role: params.role,
        status,
        attribution: attribution ?? null,
        linkSlug: attribution?.linkSlug ?? null,
        referredByPersonId: referredByPersonId ?? null,
        referralNote: params.referralNote ?? null,
        externalPaymentId: params.externalPaymentId ?? null,
        priceCents: params.priceCents ?? null,
        currency: params.currency ?? null,
        metadata: params.metadata ?? {},
      } satisfies NewParticipation)
      .onConflictDoNothing({ target: schema.participations.id })
      .returning({ id: schema.participations.id });

    const created = insertRes.length > 0;

    return {
      personId,
      participationId: params.participationId,
      created,
      promoted: false,
      personCreated: personCreated && created,
    };
  });
}

export interface AddCompanionTicketsParams {
  personId: number;
  eventId: string;
  /**
   * One id per extra ticket, in the order they should be numbered.
   *
   * The caller is expected to derive these deterministically from the
   * payment, not to mint fresh ones: `(person_id, event_id)` no longer
   * constrains companion rows, so `ON CONFLICT (id) DO NOTHING` below is the
   * ONLY thing standing between two concurrent webhook deliveries of one
   * payment and a double issuance. Random ids per invocation defeat it.
   */
  ticketIds: string[];
  externalPaymentId: string;
  /** Per ticket, never the basket total — revenue reporting sums this column. */
  priceCents: number;
  currency: string;
  attribution?: AttributionTouch;
  /** Merged onto every row. Carries `invite`, which the payout report reads. */
  metadata?: Record<string, unknown>;
}

export interface AddCompanionTicketsResult {
  /** Inserted by THIS call, in the order requested. */
  createdIds: string[];
  /**
   * Already present with the same id — a concurrent delivery got there
   * first. Success, not shortfall: the caller alerts when it issued fewer
   * tickets than were paid for, and a retry must not trip that.
   */
  existingIds: string[];
}

/**
 * Extra tickets for a buyer who already holds one for this event.
 *
 * Companion rows exist because a person can buy for friends: they carry
 * `role = 'companion'`, which is exactly what the partial unique index on
 * `(person_id, event_id)` excludes. `buyer_person_id` records who paid.
 *
 * Deliberately separate from `recordParticipation`: that function is the
 * shared entry point for Sinergia, plant signups and the admin, and it
 * short-circuits on an existing person/event row by design. Widening it for
 * this case would put every one of those flows on the same revert boundary.
 */
export async function addCompanionTickets(
  params: AddCompanionTicketsParams,
): Promise<AddCompanionTicketsResult> {
  if (params.ticketIds.length === 0) {
    return { createdIds: [], existingIds: [] };
  }

  return db.transaction(async (tx) => {
    // Same reason as recordParticipation (:110): a cookie can name a link
    // that was deleted since. `participations.link_slug` is a foreign key, so
    // an unsanitized slug raises 23503 — and here that would happen AFTER
    // MercadoPago has taken the money.
    const attribution = await sanitizeAttribution(tx, params.attribution);

    const rows = params.ticketIds.map((id, i) => ({
      id,
      personId: params.personId,
      eventId: params.eventId,
      buyerPersonId: params.personId,
      role: "companion",
      status: "confirmed",
      attribution: attribution ?? null,
      linkSlug: attribution?.linkSlug ?? null,
      externalPaymentId: params.externalPaymentId,
      priceCents: params.priceCents,
      currency: params.currency,
      // `seq` is the position within the purchase, and it is load-bearing.
      // Every row of a batch shares one `created_at` (it defaults to the
      // transaction timestamp), so ordering by `created_at, id` really
      // orders by id — and the ids are sha256-derived, so that is a
      // different sequence from the one the buyer's email was numbered in.
      // Whoever reads this group back has to see the SAME order the email
      // showed, or "Entrada 2 de 3" names the wrong person's ticket.
      metadata: { ...(params.metadata ?? {}), seq: i },
    })) satisfies NewParticipation[];

    const inserted = await tx
      .insert(schema.participations)
      .values(rows)
      .onConflictDoNothing({ target: schema.participations.id })
      .returning({ id: schema.participations.id });

    const createdSet = new Set(inserted.map((r) => r.id));
    // Preserve the requested order: the caller pairs these with tree numbers.
    const createdIds = params.ticketIds.filter((id) => createdSet.has(id));
    const notCreated = params.ticketIds.filter((id) => !createdSet.has(id));

    if (notCreated.length === 0) return { createdIds, existingIds: [] };

    // Confirm the rest are genuinely present rather than assuming the
    // conflict was on `id`. Reporting a row as "existing" that isn't there
    // would silence the caller's shortfall alert on a real lost insert.
    const present = await tx
      .select({ id: schema.participations.id })
      .from(schema.participations)
      .where(inArray(schema.participations.id, notCreated));
    const presentSet = new Set(present.map((r) => r.id));

    return {
      createdIds,
      existingIds: notCreated.filter((id) => presentSet.has(id)),
    };
  });
}

export interface SinergiaDonationResult {
  /** True when this call was the one that stamped the payment on the row. */
  applied: boolean;
  /** True when the receipt email was already flagged sent before this call. */
  receiptAlreadySent: boolean;
}

/**
 * Record a MercadoPago donation against an existing Sinergia participation.
 *
 * Sinergia RSVPs are always free at form-submit time; a donation is a
 * second, optional step. The webhook calls this once MP confirms a payment.
 * Safe to call twice with the same paymentId: returns applied=false on the
 * second call so the caller can skip the receipt email.
 */
export async function recordSinergiaDonation(params: {
  participationId: string;
  amountCents: number;
  currency: string;
  paymentId: string;
}): Promise<SinergiaDonationResult> {
  const { participationId, amountCents, currency, paymentId } = params;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({
        externalPaymentId: schema.participations.externalPaymentId,
        metadata: schema.participations.metadata,
      })
      .from(schema.participations)
      .where(eq(schema.participations.id, participationId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`participation ${participationId} not found`);
    }

    const meta = (existing[0].metadata as Record<string, unknown>) ?? {};
    const existingDonation =
      meta.donation && typeof meta.donation === "object"
        ? (meta.donation as Record<string, unknown>)
        : null;

    // Any prior payment on this participation is immutable. Covers two
    // cases with a single guard: (a) webhook retries for the same
    // paymentId — the normal idempotent replay; (b) a second, distinct
    // payment ever completing for the same RSVP (shouldn't happen since
    // MP checkouts are one-shot, but if it does we surface via logs +
    // manual ops rather than silently overwriting the first donation).
    if (existing[0].externalPaymentId || existingDonation) {
      if (
        existing[0].externalPaymentId &&
        existing[0].externalPaymentId !== paymentId
      ) {
        console.warn("Sinergia: second distinct payment for same rsvp", {
          participationId,
          stored: existing[0].externalPaymentId,
          incoming: paymentId,
        });
      }
      return {
        applied: false,
        receiptAlreadySent: Boolean(existingDonation?.receiptSent),
      };
    }

    const nextDonation = {
      amountCents,
      currency,
      paymentId,
      receiptSent: false,
    };

    await tx
      .update(schema.participations)
      .set({
        externalPaymentId: paymentId,
        priceCents: amountCents,
        currency,
        metadata: { ...meta, donation: nextDonation },
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.participations.id, participationId));

    return { applied: true, receiptAlreadySent: false };
  });
}

/**
 * Flip metadata.donation.receiptSent to true. Called after the receipt
 * email succeeds so webhook retries don't double-send.
 */
export async function markSinergiaDonationReceiptSent(
  participationId: string,
): Promise<void> {
  await db
    .update(schema.participations)
    .set({
      metadata: sql`
        jsonb_set(
          COALESCE(${schema.participations.metadata}, '{}'::jsonb),
          '{donation,receiptSent}',
          'true'::jsonb,
          true
        )
      `,
      updatedAt: sql`NOW()`,
    })
    .where(eq(schema.participations.id, participationId));
}

/**
 * Promote an existing waitlist participation to confirmed, attaching payment
 * info. Thin wrapper around recordParticipation for readability at the call
 * site (e.g. when a waitlisted buyer completes checkout).
 */
export async function promoteWaitlist(
  participationId: string,
  paymentInfo: {
    externalPaymentId?: string;
    priceCents?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<RecordParticipationResult> {
  const row = await db
    .select({
      id: schema.participations.id,
      personId: schema.participations.personId,
      eventId: schema.participations.eventId,
      role: schema.participations.role,
      person: {
        email: schema.people.email,
        name: schema.people.name,
      },
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.id, participationId))
    .limit(1);

  if (row.length === 0) {
    throw new Error(`participation ${participationId} not found`);
  }
  const p = row[0];
  if (!p.person.email) {
    throw new Error(`person ${p.personId} has no email`);
  }

  return recordParticipation({
    email: p.person.email,
    name: p.person.name,
    eventId: p.eventId,
    participationId: p.id,
    role: p.role,
    status: "confirmed",
    externalPaymentId: paymentInfo.externalPaymentId,
    priceCents: paymentInfo.priceCents,
    currency: paymentInfo.currency,
    metadata: paymentInfo.metadata,
  });
}

/**
 * Person-only upsert for admin flows where there's no participation yet.
 * Returns the person row, creating if missing.
 */
export async function upsertPerson(params: {
  email: string;
  name: string;
  phone?: string;
  instagram?: string;
  firstTouch?: AttributionTouch | null;
}): Promise<{ person: Person; created: boolean }> {
  const email = params.email.trim();
  if (!email) throw new Error("email required");
  // The 'Asistente' placeholder must stay detectable until a real name
  // replaces it: an empty incoming name would let the CASE below blank
  // out the placeholder, so reject it here.
  const name = params.name.trim();
  if (!name) throw new Error("name required");

  const res = await db.execute<Person & { was_inserted: boolean }>(sql`
    INSERT INTO people (email, name, phone, instagram, first_touch)
    VALUES (
      ${email},
      ${name},
      ${params.phone ?? null},
      ${params.instagram ?? null},
      ${params.firstTouch ? JSON.stringify(params.firstTouch) : null}::jsonb
    )
    ON CONFLICT (email) DO UPDATE SET
      -- 'Asistente' is the documented placeholder; treat it as empty so
      -- a later write with a real name can replace it. EXCLUDED.name
      -- must be non-empty so the placeholder stays detectable.
      name = CASE
        WHEN (people.name IS NULL OR people.name = '' OR people.name = 'Asistente')
             AND EXCLUDED.name IS NOT NULL AND EXCLUDED.name <> ''
          THEN EXCLUDED.name
        ELSE people.name
      END,
      phone = COALESCE(people.phone, EXCLUDED.phone),
      instagram = COALESCE(people.instagram, EXCLUDED.instagram),
      updated_at = NOW()
    RETURNING *, (xmax = 0) AS was_inserted
  `);

  const row = res.rows?.[0];
  if (!row) throw new Error("upsertPerson returned no rows");

  const { was_inserted, ...person } = row;
  return {
    person: person as Person,
    created: Boolean(was_inserted),
  };
}

/**
 * Full drilldown for a person: profile + every participation joined to its
 * event. Used by admin UI and referral reconciliation flows.
 */
export async function getPersonByEmail(email: string): Promise<{
  person: Person;
  participations: (Participation & { event: Event })[];
} | null> {
  const personRows = await db
    .select()
    .from(schema.people)
    .where(eq(schema.people.email, email.trim()))
    .limit(1);

  if (personRows.length === 0) return null;
  const person = personRows[0];

  const parts = await db
    .select({
      participation: schema.participations,
      event: schema.events,
    })
    .from(schema.participations)
    .innerJoin(
      schema.events,
      eq(schema.events.id, schema.participations.eventId),
    )
    .where(eq(schema.participations.personId, person.id));

  return {
    person,
    participations: parts.map((r) => ({ ...r.participation, event: r.event })),
  };
}

// ============================================================
// Internals
// ============================================================

function mergeMetadata(
  existing: unknown,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...(incoming ?? {}) };
}

/**
 * Serialize a string array into a Postgres array literal: {"a","b"}.
 * Uses JSON quoting so commas/colons inside values are safe.
 */
function toPgArrayLiteral(values: readonly string[]): string {
  return "{" + values.map((v) => JSON.stringify(v)).join(",") + "}";
}

/**
 * If attribution.linkSlug points at a link row that doesn't exist, strip it
 * (and the duplicated `content` field when it matches). Prevents FK
 * violations on signup when a user's `haris_link` cookie outlived the link
 * it referenced.
 */
type QueryRunner = Pick<typeof db, "execute">;

async function sanitizeAttribution(
  runner: QueryRunner,
  attribution: AttributionTouch | undefined,
): Promise<AttributionTouch | undefined> {
  if (!attribution?.linkSlug) return attribution;

  const res = await runner.execute<{ exists: boolean }>(sql`
    SELECT EXISTS(SELECT 1 FROM links WHERE slug = ${attribution.linkSlug}) AS exists
  `);
  if (res.rows?.[0]?.exists) return attribution;

  const { linkSlug: _stale, ...rest } = attribution;
  void _stale;
  return rest;
}
