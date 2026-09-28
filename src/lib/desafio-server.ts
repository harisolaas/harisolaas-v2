import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DESAFIO_EVENT_ID, desafioConfig } from "@/data/desafio";
import {
  buildDesafioDays,
  buildDesafioEventRow,
  type ChallengeDayAdminRow,
  type DayInput,
  type DesafioData,
} from "@/lib/desafio";

/**
 * Lazily create the desafío `events` row. Idempotent (ON CONFLICT DO
 * NOTHING), same pattern as `ensureSinergiaEvent`. Called from the admin
 * panel GET and the day editor PUT, so no manual prod data insert is ever
 * needed — `challenge_days.event_id` needs the row before the first save.
 */
export async function ensureDesafioEvent(): Promise<string> {
  await db
    .insert(schema.events)
    .values(buildDesafioEventRow(DESAFIO_EVENT_ID))
    .onConflictDoNothing();
  return DESAFIO_EVENT_ID;
}

const dayColumns = {
  dayNumber: schema.challengeDays.dayNumber,
  title: schema.challengeDays.title,
  body: schema.challengeDays.body,
  introVideoUrl: schema.challengeDays.introVideoUrl,
  meditationTitle: schema.challengeDays.meditationTitle,
  mediaUrl: schema.challengeDays.mediaUrl,
  durationLabel: schema.challengeDays.durationLabel,
  reflection: schema.challengeDays.reflection,
  reflectionVideoUrl: schema.challengeDays.reflectionVideoUrl,
  published: schema.challengeDays.published,
  updatedAt: schema.challengeDays.updatedAt,
  updatedByEmail: schema.challengeDays.updatedByEmail,
};

export async function getChallengeDayRows(
  eventId: string,
): Promise<ChallengeDayAdminRow[]> {
  return db
    .select(dayColumns)
    .from(schema.challengeDays)
    .where(eq(schema.challengeDays.eventId, eventId))
    .orderBy(asc(schema.challengeDays.dayNumber));
}

/** Insert-or-replace one day. Full-replace semantics (see validateDayInput). */
export async function upsertChallengeDay(
  eventId: string,
  dayNumber: number,
  input: DayInput,
  email: string,
): Promise<ChallengeDayAdminRow> {
  const content = {
    title: input.titulo,
    body: input.intro,
    introVideoUrl: input.introVideo,
    meditationTitle: input.meditacion,
    mediaUrl: input.meditacionVideo,
    durationLabel: input.duracion,
    reflection: input.reflexion,
    reflectionVideoUrl: input.reflexionVideo,
    published: input.publicado,
    updatedByEmail: email,
  };
  const [row] = await db
    .insert(schema.challengeDays)
    .values({ eventId, dayNumber, ...content })
    .onConflictDoUpdate({
      target: [schema.challengeDays.eventId, schema.challengeDays.dayNumber],
      set: { ...content, updatedAt: sql`now()` },
    })
    .returning(dayColumns);
  return row;
}

/**
 * The public page's data: event config + all 15 days. Content only on
 * published days (see `buildDesafioDays`). Never throws: if the DB read
 * fails it logs and returns every day unpublished, so the page still
 * renders (welcome + WhatsApp button) instead of erroring.
 */
export async function loadDesafio(): Promise<DesafioData> {
  let rows: ChallengeDayAdminRow[] = [];
  try {
    rows = await getChallengeDayRows(DESAFIO_EVENT_ID);
  } catch (err) {
    console.error("[desafio] failed to load days", err);
  }
  return { config: desafioConfig, dias: buildDesafioDays(rows) };
}
