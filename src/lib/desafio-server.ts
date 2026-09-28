import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DESAFIO_EVENT_ID, type DesafioLocale } from "@/data/desafio";
import {
  buildDesafioEventRow,
  buildPublicDays,
  type ChallengeDayAdminRow,
  type DayInput,
  type DesafioPublicDay,
} from "@/lib/desafio";

/**
 * Lazily create the desafío `events` row. Idempotent (ON CONFLICT DO
 * NOTHING), same pattern as `ensureSinergiaEvent`. Called from the admin
 * panel GET, the day editor PUT and the public registration, so no manual
 * prod data insert is ever needed — `challenge_days.event_id` needs the row
 * to exist before the first day is saved.
 */
export async function ensureDesafioEvent(now: Date = new Date()): Promise<string> {
  await db
    .insert(schema.events)
    .values(buildDesafioEventRow(DESAFIO_EVENT_ID, now))
    .onConflictDoNothing();
  return DESAFIO_EVENT_ID;
}

export async function getChallengeDayRows(
  eventId: string,
): Promise<ChallengeDayAdminRow[]> {
  const rows = await db
    .select({
      dayNumber: schema.challengeDays.dayNumber,
      title: schema.challengeDays.title,
      body: schema.challengeDays.body,
      mediaUrl: schema.challengeDays.mediaUrl,
      published: schema.challengeDays.published,
      updatedAt: schema.challengeDays.updatedAt,
      updatedByEmail: schema.challengeDays.updatedByEmail,
    })
    .from(schema.challengeDays)
    .where(eq(schema.challengeDays.eventId, eventId))
    .orderBy(asc(schema.challengeDays.dayNumber));
  return rows;
}

/** Insert-or-replace one day. Full-replace semantics (see validateDayInput). */
export async function upsertChallengeDay(
  eventId: string,
  dayNumber: number,
  input: DayInput,
  email: string,
): Promise<ChallengeDayAdminRow> {
  const [row] = await db
    .insert(schema.challengeDays)
    .values({
      eventId,
      dayNumber,
      title: input.title,
      body: input.body,
      mediaUrl: input.mediaUrl,
      published: input.published,
      updatedByEmail: email,
    })
    .onConflictDoUpdate({
      target: [schema.challengeDays.eventId, schema.challengeDays.dayNumber],
      set: {
        title: input.title,
        body: input.body,
        mediaUrl: input.mediaUrl,
        published: input.published,
        updatedByEmail: email,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return {
    dayNumber: row.dayNumber,
    title: row.title,
    body: row.body,
    mediaUrl: row.mediaUrl,
    published: row.published,
    updatedAt: row.updatedAt,
    updatedByEmail: row.updatedByEmail,
  };
}

export interface DesafioRegistrantRow {
  participationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  status: string;
}

/** Confirmed/used registrants, newest first. */
export async function listDesafioRegistrants(
  eventId: string,
): Promise<DesafioRegistrantRow[]> {
  const res = await db.execute<{
    participation_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    created_at: string | Date;
    status: string;
  }>(sql`
    SELECT
      p.id AS participation_id,
      people.name,
      people.email,
      people.phone,
      p.created_at,
      p.status
    FROM participations p
    JOIN people ON people.id = p.person_id
    WHERE p.event_id = ${eventId}
      AND p.status IN ('confirmed', 'used')
    ORDER BY p.created_at DESC
  `);
  return (res.rows ?? []).map((r) => ({
    participationId: r.participation_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status,
  }));
}

/** Count of confirmed/used registrations — the host email's running total. */
export async function countDesafioRegistrants(eventId: string): Promise<number> {
  const res = await db.execute<{ n: string | number }>(sql`
    SELECT count(*) AS n FROM participations
    WHERE event_id = ${eventId} AND status IN ('confirmed', 'used')
  `);
  return Number(res.rows?.[0]?.n ?? 0);
}

/** The page's data loader: all 15 days, content only on unlocked+published. */
export async function loadPublicDesafioDays(
  now: Date,
  locale: DesafioLocale,
): Promise<DesafioPublicDay[]> {
  return buildPublicDays(await getChallengeDayRows(DESAFIO_EVENT_ID), now, locale);
}
