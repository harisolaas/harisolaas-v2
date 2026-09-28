/**
 * Load the starting content of the Desafío "15 días meditando" into
 * `challenge_days`: one YouTube meditation + title + short text per day,
 * from `src/data/desafio-prefill.ts`, all published.
 *
 *   npx tsx scripts/prefill-desafio.ts                       # dry run (default)
 *   npx tsx scripts/prefill-desafio.ts --execute             # write
 *   npx tsx scripts/prefill-desafio.ts --env-file=.env.prod.local [--execute]
 *
 * Never overwrites: each day is `INSERT … ON CONFLICT DO NOTHING`, so a day
 * Hari already saved in /admin/desafio (published or draft) is left exactly
 * as it is and reported as skipped. Re-running is safe.
 *
 * `--execute` also creates the `events` row if it's missing (same values as
 * `ensureDesafioEvent`, which can't be imported here — it's `server-only`).
 * `challenge_days.event_id` has a FK onto it.
 *
 * The dry run only reads: it lists which days would be inserted and which
 * already exist. It needs migration 0007 applied to report that; without the
 * table it still prints the plan.
 *
 * Env comes from `.env.local` unless `--env-file` says otherwise. Variables
 * already set in the shell win (dotenv doesn't override). IMPORTANT: check
 * the DB host it prints before passing --execute.
 */
import { config as loadEnv } from "dotenv";
import { DESAFIO_EVENT_ID, desafioStartDate } from "../src/data/desafio";
import { DESAFIO_PREFILL } from "../src/data/desafio-prefill";
import { buildDesafioEventRow, validateDayInput } from "../src/lib/desafio";
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

function validatedPlan() {
  const problems: string[] = [];
  const days = DESAFIO_PREFILL.map((d) => {
    // The same validation the admin PUT applies, so nothing lands in the
    // table that the editor would refuse to save back.
    const res = validateDayInput({
      title: d.title,
      body: d.body,
      mediaUrl: d.mediaUrl,
      published: true,
    });
    if (!res.ok) problems.push(`day ${d.dayNumber}: ${res.error}`);
    return { dayNumber: d.dayNumber, input: res.ok ? res.value : null };
  });
  if (problems.length > 0) {
    console.error("\n✗ Prefill data fails the admin validation:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  return days.map((d) => ({ dayNumber: d.dayNumber, input: d.input! }));
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
      `(could not read challenge_days — is migration 0007 applied? ${(err as Error).message})`,
    );
    return null;
  }
}

async function main() {
  const plan = validatedPlan();

  console.log(`\nEnv file: ${ENV_FILE}`);
  console.log(`DB host:  ${dbHost()}`);
  console.log(`Mode:     ${DRY_RUN ? "DRY RUN" : "EXECUTE"}`);
  console.log(`Event:    ${DESAFIO_EVENT_ID} (start ${desafioStartDate()})\n`);

  if (DRY_RUN) {
    const existing = await existingDays();
    for (const { dayNumber, input } of plan) {
      const status =
        existing === null
          ? "would insert if missing"
          : existing.has(dayNumber)
            ? "would skip (already has a row)"
            : "would insert";
      console.log(
        `  día ${String(dayNumber).padStart(2)} · ${status.padEnd(30)} · ${input.title}`,
      );
    }
    console.log("\nDry run — nothing written. Pass --execute to insert.\n");
    return;
  }

  const { db, schema } = await import("../src/db");

  await db
    .insert(schema.events)
    .values(buildDesafioEventRow(DESAFIO_EVENT_ID, new Date()))
    .onConflictDoNothing();
  console.log(`✓ events row ${DESAFIO_EVENT_ID} present`);

  let inserted = 0;
  let skipped = 0;
  for (const { dayNumber, input } of plan) {
    const rows = await db
      .insert(schema.challengeDays)
      .values({
        eventId: DESAFIO_EVENT_ID,
        dayNumber,
        title: input.title,
        body: input.body,
        mediaUrl: input.mediaUrl,
        published: input.published,
        updatedByEmail: UPDATED_BY,
      })
      .onConflictDoNothing({
        target: [schema.challengeDays.eventId, schema.challengeDays.dayNumber],
      })
      .returning({ dayNumber: schema.challengeDays.dayNumber });
    const didInsert = rows.length > 0;
    if (didInsert) inserted++;
    else skipped++;
    console.log(
      `  día ${String(dayNumber).padStart(2)} · ${(didInsert ? "inserted" : "skipped (existing)").padEnd(18)} · ${input.title}`,
    );
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
