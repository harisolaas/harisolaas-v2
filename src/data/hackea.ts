// Hackeá tu mente — charla presencial de Hari, entrada paga (MercadoPago).
// Single source of truth for the event: the landing renders from here and
// the checkout charges from here, so the two cannot drift.

// Price in ARS cents. $21.300 ARS.
const TICKET_PRICE_CENTS = 2_130_000;

/** "$21.300" — es-AR thousands separator, no decimals (whole pesos). */
export function formatArsLabel(cents: number): string {
  // Grouped by hand rather than Intl: es locales skip the separator on
  // 4-digit numbers, and the output must not depend on the runtime's ICU.
  const pesos = String(Math.round(cents / 100));
  return `$${pesos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export const hackeaConfig = {
  // Stable event id used by the API + webhook + admin. Encodes the date so
  // a future edition gets a new row without colliding with this one.
  eventId: "hackea-tu-mente-2026-10-29",
  eventName: "Hackeá tu mente — 29/10/2026",
  // events.type — free text, used by the admin to special-case the drawer.
  eventType: "hackea",
  landingPath: "/es/hackea-tu-mente",

  date: "2026-10-29",
  startTime: "19:00",
  // ISO with -03:00 (Argentina) so the events.date column stores the
  // intended local moment regardless of where the server runs.
  startIso: "2026-10-29T19:00:00-03:00",
  // Estimate (~2h charla), used only for the JSON-LD `endDate` — nothing
  // user-facing or transactional reads it.
  endIso: "2026-10-29T21:00:00-03:00",
  // When ticket sales opened — the JSON-LD offer's `validFrom`.
  salesOpenIso: "2026-10-18T00:00:00-03:00",

  // null = sin tope. "Cupos limitados" in the copy; set a number once the
  // room size is confirmed and recordParticipation enforces it.
  capacity: null as number | null,

  ticketPriceCents: TICKET_PRICE_CENTS,
  // Derived from the cents so the label can't drift from what MP charges.
  ticketPriceLabel: formatArsLabel(TICKET_PRICE_CENTS),
  currency: "ARS",

  // VSL, first thing under the header: a self-hosted file under /public, or a
  // YouTube / Vimeo link (resolveHackeaVsl). Bump the filename when the cut
  // changes, never overwrite — browsers and the CDN cache it by URL.
  // Empty string = poster only.
  vslUrl: "/hackea/vsl-v1.mp4",
  // A frame of the cut (no subtitles, from the v-unica export) behind the
  // poster's scrim and as the <video> poster. Same bump rule.
  vslPosterUrl: "/hackea/vsl-v1-poster.jpg",
  // Start the VSL on load: with sound where the browser allows it, muted
  // with a "tocá para activar el sonido" overlay where it doesn't. false =
  // poster until the visitor hits play.
  vslAutoplay: true,

  neighborhood: "Palermo, Buenos Aires",
  exactAddress: "Costa Rica 5644, Palermo, Buenos Aires",
  exactAddressMapLink:
    "https://www.google.com/maps/search/?api=1&query=Costa+Rica+5644+Palermo+Buenos+Aires",
};

// Group purchase: up to HACKEA_MAX_QUANTITY entradas in one checkout, one
// participation with `metadata.quantity`. Totals in ARS cents, keyed by
// quantity. Per-person prices end in 900 on purpose; every tier stays under
// a 35% discount and four come out cheaper than three single entradas.
export const HACKEA_MAX_QUANTITY = 4;
export const HACKEA_GROUP_TIERS: Record<number, number> = {
  1: TICKET_PRICE_CENTS, // $21.300
  2: 3_380_000, // $16.900 c/u
  3: 4_590_000, // $15.300 c/u
  4: 5_560_000, // $13.900 c/u
};

export function isHackeaQuantity(q: unknown): q is number {
  return (
    typeof q === "number" &&
    Number.isInteger(q) &&
    q >= 1 &&
    q <= HACKEA_MAX_QUANTITY
  );
}

/** Group total for `q` entradas. Anything out of range reads as 1. */
export function hackeaGroupPriceCents(q: number): number {
  return HACKEA_GROUP_TIERS[isHackeaQuantity(q) ? q : 1];
}

export function hackeaPerPersonCents(q: number): number {
  const n = isHackeaQuantity(q) ? q : 1;
  return Math.round(hackeaGroupPriceCents(n) / n);
}

/** What the group saves vs `q` single entradas. */
export function hackeaGroupSavingsCents(q: number): number {
  const n = isHackeaQuantity(q) ? q : 1;
  return n * TICKET_PRICE_CENTS - hackeaGroupPriceCents(n);
}

/** Discount in whole percent, rounded down so the copy never overstates it. */
export function hackeaGroupDiscountPercent(q: number): number {
  const n = isHackeaQuantity(q) ? q : 1;
  return Math.floor((hackeaGroupSavingsCents(n) * 100) / (n * TICKET_PRICE_CENTS));
}

// MP Preference metadata.type — every MP flow shares one access token and
// one webhook secret, so each webhook ignores payments that aren't its own.
export const HACKEA_PAYMENT_TYPE = "hackea-ticket";
// participations.id prefix: HTM-XXXXXXXX.
export const HACKEA_PARTICIPATION_PREFIX = "HTM-";

// Share card (OG + Twitter + JSON-LD image), relative to /public. Same rule
// as BROTE_OG_IMAGE: bump the filename when the artwork changes, never
// overwrite in place — Facebook, WhatsApp and X cache OG images by URL.
// Carries date, time and barrio, never the price (it can change).
export const HACKEA_OG_IMAGE = "hackea/og-hackea-v1.png";
