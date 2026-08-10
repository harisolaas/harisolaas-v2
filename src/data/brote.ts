// Event IDs — namespace participations/counters per edition.
// The historical constant is kept so cross-edition queries (e.g. returning
// community in admin/metrics) can still reference edition 1.
export const BROTE_EVENT_ID = "brote-2026-08-20"; // current edition (BROTE 2)
export const BROTE_1_EVENT_ID = "brote-2026-03-28"; // historical (BROTE 1)

export const broteConfig = {
  // Event date/time — single source of truth (mirrors plantConfig naming).
  eventDate: "2026-08-20", // YYYY-MM-DD, Argentina time
  eventDateDisplay: "Jueves 20 de agosto",
  eventTime: "19:00 a 22:30",

  // Prices
  ticketPrice: "$33.000",
  ticketPriceRaw: 33000,
  earlyBirdPrice: "$24.750",
  earlyBirdPriceRaw: 24750,
  earlyBirdDeadline: "2026-08-13", // YYYY-MM-DD, inclusive (Argentina time)
  earlyBirdDeadlineDisplay: "13 de agosto", // must match earlyBirdDeadline
  currency: "ARS",

  // Contact link for tree planting / donations
  plantingContactLink:
    "https://wa.me/5491122555110?text=Hola%20quiero%20sumarme%20a%20la%20plantaci%C3%B3n%20de%20%C3%A1rboles%20de%20BROTE",

  // Venue
  locationAddress: "Costa Rica 5644, Palermo Hollywood, CABA",
  locationLink:
    "https://www.google.com/maps/search/?api=1&query=Costa+Rica+5644+Palermo+Buenos+Aires",

  // Used in "Si vienen X personas, son X árboles"
  expectedAttendees: 100,
};

/* ─── pricing helpers ───────────────────────────────────────────────────────
 * The landing renders a price and the checkout API charges one. When those
 * were two inline expressions they could drift; deriving both from here means
 * they cannot. Every consumer takes `now` so the boundary is testable.
 * ------------------------------------------------------------------------ */

/** End of the early-bird window: last second of the deadline day, UTC-3. */
const earlyBirdEndsAt = () =>
  new Date(`${broteConfig.earlyBirdDeadline}T23:59:59-03:00`);

/**
 * Is the preventa still open? The explicit -03:00 matters: without it the
 * deadline is read as UTC midnight and the discount dies ~3h early.
 */
export function isEarlyBird(now: Date = new Date()): boolean {
  return now <= earlyBirdEndsAt();
}

/** Argentine peso formatting — dots for thousands, never commas. */
export function formatArs(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

/**
 * The one price that is both shown and charged. `display` is what the buyer
 * reads, `raw` is what MercadoPago bills; they are derived together so they
 * cannot disagree.
 */
export function currentTicketPrice(now: Date = new Date()): {
  raw: number;
  display: string;
  isEarlyBird: boolean;
} {
  return isEarlyBird(now)
    ? {
        raw: broteConfig.earlyBirdPriceRaw,
        display: broteConfig.earlyBirdPrice,
        isEarlyBird: true,
      }
    : {
        raw: broteConfig.ticketPriceRaw,
        display: broteConfig.ticketPrice,
        isEarlyBird: false,
      };
}

/**
 * What the preventa saves you, derived rather than written into the copy.
 * Takes the two prices as arguments so a test can prove the subtraction is
 * real — with no arguments, any hardcoded string matching today's config
 * would pass.
 */
export function earlyBirdSavings(
  ticketRaw: number = broteConfig.ticketPriceRaw,
  earlyRaw: number = broteConfig.earlyBirdPriceRaw,
): string {
  return formatArs(ticketRaw - earlyRaw);
}

/**
 * Fill `{token}` placeholders. Unknown tokens are left visible on purpose —
 * a stray `{savings}` on screen is a bug we want a test to catch, not one to
 * paper over by silently deleting it.
 */
export function fillTokens(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** The token set the pricing copy is allowed to reference. */
export function pricingTokens(): Record<string, string> {
  return {
    savings: earlyBirdSavings(),
    price: broteConfig.ticketPrice,
  };
}

export const plantConfig = {
  eventDate: "2026-04-19",
  eventDateDisplay: "Domingo 19 de abril",
  eventTime: "14:30 a 19:00",
  locationArea: "Reserva natural en San Miguel, Buenos Aires",
  // Single source of truth for exact address — only shown in confirmation email
  exactAddress:
    "Reserva Natural Urbana El Corredor — Tte. Ibañez 2200, Bella Vista, Buenos Aires",
  exactAddressMapLink: "https://maps.app.goo.gl/1166qcBtTHpof4jY6",
  capacity: 40,
};
