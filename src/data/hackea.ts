// Hackeá tu mente — charla presencial de Hari, entrada paga (MercadoPago).
// Single source of truth for the event: the landing renders from here and
// the checkout charges from here, so the two cannot drift.
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

  // null = sin tope. "Cupos limitados" in the copy; set a number once the
  // room size is confirmed and recordParticipation enforces it.
  capacity: null as number | null,

  // Price in ARS cents. $21.300 ARS.
  ticketPriceCents: 2_130_000,
  ticketPriceLabel: "$21.300",
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
