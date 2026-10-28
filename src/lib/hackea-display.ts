// Hackeá tu mente — the date / time / venue strings the landing shows, derived
// from `hackeaConfig` so the copy can never drift from the event row the
// checkout and admin read. Spanish only: the page is Spanish-only.
import { hackeaConfig } from "@/data/hackea";

export interface HackeaDisplay {
  /** "29.OCT" — DateStamp + footer. */
  stamp: string;
  /** "19H00" — DateStamp + footer. */
  stampTime: string;
  /** "Jueves 29 de octubre" — purchase details. */
  longDate: string;
  /** "29" — the VSL intro ("qué vas a vivir el 29"). */
  dayNum: string;
  /** "19:00 h" — purchase details. */
  time: string;
  /** "Costa Rica 5644 · Palermo, Buenos Aires" — hero. */
  placeFull: string;
  /** "Costa Rica 5644 · Palermo" — purchase details + footer. */
  placeShort: string;
}

type DisplayConfig = Pick<
  typeof hackeaConfig,
  "date" | "startTime" | "exactAddress" | "neighborhood"
>;

export function hackeaDisplay(config: DisplayConfig = hackeaConfig): HackeaDisplay {
  // Noon UTC on the event's calendar date: the weekday/month can't shift by
  // a day whatever the server's timezone.
  const day = new Date(`${config.date}T12:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", ...opts }).format(day);

  const dayNum = fmt({ day: "numeric" });
  const monthShort = fmt({ month: "short" }).replace(".", "").toUpperCase();
  const weekday = fmt({ weekday: "long" });
  const month = fmt({ month: "long" });

  const street = config.exactAddress.split(",")[0].trim();
  const barrio = config.neighborhood.split(",")[0].trim();

  return {
    stamp: `${dayNum}.${monthShort}`,
    stampTime: config.startTime.replace(":", "H"),
    longDate: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayNum} de ${month}`,
    dayNum,
    time: `${config.startTime} h`,
    placeFull: `${street} · ${config.neighborhood}`,
    placeShort: `${street} · ${barrio}`,
  };
}

/**
 * Sales stay open until the talk starts (`startIso`), unless the date was
 * suspended (`salesSuspended`). Pure, so the landing (closed card in place
 * of the form) and the checkout (410) share one rule.
 */
export function isHackeaSalesOpen(
  now: Date = new Date(),
  config: Pick<typeof hackeaConfig, "startIso" | "salesSuspended"> = hackeaConfig,
): boolean {
  if (config.salesSuspended) return false;
  return now.getTime() <= Date.parse(config.startIso);
}
