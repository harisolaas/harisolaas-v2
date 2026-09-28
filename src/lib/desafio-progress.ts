/**
 * Desafío — the public page's client-side state, as pure functions.
 *
 * Progress lives only in the visitor's browser (localStorage, no login), as
 * the sorted list of day numbers they marked. Everything the screens show is
 * derived from that list plus which days are published — the rules below are
 * the design handoff's (README "State management"), kept here so they can be
 * tested without a DOM.
 */
import { DESAFIO_TOTAL_DAYS } from "@/data/desafio";
import type { DesafioDay } from "@/lib/desafio";

/** localStorage key from the design. JSON array of day numbers, sorted. */
export const COMPLETADOS_STORAGE_KEY = "desafio15.completados";

// ============================================================
// Stored progress
// ============================================================

function isDayNumber(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= DESAFIO_TOTAL_DAYS;
}

/**
 * Parse the stored value. Anything unexpected (corrupt JSON, non-array,
 * out-of-range or duplicate numbers) is dropped rather than trusted: the
 * value is user-editable and `allDone` counts its length.
 */
export function parseCompletados(raw: string | null | undefined): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter(isDayNumber))].sort((a, b) => a - b);
}

/** Mark or unmark a day. Returns a new sorted array. */
export function toggleCompletado(done: readonly number[], n: number): number[] {
  if (done.includes(n)) return done.filter((d) => d !== n);
  return [...done, n].sort((a, b) => a - b);
}

// ============================================================
// Derivations
// ============================================================

export function isPublished(dias: readonly DesafioDay[], n: number): boolean {
  return dias.some((d) => d.dia === n && d.publicado);
}

/** "Tu próximo día": the lowest published day not yet completed. */
export function findNextDay(
  dias: readonly DesafioDay[],
  done: readonly number[],
): number | null {
  for (let n = 1; n <= DESAFIO_TOTAL_DAYS; n++) {
    if (isPublished(dias, n) && !done.includes(n)) return n;
  }
  return null;
}

export function isAllDone(done: readonly number[]): boolean {
  return done.length >= DESAFIO_TOTAL_DAYS;
}

export type DayStatus = "done" | "next" | "open" | "soon";

/** Priority: done → next → open (published) → soon (unpublished). */
export function dayStatus(
  n: number,
  dias: readonly DesafioDay[],
  done: readonly number[],
  nextDay: number | null,
): DayStatus {
  if (done.includes(n)) return "done";
  if (n === nextDay) return "next";
  if (isPublished(dias, n)) return "open";
  return "soon";
}

/** Only published days, or days already marked, can be opened. */
export function canOpenDay(
  n: number,
  dias: readonly DesafioDay[],
  done: readonly number[],
): boolean {
  return isDayNumber(n) && (isPublished(dias, n) || done.includes(n));
}

/** The first "soon" day — the one "Estás al día" says is coming. */
export function firstSoonDay(
  dias: readonly DesafioDay[],
  done: readonly number[],
): number | null {
  for (let n = 1; n <= DESAFIO_TOTAL_DAYS; n++) {
    if (!isPublished(dias, n) && !done.includes(n)) return n;
  }
  return null;
}

/** Which message the "Qué lindo." panel shows once day `n` is marked. */
export type DoneMessage =
  | "all" // every day done
  | "lastMissing" // this is the last day, others missing
  | "nextOpen" // next day published and not done
  | "nextSoon" // next day not published yet
  | "nextDone"; // next day published and already done

export function doneMessage(
  n: number,
  dias: readonly DesafioDay[],
  done: readonly number[],
): DoneMessage {
  if (isAllDone(done)) return "all";
  if (n >= DESAFIO_TOTAL_DAYS) return "lastMissing";
  const next = n + 1;
  if (!isPublished(dias, next)) return "nextSoon";
  return done.includes(next) ? "nextDone" : "nextOpen";
}

// ============================================================
// Hash routing: "" (inicio) · "#/dia/5" · "#/cierre"
// ============================================================

export type DesafioRoute =
  | { screen: "inicio" }
  | { screen: "dia"; n: number }
  | { screen: "cierre" };

export const HOME_ROUTE: DesafioRoute = { screen: "inicio" };

/** Syntactic parse only; `resolveRoute` decides whether it may be shown. */
export function parseRouteHash(hash: string): DesafioRoute {
  const h = hash.replace(/^#/, "");
  if (h === "/cierre") return { screen: "cierre" };
  const m = /^\/dia\/(\d{1,2})$/.exec(h);
  if (m) {
    const n = Number(m[1]);
    if (isDayNumber(n)) return { screen: "dia", n };
  }
  return HOME_ROUTE;
}

export function routeHash(route: DesafioRoute): string {
  if (route.screen === "dia") return `#/dia/${route.n}`;
  if (route.screen === "cierre") return "#/cierre";
  return "";
}

export function routeKey(route: DesafioRoute): string {
  return route.screen === "dia" ? `dia/${route.n}` : route.screen;
}

/**
 * The screen actually shown: a day that can't be opened, or the closing
 * before all 15 days are done, falls back to inicio.
 */
export function resolveRoute(
  route: DesafioRoute,
  dias: readonly DesafioDay[],
  done: readonly number[],
): DesafioRoute {
  if (route.screen === "dia" && !canOpenDay(route.n, dias, done)) return HOME_ROUTE;
  if (route.screen === "cierre" && !isAllDone(done)) return HOME_ROUTE;
  return route;
}
