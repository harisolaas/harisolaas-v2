/**
 * Desafío "15 días meditando" — config + date logic.
 *
 * Pure: no DB, no env except the preview-only start-date override. Every
 * helper takes `now` and/or `start` as parameters so tests can pin them.
 *
 * Unlock rule: day N opens at 00:00 Argentina time (UTC-3, no DST) on
 * `startDate + (N - 1)`. Same explicit `-03:00` offset pattern as
 * `isEarlyBird` in `src/data/brote.ts`.
 *
 * NOTE: none of these helpers may reference `DESAFIO_EVENT_ID` — tests
 * partially mock that constant, and a helper reading it would silently
 * keep the real value.
 */

/** A key, not a date claim. Never change it once content has been loaded in prod. */
export const DESAFIO_EVENT_ID = "desafio-15-dias-2026";

export const desafioConfig = {
  // YYYY-MM-DD, Argentina time. TBD: confirm with Hari (Monday → day 15 = Monday 2026-10-26)
  startDate: "2026-10-12",
  totalDays: 15,
  // TBD: used in copy only via dict, keep in sync
  practiceMinutes: 15,
  landingPath: "/es/desafio",
  // TBD: optional community group invite; "" hides the button in the email
  whatsappGroupUrl: "",
};

export type DesafioPhase = "before" | "live" | "after";
export type DesafioLocale = "es" | "en";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * The effective start date. `DESAFIO_START_DATE_OVERRIDE` lets a preview
 * deploy exercise unlocked days before the real start; it is ignored in
 * production and when malformed. Server-side only.
 */
export function desafioStartDate(): string {
  const override = process.env.DESAFIO_START_DATE_OVERRIDE;
  if (
    override &&
    ISO_DATE_RE.test(override) &&
    process.env.VERCEL_ENV !== "production"
  ) {
    return override;
  }
  return desafioConfig.startDate;
}

/** Date-only arithmetic on a YYYY-MM-DD string. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Calendar date (ART) of day `n` (1-based). */
export function dayDate(n: number, start: string = desafioStartDate()): string {
  return addDays(start, n - 1);
}

/** The instant day `n` opens: 00:00 Argentina time on its date. */
export function dayUnlocksAt(n: number, start: string = desafioStartDate()): Date {
  return new Date(`${dayDate(n, start)}T00:00:00-03:00`);
}

export function isDayUnlocked(
  n: number,
  now: Date = new Date(),
  start: string = desafioStartDate(),
): boolean {
  return now.getTime() >= dayUnlocksAt(n, start).getTime();
}

/** Last second of the last day, Argentina time. */
export function challengeEndsAt(start: string = desafioStartDate()): Date {
  return new Date(`${dayDate(desafioConfig.totalDays, start)}T23:59:59-03:00`);
}

/** How many days are open at `now`, 0..totalDays. */
export function unlockedDayCount(
  now: Date = new Date(),
  start: string = desafioStartDate(),
): number {
  let count = 0;
  for (let n = 1; n <= desafioConfig.totalDays; n++) {
    if (isDayUnlocked(n, now, start)) count = n;
    else break;
  }
  return count;
}

export function desafioPhase(
  now: Date = new Date(),
  start: string = desafioStartDate(),
): DesafioPhase {
  if (!isDayUnlocked(1, now, start)) return "before";
  if (now.getTime() > challengeEndsAt(start).getTime()) return "after";
  return "live";
}

export function isRegistrationOpen(
  now: Date = new Date(),
  start: string = desafioStartDate(),
): boolean {
  return desafioPhase(now, start) !== "after";
}

/** Today's calendar date in Argentina, YYYY-MM-DD. */
export function argentinaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - ART_OFFSET_MS).toISOString().slice(0, 10);
}

const WEEKDAYS_ES = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * es: "lunes 12 de octubre" · en: "Monday, October 12". Hand-rolled
 * (not Intl) so server and client render identical strings.
 */
export function formatDayDate(iso: string, locale: DesafioLocale): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = date.getUTCDay();
  const mo = date.getUTCMonth();
  const day = date.getUTCDate();
  if (locale === "en") return `${WEEKDAYS_EN[wd]}, ${MONTHS_EN[mo]} ${day}`;
  return `${WEEKDAYS_ES[wd]} ${day} de ${MONTHS_ES[mo]}`;
}
