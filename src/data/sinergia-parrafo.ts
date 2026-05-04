// Sinergia × Párrafo — colaboración con el club de lectura Párrafo.
// One-off event, paid ticket, BROTE-style checkout flow.
export const sinergiaParrafoConfig = {
  // Stable event id used by the API + webhook + admin. Encodes the date so
  // future editions get a new row without colliding with this one.
  eventId: "sinergia-parrafo-2026-05-16",
  eventName: "Sinergia × Párrafo — 16/05/2026",

  date: "2026-05-16",
  startTime: "10:00",
  endTime: "16:00",
  // ISO with -03:00 (Argentina) so the events.date column stores the
  // intended local moment regardless of where the server runs.
  startIso: "2026-05-16T10:00:00-03:00",
  endIso: "2026-05-16T16:00:00-03:00",

  capacity: 50,

  // Price in ARS cents. $33.000 ARS.
  ticketPriceCents: 3_300_000,
  ticketPriceLabel: "$33.000",
  currency: "ARS",

  neighborhood: "Palermo, CABA",
  venueName: "Sky Campus",
  exactAddress: "Costa Rica 5644, Palermo Hollywood, CABA",
  exactAddressMapLink:
    "https://www.google.com/maps/search/?api=1&query=Costa+Rica+5644+Palermo+Buenos+Aires",
};
