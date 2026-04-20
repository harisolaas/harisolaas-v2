/**
 * One-shot seed: copy current ADMIN_EMAILS env entries into admin_users as
 * owner/all. Safe to re-run — INSERT ... ON CONFLICT DO NOTHING keeps
 * existing rows untouched.
 *
 * Usage:
 *   npx tsx scripts/seed-admin-users.ts --dry-run
 *   npx tsx scripts/seed-admin-users.ts --execute
 *
 * Run this once after the 0002_* migration lands against prod Neon. The
 * ADMIN_EMAILS env var stays as an emergency fallback so the owner can't
 * lock themselves out if this script is forgotten, but after seeding the
 * fallback is belt-and-suspenders.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { sql } from "drizzle-orm";

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

async function main() {
  const raw = process.env.ADMIN_EMAILS || "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("ADMIN_EMAILS is empty — nothing to seed.");
    process.exit(1);
  }

  console.log(
    `Found ${emails.length} email(s) in ADMIN_EMAILS: ${emails.join(", ")}`,
  );
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "EXECUTE"}`);

  if (DRY_RUN) {
    console.log("Dry run — not writing. Pass --execute to apply.");
    return;
  }

  const { db } = await import("@/db");
  for (const email of emails) {
    await db.execute(sql`
      INSERT INTO admin_users (email, role, scope, created_by_email)
      VALUES (${email}, 'owner', 'all', ${email})
      ON CONFLICT (email) DO NOTHING
    `);
    console.log(`  upserted ${email} as owner/all`);
  }

  const result = await db.execute<{
    email: string;
    role: string;
    scope: string;
  }>(sql`SELECT email, role, scope FROM admin_users ORDER BY email`);
  console.log("\nadmin_users table after seed:");
  for (const row of result.rows ?? []) {
    console.log(`  ${row.email} — ${row.role} / ${row.scope}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
