/**
 * What each BROTE collaborator sold, and what they're owed.
 *
 *   npx tsx scripts/brote-collaborator-payout.ts
 *   npx tsx scripts/brote-collaborator-payout.ts --fee=3000
 *   npx tsx scripts/brote-collaborator-payout.ts --event=brote-2026-08-20 --json
 *
 * READ ONLY — this script never writes.
 *
 * It reads `participations.metadata->>'invite'`, which is written in exactly
 * one place: the BROTE webhook, when MercadoPago confirms a payment. That is
 * what makes the number payable. See `src/lib/brote-payout.ts` for why this
 * is deliberately NOT the signups figure on `/admin/links/{slug}` — those two
 * answer different questions, and only one of them is safe to pay from.
 *
 * `--fee` is pesos per ticket, not cents.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { BROTE_EVENT_ID } from "../src/data/brote";
import { summarizePayout, type PayoutRow } from "../src/lib/brote-payout";

function value(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1) || undefined;
}

const AS_JSON = process.argv.includes("--json");
const EVENT_ID = value("--event") ?? BROTE_EVENT_ID;
const feePesos = value("--fee");
const feePerTicketCents = feePesos ? Math.round(Number(feePesos) * 100) : undefined;

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  // Rejected rather than clamped: this report decides payments, and a
  // negative fee would print a plausible-looking table with the sign quietly
  // inverted.
  if (feePesos !== undefined) {
    const parsed = Number(feePesos);
    if (!Number.isFinite(parsed) || parsed < 0) {
      console.error(
        `--fee must be a non-negative number of pesos, got "${feePesos}"`,
      );
      process.exit(1);
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  // Cancelled rows are selected too — `summarizePayout` reports them
  // separately rather than deciding on its own whether a refunded ticket
  // still earns a fee.
  const result = await db.execute(sql`
    SELECT
      metadata->>'invite'    AS invite,
      price_cents            AS price_cents,
      status                 AS status,
      external_payment_id    AS external_payment_id
    FROM participations
    WHERE event_id = ${EVENT_ID}
      AND metadata->>'invite' IS NOT NULL
  `);

  const rows: PayoutRow[] = (
    result.rows as {
      invite: string | null;
      price_cents: number | null;
      status: string;
      external_payment_id: string | null;
    }[]
  ).map((r) => ({
    invite: r.invite,
    priceCents: r.price_cents === null ? null : Number(r.price_cents),
    status: r.status,
    externalPaymentId: r.external_payment_id,
  }));

  const summary = summarizePayout(rows, feePerTicketCents);

  if (AS_JSON) {
    console.log(JSON.stringify({ eventId: EVENT_ID, ...summary }, null, 2));
    return;
  }

  console.log(`\nDB host: ${dbHost()}`);
  console.log(`Evento:  ${EVENT_ID}`);
  if (feePerTicketCents !== undefined) {
    console.log(`Fee:     $${Number(feePesos).toLocaleString("es-AR")} por entrada`);
  }
  console.log("");

  if (summary.collaborators.length === 0) {
    console.log("Todavía no hay entradas pagas atribuidas a ningún colaborador.\n");
  } else {
    const head = feePerTicketCents !== undefined ? "  A pagar" : "";
    console.log(
      `${"Colaborador".padEnd(16)}${"Tipo".padEnd(9)}${"Entradas".padStart(9)}${"Recaudado".padStart(13)}${head}`,
    );
    console.log("─".repeat(feePerTicketCents !== undefined ? 58 : 47));
    for (const c of summary.collaborators) {
      const fee =
        c.feeDisplay !== undefined ? `  ${c.feeDisplay.padStart(9)}` : "";
      console.log(
        `${c.name.padEnd(16)}${c.kind.padEnd(9)}${String(c.tickets).padStart(9)}${c.revenueDisplay.padStart(13)}${fee}`,
      );
    }
    console.log("─".repeat(feePerTicketCents !== undefined ? 58 : 47));
    const totalFee =
      summary.totals.feeDisplay !== undefined
        ? `  ${summary.totals.feeDisplay.padStart(9)}`
        : "";
    console.log(
      `${"TOTAL".padEnd(25)}${String(summary.totals.tickets).padStart(9)}${summary.totals.revenueDisplay.padStart(13)}${totalFee}`,
    );
  }

  if (summary.cancelled.length > 0) {
    console.log(
      "\nCanceladas (pagadas y después canceladas — decidí vos si cuentan):",
    );
    for (const c of summary.cancelled) {
      console.log(`  ${c.slug}: ${c.tickets}`);
    }
  }

  if (summary.unknownInvites.length > 0) {
    console.log("\n⚠ Entradas con un colaborador que no existe en el registro:");
    for (const u of summary.unknownInvites) {
      console.log(`  "${u.invite}": ${u.tickets} — nadie las va a cobrar`);
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
