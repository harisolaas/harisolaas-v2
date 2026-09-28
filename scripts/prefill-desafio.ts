/**
 * Load the starting content of the Desafío "15 días meditando juntos" into
 * `challenge_days`: all 15 days from `src/data/desafio-prefill.ts`, in the
 * design's shape, all published.
 *
 *   npx tsx scripts/prefill-desafio.ts                       # dry run (default)
 *   npx tsx scripts/prefill-desafio.ts --execute             # insert missing days
 *   npx tsx scripts/prefill-desafio.ts --execute --replace   # OVERWRITE every day
 *   npx tsx scripts/prefill-desafio.ts --env-file=.env.prod.local [--execute]
 *
 * Default (`--execute`) never overwrites: each day is `INSERT … ON CONFLICT
 * DO NOTHING`, so a day Hari already saved in /admin/desafio (published or
 * draft) is left exactly as it is and reported as skipped. Re-running is safe.
 *
 * `--replace` overwrites every existing row with the prefill (ON CONFLICT DO
 * UPDATE), discarding edits made in the admin. It exists to reset non-prod
 * branches (e.g. a preview branch holding pre-0008 rows). Don't use it on
 * prod unless Hari explicitly asks to throw away his edits.
 *
 * `--execute` also creates the `events` row if it's missing (same values as
 * `ensureDesafioEvent`, which can't be imported here — it's `server-only`).
 * `challenge_days.event_id` has a FK onto it.
 *
 * The dry run only reads: it lists which days would be inserted / skipped /
 * replaced. It needs migrations 0007 + 0008 applied to report that; without
 * the table it still prints the plan.
 *
 * Env comes from `.env.local` unless `--env-file` says otherwise. Variables
 * already set in the shell win (dotenv doesn't override). IMPORTANT: check
 * the DB host it prints before passing --execute.
 */
import { config as loadEnv } from "dotenv";
import { DESAFIO_EVENT_ID } from "../src/data/desafio";
import { DESAFIO_PREFILL } from "../src/data/desafio-prefill";
import {
  buildDesafioEventRow,
  validateDayInput,
  type DayInput,
} from "../src/lib/desafio";
// None of the imports above read env at load time; the DB client (which
// does) is imported lazily, after loadEnv below.

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function value(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1) || undefined;
}

const ENV_FILE = value("--env-file") ?? ".env.local";
loadEnv({ path: ENV_FILE });

const DRY_RUN = !flag("--execute");
const REPLACE = flag("--replace");
const UPDATED_BY = "prefill-desafio";

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function validatedPlan(): Array<{ dia: number; input: DayInput }> {
  const problems: string[] = [];
  const days = DESAFIO_PREFILL.map((d) => {
    // The same validation the admin PUT applies, so nothing lands in the
    // table that the editor would refuse to save back.
    const res = validateDayInput({ ...d, publicado: true });
    if (!res.ok) problems.push(`day ${d.dia}: ${res.error}`);
    return { dia: d.dia, input: res.ok ? res.value : null };
  });
  if (problems.length > 0) {
    console.error("\n✗ Prefill data fails the admin validation:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  return days.map((d) => ({ dia: d.dia, input: d.input! }));
}

/** DayInput → challenge_days columns (same mapping as upsertChallengeDay). */
function toColumns(input: DayInput) {
  return {
    title: input.titulo,
    body: input.intro,
    introVideoUrl: input.introVideo,
    meditationTitle: input.meditacion,
    mediaUrl: input.meditacionVideo,
    durationLabel: input.duracion,
    reflection: input.reflexion,
    reflectionVideoUrl: input.reflexionVideo,
    published: input.publicado,
    updatedByEmail: UPDATED_BY,
  };
}

async function existingDays(): Promise<Set<number> | null> {
  if (!process.env.DATABASE_URL) return null;
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");
  try {
    const res = await db.execute<{ day_number: number }>(sql`
      SELECT day_number FROM challenge_days WHERE event_id = ${DESAFIO_EVENT_ID}
    `);
    return new Set((res.rows ?? []).map((r) => Number(r.day_number)));
  } catch (err) {
    console.warn(
      `(could not read challenge_days — are migrations 0007/0008 applied? ${(err as Error).message})`,
    );
    return null;
  }
}

async function main() {
  const plan = validatedPlan();

  console.log(`\nEnv file: ${ENV_FILE}`);
  console.log(`DB host:  ${dbHost()}`);
  console.log(
    `Mode:     ${DRY_RUN ? "DRY RUN" : "EXECUTE"}${REPLACE ? " + REPLACE" : ""}`,
  );
  console.log(`Event:    ${DESAFIO_EVENT_ID}\n`);

  if (REPLACE) {
    console.warn(
      "⚠️  --replace: every existing day will be OVERWRITTEN with the prefill,\n" +
        "   discarding whatever was edited in /admin/desafio. Meant for\n" +
        "   non-prod resets. Check the DB host above.\n",
    );
  }

  if (DRY_RUN) {
    const existing = await existingDays();
    for (const { dia, input } of plan) {
      const status =
        existing === null
          ? "would insert if missing"
          : existing.has(dia)
            ? REPLACE
              ? "would REPLACE existing row"
              : "would skip (already has a row)"
            : "would insert";
      console.log(
        `  día ${String(dia).padStart(2)} · ${status.padEnd(30)} · ${input.titulo} · ${input.duracion}`,
      );
    }
    console.log("\nDry run — nothing written. Pass --execute to write.\n");
    return;
  }

  const { db, schema } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  await db
    .insert(schema.events)
    .values(buildDesafioEventRow(DESAFIO_EVENT_ID))
    .onConflictDoNothing();
  console.log(`✓ events row ${DESAFIO_EVENT_ID} present`);

  let written = 0;
  let skipped = 0;
  for (const { dia, input } of plan) {
    const columns = toColumns(input);
    const target = [schema.challengeDays.eventId, schema.challengeDays.dayNumber];
    const insert = db
      .insert(schema.challengeDays)
      .values({ eventId: DESAFIO_EVENT_ID, dayNumber: dia, ...columns });
    const rows = await (REPLACE
      ? insert.onConflictDoUpdate({
          target,
          set: { ...columns, updatedAt: sql`now()` },
        })
      : insert.onConflictDoNothing({ target })
    ).returning({ dayNumber: schema.challengeDays.dayNumber });
    const didWrite = rows.length > 0;
    if (didWrite) written++;
    else skipped++;
    const label = didWrite
      ? REPLACE
        ? "written"
        : "inserted"
      : "skipped (existing)";
    console.log(
      `  día ${String(dia).padStart(2)} · ${label.padEnd(18)} · ${input.titulo}`,
    );
  }

  console.log(`\nDone: ${written} written, ${skipped} skipped.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
