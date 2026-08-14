/**
 * Manda una ola de la campaña "Comunidad BROTE" a la audiencia real de prod.
 *
 *   npx tsx scripts/send-comunidad-campaign.ts --wave=2            # dry run
 *   npx tsx scripts/send-comunidad-campaign.ts --wave=2 --send
 *
 * ⚠️  Lee `.env.prod.local` y manda mail de verdad a gente de verdad. Sin
 * `--send` no escribe nada: imprime audiencia, asunto y CTA y termina.
 *
 * ── por qué existe ──
 *
 * El camino bueno es `runComunidadCampaign` (src/lib/brote-comunidad-campaign.ts)
 * detrás de la acción admin `comunidad-campaign`, con idempotencia en Redis y
 * alerta al admin. Mientras ese PR no esté mergeado no existe en producción,
 * así que la ola 1 salió por acá el 14/8/2026 (98 destinatarios, 0 fallos).
 * Cuando el PR se mergee, este script sobra: usá la acción admin.
 *
 * ── decisiones operativas ──
 *
 * · CTA a la URL viva de la invitación, NO a /go/email-comunidad-wN. Esa fila
 *   de `links` la crea el runner, que no está en prod, así que el short link
 *   daría 404 a todo el mundo. Con UTMs la venta igual se atribuye:
 *   `buildAttribution` levanta source/medium/campaign de la URL y el checkout
 *   estampa `inv-comunidad` como link_slug. Se ve en /admin/campanas.
 *
 * · Batch de Resend, un request por lote de 50, en vez de un send por persona:
 *   el límite es 2 req/s y 98 sends de a uno lo tocan.
 *
 * · Canario primero. Un mail al admin antes del lote; si Resend lo rechaza
 *   (key vencida, dominio caído, HTML inválido) aborta sin tocar la lista.
 *
 * · Idempotencia en disco, un registro por ola, bajo `.claude/` para que
 *   sobreviva entre sesiones sin entrar al repo. Una segunda corrida saltea a
 *   quien ya recibió. La audiencia además se recalcula en cada corrida, así
 *   que quien compró entre olas se cae solo.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.prod.local", override: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resend } from "resend";

const SEND = process.argv.includes("--send");
const WAVE = (() => {
  const hit = process.argv.find((a) => a.startsWith("--wave="));
  const n = hit ? Number(hit.slice(7)) : 1;
  if (n !== 1 && n !== 2 && n !== 3) {
    console.error("--wave debe ser 1, 2 o 3");
    process.exit(1);
  }
  return n as 1 | 2 | 3;
})();

const ADMIN = "h.solaas1@gmail.com";
const CHUNK = 50;

// `.claude/` está en .gitignore: el registro no entra al repo pero tampoco se
// pierde cuando se limpia el temporal de la sesión.
const LEDGER_DIR = path.resolve(process.cwd(), ".claude/campaign-ledger");
const LEDGER = path.join(LEDGER_DIR, `comunidad-w${WAVE}-enviados.json`);

const OLD_CTA = `https://www.harisolaas.com/go/email-comunidad-w${WAVE}`;
const LIVE_CTA =
  "https://www.harisolaas.com/es/brote/invitacion/comunidad" +
  `?utm_source=email&utm_medium=campaign&utm_campaign=brote-comunidad-w${WAVE}`;

function readLedger(): string[] {
  if (!existsSync(LEDGER)) return [];
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8")) as string[];
  } catch {
    return [];
  }
}

function writeLedger(emails: string[]) {
  mkdirSync(LEDGER_DIR, { recursive: true });
  writeFileSync(LEDGER, JSON.stringify(emails, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL — ¿existe .env.prod.local?");
    process.exit(1);
  }

  const from = `BROTE <${process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com"}>`;
  console.log(`DB:   ${new URL(process.env.DATABASE_URL).host}`);
  console.log(`From: ${from}`);
  console.log(`Ola:  ${WAVE}`);
  console.log(`Modo: ${SEND ? "ENVÍO REAL" : "DRY RUN"}\n`);

  // Dinámicos: `@/db` lee DATABASE_URL al importarse, y un import estático se
  // evalúa antes de que corra el loadEnv de arriba.
  const { renderComunidadEmail } = await import(
    "../src/lib/brote-comunidad-email"
  );
  const { loadComunidadAudience } = await import(
    "../src/lib/brote-comunidad-audience"
  );

  const already = new Set(readLedger());
  const rows = (await loadComunidadAudience()).filter(
    (r) => r.email && !already.has(r.email),
  );

  const both = rows.filter((r) => r.cameToBrote1 && r.cameToPlant).length;
  const b1 = rows.filter((r) => r.cameToBrote1 && !r.cameToPlant).length;
  const pl = rows.filter((r) => !r.cameToBrote1 && r.cameToPlant).length;

  console.log(`Audiencia pendiente: ${rows.length}`);
  console.log(`  ${b1} sólo BROTE 1 · ${pl} sólo plantación · ${both} las dos`);
  if (already.size) console.log(`Ya recibieron esta ola: ${already.size}`);

  const sample = renderComunidadEmail(WAVE, {
    name: null,
    cameToBrote1: true,
    cameToPlant: false,
  });
  console.log(`\nAsunto: ${sample.subject}`);
  console.log(`CTA:    ${LIVE_CTA}\n`);

  if (!SEND) {
    console.log("Dry run — no se mandó nada. Pasá --send.");
    return;
  }
  if (rows.length === 0) {
    console.log("No queda nadie por recibir esta ola.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const build = (r: {
    email: string;
    name: string | null;
    cameToBrote1: boolean;
    cameToPlant: boolean;
  }) => {
    const { subject, html } = renderComunidadEmail(WAVE, {
      name: r.name,
      cameToBrote1: r.cameToBrote1,
      cameToPlant: r.cameToPlant,
    });
    return {
      from,
      to: r.email,
      subject,
      html: html.replaceAll(OLD_CTA, LIVE_CTA),
    };
  };

  console.log(`Canario a ${ADMIN}…`);
  const canary = await resend.emails.send(
    build({ email: ADMIN, name: "Hari", cameToBrote1: true, cameToPlant: true }),
  );
  if (canary.error || !canary.data) {
    console.error("Canario falló, se aborta:", canary.error);
    process.exit(1);
  }
  console.log(`  ok (${canary.data.id})\n`);

  const sent: string[] = [...already];
  const failed: { email: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    process.stdout.write(
      `Lote ${Math.floor(i / CHUNK) + 1} (${chunk.length})… `,
    );

    // El SDK de Resend NO tira en error de API: devuelve {data, error}. Se
    // inspecciona `error` a mano — un try/catch acá es el bug del 2026-04-19.
    const res = await resend.batch.send(chunk.map(build));

    if (res.error) {
      console.log(`FALLÓ: ${res.error.name} — ${res.error.message}`);
      for (const r of chunk) {
        failed.push({ email: r.email, error: res.error.name });
      }
    } else {
      console.log(`ok (${res.data?.data?.length ?? chunk.length} aceptados)`);
      for (const r of chunk) sent.push(r.email);
      writeLedger(sent);
    }

    if (i + CHUNK < rows.length) await sleep(1000);
  }

  console.log(`\n── resultado ──`);
  console.log(`enviados: ${sent.length - already.size}`);
  console.log(`fallados: ${failed.length}`);
  for (const f of failed) console.log(`  ${f.email}: ${f.error}`);
  console.log(`\nRegistro: ${LEDGER}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
