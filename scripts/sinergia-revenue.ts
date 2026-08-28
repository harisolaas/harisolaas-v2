/**
 * Recaudación histórica de Sinergia — qué juntó cada encuentro, desde el
 * primero hasta hoy.
 *
 *   npx tsx scripts/sinergia-revenue.ts
 *   npx tsx scripts/sinergia-revenue.ts --series=sinergia
 *   npx tsx scripts/sinergia-revenue.ts --since=2026-04-01 --json
 *
 * READ ONLY — este script nunca escribe.
 *
 * Lee `participations.price_cents` para los eventos de las series
 * `sinergia` y `sinergia-parrafo`. En Sinergia esa columna la estampa el
 * webhook de MercadoPago (`recordSinergiaDonation`) cuando el aporte se
 * confirma; en Párrafo es el precio de la entrada. Las reglas de conteo son
 * las mismas que usa `/api/admin/events/[id]`, así que la línea de una
 * sesión acá y el panel "Aportes recaudados" del admin no pueden diferir.
 *
 * La aritmética vive en `src/lib/sinergia-revenue.ts` (con tests). Acá sólo
 * está el SQL y la tabla.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import {
  formatRate,
  summarizeSinergiaRevenue,
  type SinergiaRevenueRow,
} from "../src/lib/sinergia-revenue";

const ALL_SERIES = ["sinergia", "sinergia-parrafo"] as const;

function value(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1) || undefined;
}

const AS_JSON = process.argv.includes("--json");
const SERIES = (value("--series") ?? ALL_SERIES.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SINCE = value("--since");
const UNTIL = value("--until");

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function encuentros(n: number): string {
  return n === 1 ? "1 encuentro" : `${n} encuentros`;
}

async function main() {
  for (const [flag, v] of [
    ["--since", SINCE],
    ["--until", UNTIL],
  ] as const) {
    if (v !== undefined && !isIsoDate(v)) {
      console.error(`${flag} debe ser YYYY-MM-DD, recibí "${v}"`);
      process.exit(1);
    }
  }
  if (SERIES.length === 0) {
    console.error("--series quedó vacío.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  // `IN (…)` con placeholders uno por uno en vez de `= ANY($1)`: pg manda el
  // array como literal sin tipo y Postgres no siempre lo infiere.
  const seriesList = sql.join(
    SERIES.map((s) => sql`${s}`),
    sql`, `,
  );

  // Todas las participaciones de la serie, pagas o no: las gratuitas son las
  // que hacen que el "% que aportó" signifique algo. El filtrado por estado
  // lo hace el summarizer, que además separa canceladas y monedas no-ARS en
  // vez de tirarlas silenciosamente.
  const result = await db.execute(sql`
    SELECT
      e.id                                        AS event_id,
      e.name                                      AS event_name,
      e.date                                      AS event_date,
      e.series                                    AS series,
      p.status                                    AS status,
      p.price_cents                               AS price_cents,
      p.currency                                  AS currency,
      p.metadata #> '{donation,receiptSent}'      AS receipt_sent
    FROM participations p
    JOIN events e ON e.id = p.event_id
    WHERE e.series IN (${seriesList})
      ${SINCE ? sql`AND e.date >= ${`${SINCE}T00:00:00-03:00`}` : sql``}
      ${UNTIL ? sql`AND e.date <= ${`${UNTIL}T23:59:59-03:00`}` : sql``}
  `);

  const rows: SinergiaRevenueRow[] = (
    result.rows as {
      event_id: string;
      event_name: string;
      event_date: string | Date;
      series: string | null;
      status: string;
      price_cents: number | string | null;
      currency: string | null;
      receipt_sent: boolean | null;
    }[]
  ).map((r) => ({
    eventId: r.event_id,
    eventName: r.event_name,
    eventDate: r.event_date,
    series: r.series,
    status: r.status,
    priceCents: r.price_cents === null ? null : Number(r.price_cents),
    currency: r.currency,
    receiptSent: r.receipt_sent === null ? null : Boolean(r.receipt_sent),
  }));

  const summary = summarizeSinergiaRevenue(rows);

  if (AS_JSON) {
    console.log(JSON.stringify({ seriesFilter: SERIES, ...summary }, null, 2));
    return;
  }

  console.log(`\nDB host: ${dbHost()}`);
  console.log(`Series:  ${SERIES.join(", ")}`);
  if (SINCE || UNTIL) {
    console.log(`Período: ${SINCE ?? "inicio"} → ${UNTIL ?? "hoy"}`);
  }
  console.log("");

  if (summary.series.length === 0) {
    console.log("Todavía no hay encuentros con participaciones.\n");
    return;
  }

  const WIDTH = 74;
  for (const group of summary.series) {
    console.log(group.label);
    console.log(
      `${"Fecha".padEnd(12)}${"Encuentro".padEnd(24)}${"RSVPs".padStart(6)}${"Aportes".padStart(9)}${"Recaudado".padStart(12)}${"Promedio".padStart(11)}`,
    );
    console.log("─".repeat(WIDTH));
    for (const s of group.sessions) {
      const name = s.eventName.length > 23 ? `${s.eventName.slice(0, 22)}…` : s.eventName;
      console.log(
        `${s.date.padEnd(12)}${name.padEnd(24)}${String(s.rsvps).padStart(6)}${String(s.contributors).padStart(9)}${s.totalDisplay.padStart(12)}${s.avgDisplay.padStart(11)}`,
      );
    }
    console.log("─".repeat(WIDTH));
    const t = group.totals;
    console.log(
      `${`Subtotal (${encuentros(t.sessions)})`.padEnd(36)}${String(t.rsvps).padStart(6)}${String(t.contributors).padStart(9)}${t.totalDisplay.padStart(12)}${t.avgDisplay.padStart(11)}`,
    );
    console.log(
      `${"".padEnd(36)}${formatRate(t.contributionRate).padStart(15)} de quienes vinieron aportaron`,
    );
    console.log("");
  }

  const t = summary.totals;
  console.log("═".repeat(WIDTH));
  console.log(
    `${`TOTAL HISTÓRICO (${encuentros(t.sessions)})`.padEnd(36)}${String(t.rsvps).padStart(6)}${String(t.contributors).padStart(9)}${t.totalDisplay.padStart(12)}${t.avgDisplay.padStart(11)}`,
  );
  console.log("═".repeat(WIDTH));

  if (summary.cancelled.length > 0) {
    console.log(
      "\nPagas y después canceladas (fuera del total — fijate en MP si se reembolsaron):",
    );
    for (const c of summary.cancelled) {
      console.log(`  ${c.eventId}: ${c.count} × ${c.totalDisplay}`);
    }
  }

  if (summary.otherCurrencies.length > 0) {
    console.log("\n⚠ Filas en otra moneda (fuera del total en pesos):");
    for (const c of summary.otherCurrencies) {
      console.log(`  ${c.currency}: ${c.count} filas, ${c.totalCents} centavos`);
    }
  }

  if (summary.pendingReceipts.length > 0) {
    console.log(
      "\n⚠ Aportes cobrados sin recibo enviado (la plata entró, el mail no salió):",
    );
    for (const p of summary.pendingReceipts) {
      console.log(`  ${p.eventId}: ${p.count}`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
