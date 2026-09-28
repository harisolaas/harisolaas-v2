/**
 * Desafío "15 días meditando juntos" — event-level config.
 *
 * Pure data, safe to import anywhere. The per-day content lives in the DB
 * (`challenge_days`, edited from /admin/desafio); everything that belongs to
 * the challenge as a whole lives here — it's the `nombre` / `guia` /
 * `bienvenida` / `whatsapp` / `cierre` block of the design's `contenido.js`.
 *
 * No registration and no date gate: people arrive from the WhatsApp group,
 * start at day 1 whenever they arrive and move at their own pace. A day is
 * visible when its row is `published`, nothing else.
 *
 * NOTE: nothing in src/lib may read `DESAFIO_EVENT_ID` through a helper —
 * tests partially mock the constant, and a helper reading it would silently
 * keep the real value. Pass it as a parameter.
 */

/** A key, not a date claim. Never change it once content has been loaded in prod. */
export const DESAFIO_EVENT_ID = "desafio-15-dias-2026";

export const DESAFIO_TOTAL_DAYS = 15;

export interface DesafioConfig {
  /** Display name — also the page H1. */
  nombre: string;
  /** Guide's name, rendered as the "con {guia}" tag. */
  guia: string;
  /** Welcome paragraph under the H1. */
  bienvenida: string;
  /** WhatsApp group invite; the sticky "Volver al grupo" button opens it. */
  whatsapp: string;
  /** Closing CTA block on the finale screen (placeholder for a talk invite). */
  cierre: { titulo: string; texto: string };
}

export const desafioConfig: DesafioConfig = {
  // "juntos" is the product name, kept verbatim by Hari's decision.
  nombre: "15 días meditando juntos",
  guia: "Hari",
  bienvenida:
    "Qué bueno que estés acá. Un ratito por día, a tu ritmo: empezás por el Día 1 y seguís cuando puedas.",
  whatsapp: "https://chat.whatsapp.com/JXejj6W5KaB3I8VwPDz5Ld",
  cierre: {
    titulo: "Se viene algo lindo",
    // Design text said "Quedate atento/a en el grupo"; rewritten without the
    // gendered "/a" per CLAUDE.md.
    texto:
      "Estoy preparando un encuentro para seguir compartiendo. No te pierdas el grupo: ahí te aviso primero.",
  },
};

/** Where the public page lives (used for the `events` row and the sitemap). */
export const DESAFIO_LANDING_PATH = "/es/desafio";

/**
 * The `events.date` of the desafío row (NOT NULL column). Informational only:
 * it's when the challenge was first shared, it gates nothing.
 */
export const DESAFIO_EVENT_DATE = "2026-09-28T00:00:00-03:00";
