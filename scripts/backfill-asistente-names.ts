/**
 * Backfill real buyer names (and phones, when available) onto `people`
 * rows whose name is the 'Asistente' placeholder, by re-reading each
 * row's most recent MP payment via the SDK.
 *
 * Strategy, per 'Asistente' person row:
 *   1. Find their most recent participation with a non-null
 *      `external_payment_id`.
 *   2. Fetch that MP payment.
 *   3. Resolve a real name from `additional_info.payer` then
 *      `payer.first_name + last_name`.
 *   4. UPDATE `people.name` if a real name was recovered.
 *   5. Probe the email-keyed Redis stash
 *      (`sinergia-parrafo:checkout-by-email:{email}`) and recover the
 *      phone too when the row has none.
 *
 * Usage:
 *   npx tsx scripts/backfill-asistente-names.ts            # dry-run (default)
 *   npx tsx scripts/backfill-asistente-names.ts --apply    # write
 *
 * Idempotent: rows already patched no longer match the filter.
 *
 * Requires `MP_ACCESS_TOKEN` (production, `APP_USR-...`), `DATABASE_URL`,
 * and `REDIS_URL` in `.env.local`. Run with `--apply` only after a clean
 * dry-run.
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

  // Phone recovery needs Redis; without it the script still runs the
  // name-only path.
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

  // One MP fetch per person: the window function picks each person's
  // most recent participation with an external_payment_id.
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
      // No preference-id stash to consult here: the 24h TTL has long
      // expired by the time this backfill runs. Recovery goes through
      // the email-keyed stash.
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

  // Redis holds a long-lived socket; the explicit process.exit below
  // forces close.
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill failed:", err);
    process.exit(1);
  });
