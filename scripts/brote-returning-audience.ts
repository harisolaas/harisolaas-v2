/**
 * Who already came — the audience for `/es/brote/invitacion/comunidad` and for
 * the three-wave "Comunidad BROTE" campaign.
 *
 *   npx tsx scripts/brote-returning-audience.ts
 *   npx tsx scripts/brote-returning-audience.ts --csv
 *   npx tsx scripts/brote-returning-audience.ts --with-phone
 *
 * READ ONLY — never writes.
 *
 * The query itself lives in `src/lib/brote-comunidad-audience.ts`, because the
 * campaign runner sends to exactly this list: two copies of it would drift the
 * first time one of them was adjusted, and the list you eyeball here would
 * stop being the list that gets mailed.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

const AS_CSV = process.argv.includes("--csv");
const WITH_PHONE = process.argv.includes("--with-phone");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }

  // Imported lazily so the missing-env guard above runs before anything opens
  // a connection.
  const { loadComunidadAudience } = await import(
    "../src/lib/brote-comunidad-audience"
  );
  const rows = await loadComunidadAudience();

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
        r.cameToBrote1 ? "sí" : "",
        r.cameToPlant ? "sí" : "",
      ];
      console.log(cells.join(","));
    }
    return;
  }

  const both = rows.filter((r) => r.cameToBrote1 && r.cameToPlant).length;
  const onlyBrote1 = rows.filter(
    (r) => r.cameToBrote1 && !r.cameToPlant,
  ).length;
  const onlyPlant = rows.filter(
    (r) => !r.cameToBrote1 && r.cameToPlant,
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
  console.log(`Campaña por mail (3 olas), vía POST /api/brote/admin:`);
  console.log(`  {"action":"comunidad-campaign","wave":1,"mode":"preview"}\n`);
  console.log(`Pasá --csv para la lista, --with-phone para incluir teléfonos.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
