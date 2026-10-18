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

  neighborhood: "Palermo, Buenos Aires",
  exactAddress: "Costa Rica 5644, Palermo, Buenos Aires",
  exactAddressMapLink:
    "https://www.google.com/maps/search/?api=1&query=Costa+Rica+5644+Palermo+Buenos+Aires",
};

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
