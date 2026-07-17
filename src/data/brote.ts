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
  // STALE — precio ed. 1, actualizar antes de reactivar el flujo Un Árbol.
  unArbolPrice: "$17.477",
  unArbolPriceRaw: 17477,
  // STALE — precio ed. 1, actualizar antes de reactivar el flujo CIMA.
  cimaPrice: "$17.477",
  cimaPriceRaw: 17477,
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
