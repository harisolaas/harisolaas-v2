// Event IDs — namespace participations/counters per edition.
// The historical constant is kept so cross-edition queries (e.g. returning
// community in admin/metrics) can still reference edition 1.
export const BROTE_EVENT_ID = "brote-2026-08-20"; // current edition (BROTE 2)
export const BROTE_1_EVENT_ID = "brote-2026-03-28"; // historical (BROTE 1)

/**
 * The share card, named once so the four pages that reference it cannot drift.
 *
 * Bump the filename — never overwrite in place — when the card changes:
 * Facebook, WhatsApp and X cache OG images by URL, so a same-path replacement
 * keeps serving the old artwork from their caches for weeks. `-v2` replaced an
 * edition-1 card still advertising "Sábado 28 de marzo".
 */
export const BROTE_OG_IMAGE = "og-brote-v2.png";

export const broteConfig = {
  // Event date/time — single source of truth (mirrors plantConfig naming).
  eventDate: "2026-08-20", // YYYY-MM-DD, Argentina time
  eventDateDisplay: "Jueves 20 de agosto",
  eventTime: "19:00 a 22:30",
  // The same two hours as `eventTime`, machine-readable. Structured data needs
  // real timestamps, and parsing them back out of the display string would
  // break the first time the copy reads "de 19 a 22:30".
  eventStartTime: "19:00",
  eventEndTime: "22:30",

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

/**
 * El Arte de Vivir — the community the party comes out of.
 *
 * Not in `brote-invitations.ts`: that registry is collaborators who invite
 * people and, in the artists' case, get paid per ticket. This is the
 * organiser. The landing links the name to the site; the ticket emails link
 * the footer to Instagram, so both surfaces are used.
 *
 * The trailing slash is required — `artofliving.org/ar-es` without it 404s.
 */
export const artOfLivingUrl = "https://www.artofliving.org/ar-es/";
export const artOfLivingInstagram = "https://www.instagram.com/elartedevivir.ar/";

/* ─── pricing helpers ───────────────────────────────────────────────────────
 * The landing renders a price and the checkout API charges one. When those
 * were two inline expressions they could drift; deriving both from here means
 * they cannot. Every consumer takes `now` so the boundary is testable.
 * ------------------------------------------------------------------------ */

/** End of the early-bird window: last second of the deadline day, UTC-3. */
const earlyBirdEndsAt = () =>
  new Date(`${broteConfig.earlyBirdDeadline}T23:59:59-03:00`);

/**
 * ISO 8601 timestamps for the event itself, offset included.
 *
 * Returned as strings rather than `Date`s because their only consumer is
 * schema.org markup, which wants the local wall-clock time *with* its offset —
 * `toISOString()` would normalise to UTC and publish a 22:00 start.
 *
 * The explicit `-03:00` matters for the same reason it does in
 * `earlyBirdEndsAt()`: without it these are read as UTC and every calendar
 * that ingests the markup puts the party three hours early.
 */
export const eventStartsAt = () =>
  `${broteConfig.eventDate}T${broteConfig.eventStartTime}:00-03:00`;

export const eventEndsAt = () =>
  `${broteConfig.eventDate}T${broteConfig.eventEndTime}:00-03:00`;

/** Last instant of the preventa, as a schema.org `priceValidUntil`. */
export const earlyBirdValidUntil = () =>
  `${broteConfig.earlyBirdDeadline}T23:59:59-03:00`;

/**
 * When BROTE 2 tickets went on sale — the `validFrom` of the early-bird offer.
 *
 * Not a guess: `771a17b` ("BROTE 2 — segunda edición … ticketing reactivado",
 * #44) is the commit that set `earlyBirdPriceRaw: 24750` and reopened
 * checkout. Structured data is a public claim about when a price was
 * available, so it gets a date that actually happened rather than one chosen
 * to satisfy a validator.
 */
export const salesOpenedAt = () => "2026-07-18T00:00:00-03:00";

/** Midnight after the deadline — when the regular price takes over. */
export function regularPriceValidFrom(): string {
  const dayAfter = new Date(`${broteConfig.earlyBirdDeadline}T12:00:00-03:00`);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const [date] = dayAfter.toISOString().split("T");
  return `${date}T00:00:00-03:00`;
}

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
