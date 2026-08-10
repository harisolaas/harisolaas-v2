/**
 * Who already came — the audience for `/es/brote/invitacion/comunidad`.
 *
 *   npx tsx scripts/brote-returning-audience.ts
 *   npx tsx scripts/brote-returning-audience.ts --csv
 *   npx tsx scripts/brote-returning-audience.ts --with-phone
 *
 * READ ONLY — never writes.
 *
 * Everyone with a real participation in BROTE 1 or the planting day, minus
 * anyone who already bought for BROTE 2 (sending them a discount for a
 * ticket they own reads as a mistake, and invites a refund request).
 *
 * `cancelled` is excluded: they signed up and pulled out. `no_show` is kept —
 * they paid and didn't make it, which is a reason to invite them back, not a
 * reason to drop them.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { BROTE_EVENT_ID, BROTE_1_EVENT_ID } from "../src/data/brote";

const PLANT_EVENT_ID = "plant-2026-04";

const AS_CSV = process.argv.includes("--csv");
const WITH_PHONE = process.argv.includes("--with-phone");

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

interface Row {
  name: string | null;
  email: string | null;
  phone: string | null;
  came_to_brote1: boolean;
  came_to_plant: boolean;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  const result = await db.execute(sql`
    SELECT
      p.name,
      p.email,
      p.phone,
      bool_or(pa.event_id = ${BROTE_1_EVENT_ID}) AS came_to_brote1,
      bool_or(pa.event_id = ${PLANT_EVENT_ID})   AS came_to_plant
    FROM people p
    JOIN participations pa ON pa.person_id = p.id
    WHERE pa.event_id IN (${BROTE_1_EVENT_ID}, ${PLANT_EVENT_ID})
      AND pa.status <> 'cancelled'
      AND p.email IS NOT NULL
      -- Already holds a BROTE 2 ticket: don't offer them a discount on
      -- something they have already paid for.
      AND NOT EXISTS (
        SELECT 1 FROM participations b2
        WHERE b2.person_id = p.id
          AND b2.event_id = ${BROTE_EVENT_ID}
          AND b2.status IN ('confirmed', 'used', 'no_show')
      )
    GROUP BY p.id, p.name, p.email, p.phone
    ORDER BY p.name NULLS LAST
  `);

  const rows = result.rows as unknown as Row[];

  if (AS_CSV) {
    const header = WITH_PHONE
      ? "name,email,phone,brote1,plantacion"
      : "name,email,brote1,plantacion";
    console.log(header);
    for (const r of rows) {
      // Quote everything: names carry commas often enough.
      const cells = [
        `"${(r.name ?? "").replace(/"/g, '""')}"`,
        `"${r.email}"`,
        ...(WITH_PHONE ? [`"${r.phone ?? ""}"`] : []),
        r.came_to_brote1 ? "sí" : "",
        r.came_to_plant ? "sí" : "",
      ];
      console.log(cells.join(","));
    }
    return;
  }

  const both = rows.filter((r) => r.came_to_brote1 && r.came_to_plant).length;
  const onlyBrote1 = rows.filter(
    (r) => r.came_to_brote1 && !r.came_to_plant,
  ).length;
  const onlyPlant = rows.filter(
    (r) => !r.came_to_brote1 && r.came_to_plant,
  ).length;
  const withPhone = rows.filter((r) => r.phone).length;

  console.log(`\nDB host: ${dbHost()}`);
  console.log(`\nYa vinieron y todavía no tienen entrada para BROTE 2:\n`);
  console.log(`  ${String(rows.length).padStart(4)}  personas en total`);
  console.log(`  ${String(onlyBrote1).padStart(4)}  sólo BROTE 1`);
  console.log(`  ${String(onlyPlant).padStart(4)}  sólo la plantación`);
  console.log(`  ${String(both).padStart(4)}  las dos`);
  console.log(`  ${String(withPhone).padStart(4)}  con WhatsApp cargado\n`);
  console.log(`Link para mandarles:`);
  console.log(`  https://www.harisolaas.com/es/brote/invitacion/comunidad\n`);
  console.log(`Pasá --csv para la lista, --with-phone para incluir teléfonos.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
