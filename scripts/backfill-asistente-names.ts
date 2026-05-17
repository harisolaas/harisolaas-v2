/**
 * One-shot backfill: recover real buyer names (and phones, when possible)
 * for `people` rows the MP webhook stamped with the literal "Asistente"
 * because every buyer-info source came back empty at write time.
 *
 * Root cause and fix live in `src/app/api/sinergia-parrafo/webhook/route.ts`
 * and `src/lib/mp-buyer-info.ts`. This script repairs rows the old code
 * already wrote.
 *
 * Strategy, per "Asistente" person row:
 *   1. Find their most recent participation that has a non-null
 *      `external_payment_id`.
 *   2. Fetch the MP payment via the SDK.
 *   3. Read the real name from `additional_info.payer.first_name` (+
 *      last_name when present), then fall back to `payer.first_name +
 *      last_name`.
 *   4. UPDATE `people.name` when a real name was recovered.
 *   5. Also probe the email-keyed Redis stash
 *      (`sinergia-parrafo:checkout-by-email:{email}`) — when present and
 *      the row has no phone, recover the phone too.
 *
 * Usage:
 *   npx tsx scripts/backfill-asistente-names.ts            # dry-run (default)
 *   npx tsx scripts/backfill-asistente-names.ts --apply    # write
 *
 * Idempotent. Re-running on the same rows is a no-op (rows already
 * patched no longer match the filter).
 *
 * Operator note: requires `MP_ACCESS_TOKEN`, `DATABASE_URL`, and
 * `REDIS_URL` in `.env.local`. The MP token MUST be production
 * (`APP_USR-...`) to fetch real payments. Run with `--apply` only after
 * a clean dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  resolveBuyerInfo,
  type CheckoutMetaLike,
  type MpPaymentLike,
} from "@/lib/mp-buyer-info";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY_RUN = !APPLY;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("DATABASE_URL");

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: requireEnv("MP_ACCESS_TOKEN"),
    });
  }
  return _mp;
}

interface StaleRow {
  person_id: number;
  email: string;
  current_name: string;
  current_phone: string | null;
  participation_id: string;
  external_payment_id: string;
  event_id: string;
  [key: string]: unknown;
}

async function readEmailStash(
  redisLike: { get(key: string): Promise<string | null> } | null,
  email: string,
): Promise<CheckoutMetaLike | null> {
  if (!redisLike) return null;
  const key = `sinergia-parrafo:checkout-by-email:${email.trim().toLowerCase()}`;
  try {
    const raw = await redisLike.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutMetaLike;
  } catch (err) {
    console.warn(`  ! redis read failed for ${email}:`, err);
    return null;
  }
}

async function main() {
  console.log(
    `\n== backfill-asistente-names — ${DRY_RUN ? "DRY RUN" : "APPLY"} ==\n`,
  );

  const { db } = await import("@/db");

  // Connect to Redis only if REDIS_URL is set — without it we just skip
  // phone recovery and continue with the name-only path.
  let redis: { get(key: string): Promise<string | null> } | null = null;
  if (process.env.REDIS_URL) {
    try {
      const { getRedis } = await import("@/lib/redis");
      redis = await getRedis();
    } catch (err) {
      console.warn("Redis connect failed — phone recovery disabled:", err);
    }
  } else {
    console.warn(
      "REDIS_URL not set — phone recovery from checkout stashes is disabled.",
    );
  }

  // Pick rows to repair: people.name = 'Asistente' AND they have at
  // least one participation with an external_payment_id. The window
  // function picks the most recent participation per person so we only
  // make one MP fetch per stale row.
  const rowsRes = await db.execute<StaleRow>(sql`
    WITH ranked AS (
      SELECT
        p.id            AS person_id,
        p.email::text   AS email,
        p.name          AS current_name,
        p.phone         AS current_phone,
        pt.id           AS participation_id,
        pt.external_payment_id,
        pt.event_id,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY pt.created_at DESC) AS rn
      FROM people p
      JOIN participations pt ON pt.person_id = p.id
      WHERE p.name = 'Asistente'
        AND pt.external_payment_id IS NOT NULL
    )
    SELECT
      person_id, email, current_name, current_phone,
      participation_id, external_payment_id, event_id
    FROM ranked
    WHERE rn = 1
    ORDER BY person_id
  `);

  const rows = rowsRes.rows ?? [];
  console.log(`Found ${rows.length} person rows with name='Asistente'.\n`);
  if (rows.length === 0) {
    console.log("Nothing to do.\n");
    return;
  }

  let updatedNames = 0;
  let updatedPhones = 0;
  let skippedNoRecovery = 0;
  let skippedMpError = 0;

  for (const row of rows) {
    const prefix = `  [person ${row.person_id} | ${row.email}]`;

    let payment: MpPaymentLike;
    try {
      const fetched = await new Payment(getMp()).get({
        id: row.external_payment_id,
      });
      payment = fetched as unknown as MpPaymentLike;
    } catch (err) {
      skippedMpError += 1;
      console.warn(
        `${prefix} skipped — MP fetch failed for payment ${row.external_payment_id}:`,
        err instanceof Error ? err.message : err,
      );
      continue;
    }

    const buyerInfo = await resolveBuyerInfo(payment, {
      // The buggy "Asistente" rows are precisely the ones whose
      // preference_id was empty in MP's response. We don't have any
      // current preference-id-keyed stash that would still be alive
      // (24h TTL elapsed), so this reader is intentionally a no-op
      // here; the email-keyed stash is the recovery path.
      readStashByPreferenceId: async () => null,
      readStashByEmail: async (email) => readEmailStash(redis, email),
    });

    const recoveredName = buyerInfo.name;
    const recoveredPhone = buyerInfo.phone;
    const nameIsReal = recoveredName && recoveredName !== "Asistente";
    const phoneNeeded = !row.current_phone && recoveredPhone;

    if (!nameIsReal && !phoneNeeded) {
      skippedNoRecovery += 1;
      console.log(
        `${prefix} no recovery — name source=${buyerInfo.nameSource}, name=${recoveredName}, phone=${recoveredPhone ?? "—"}`,
      );
      continue;
    }

    console.log(
      `${prefix} ${nameIsReal ? `name "${row.current_name}" → "${recoveredName}" (via ${buyerInfo.nameSource})` : "(name unchanged)"}` +
        `${phoneNeeded ? `, phone null → "${recoveredPhone}"` : ""}`,
    );

    if (DRY_RUN) continue;

    // Only touch the columns we recovered. Don't clobber existing phone.
    if (nameIsReal && phoneNeeded) {
      await db.execute(sql`
        UPDATE people
        SET name = ${recoveredName}, phone = ${recoveredPhone}, updated_at = NOW()
        WHERE id = ${row.person_id} AND name = 'Asistente'
      `);
      updatedNames += 1;
      updatedPhones += 1;
    } else if (nameIsReal) {
      await db.execute(sql`
        UPDATE people
        SET name = ${recoveredName}, updated_at = NOW()
        WHERE id = ${row.person_id} AND name = 'Asistente'
      `);
      updatedNames += 1;
    } else if (phoneNeeded) {
      await db.execute(sql`
        UPDATE people
        SET phone = ${recoveredPhone}, updated_at = NOW()
        WHERE id = ${row.person_id} AND phone IS NULL
      `);
      updatedPhones += 1;
    }
  }

  console.log("\n── Summary ──────────────────────────────");
  console.log(`  Stale rows considered:   ${rows.length}`);
  console.log(`  Names ${DRY_RUN ? "would update" : "updated"}:    ${DRY_RUN ? rows.length - skippedNoRecovery - skippedMpError : updatedNames}`);
  console.log(`  Phones ${DRY_RUN ? "would update" : "updated"}:   ${DRY_RUN ? "(see per-row log)" : updatedPhones}`);
  console.log(`  Skipped (no MP data):    ${skippedNoRecovery}`);
  console.log(`  Skipped (MP fetch err):  ${skippedMpError}`);
  console.log("─────────────────────────────────────────");
  if (DRY_RUN) {
    console.log("\nDry-run only. Re-run with --apply to write.\n");
  } else {
    console.log("\nDone.\n");
  }

  // Redis client (when connected) holds a long-lived socket; explicit
  // process.exit below forces close. Matches the pattern in
  // seed-preview.ts.
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill failed:", err);
    process.exit(1);
  });
