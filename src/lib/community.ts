import { and, eq, sql } from "drizzle-orm";
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

  // A cookie-provided linkSlug can reference a link that was later deleted.
  // Rather than failing the whole signup on FK violation, drop the slug
  // (and its mirror on attribution) if the target row no longer exists.
  const attribution = await sanitizeAttribution(params.attribution);

  return db.transaction(async (tx) => {
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
        name = COALESCE(NULLIF(people.name, ''), EXCLUDED.name),
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
    //    by 1), so no exception here.
    if (status === "confirmed") {
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
    const existing = await tx
      .select()
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.personId, personId),
          eq(schema.participations.eventId, params.eventId),
        ),
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

  const res = await db.execute<Person & { was_inserted: boolean }>(sql`
    INSERT INTO people (email, name, phone, instagram, first_touch)
    VALUES (
      ${email},
      ${params.name},
      ${params.phone ?? null},
      ${params.instagram ?? null},
      ${params.firstTouch ? JSON.stringify(params.firstTouch) : null}::jsonb
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(NULLIF(people.name, ''), EXCLUDED.name),
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
async function sanitizeAttribution(
  attribution: AttributionTouch | undefined,
): Promise<AttributionTouch | undefined> {
  if (!attribution?.linkSlug) return attribution;

  const res = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS(SELECT 1 FROM links WHERE slug = ${attribution.linkSlug}) AS exists
  `);
  if (res.rows?.[0]?.exists) return attribution;

  const { linkSlug: _stale, ...rest } = attribution;
  void _stale;
  return rest;
}
