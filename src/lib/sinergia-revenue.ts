/**
 * Historical Sinergia revenue — what every session actually collected.
 *
 * Sinergia RSVPs are free; money arrives as an optional MercadoPago
 * contribution that the webhook stamps onto the existing participation
 * (`recordSinergiaDonation`). Sinergia × Párrafo is a paid edition, so its
 * rows carry a ticket price instead. Both land in the same two columns —
 * `price_cents` + `currency` — which is what makes one report possible.
 *
 * The counting rules mirror `/api/admin/events/[id]` exactly (status in
 * confirmed/used, price_cents > 0) so a session's line here and the
 * "Aportes recaudados" panel in the admin drawer can never disagree.
 *
 * Three things are deliberately NOT summed into the headline number:
 *
 *   · cancelled rows that carry a payment — someone paid and then dropped.
 *     Whether that is still income depends on whether it was refunded, and
 *     that answer lives in MercadoPago, not here. Listed separately.
 *   · anything not priced in ARS — mixing currencies into one total is how
 *     a report starts lying. Listed separately.
 *   · pending/waitlist rows with a stray price — not confirmed income.
 *
 * A donation whose receipt never went out (`metadata.donation.receiptSent`
 * false) still counts as money in: the peso arrived, the email is an ops
 * loose end. It is surfaced as a warning so it can be chased.
 */

import { formatArs } from "@/data/brote";

/** One participation row, as read from the database. */
export interface SinergiaRevenueRow {
  eventId: string;
  eventName: string;
  /** Event date, ISO string or Date — only used for ordering and display. */
  eventDate: string | Date;
  series: string | null;
  status: string;
  priceCents: number | null;
  currency: string | null;
  /**
   * `metadata.donation.receiptSent`. Null when the row carries no donation
   * blob at all (a Párrafo ticket, or a free RSVP).
   */
  receiptSent: boolean | null;
}

export interface SessionRevenue {
  eventId: string;
  eventName: string;
  /** YYYY-MM-DD, for stable sorting and a compact column. */
  date: string;
  /** Confirmed + used participations, contributors included. */
  rsvps: number;
  contributors: number;
  totalCents: number;
  totalDisplay: string;
  avgCents: number;
  avgDisplay: string;
  maxCents: number;
  maxDisplay: string;
  /** Share of confirmed attendees who put money in, 0–1. */
  contributionRate: number;
}

export interface SeriesRevenue {
  series: string;
  label: string;
  sessions: SessionRevenue[];
  totals: {
    sessions: number;
    rsvps: number;
    contributors: number;
    totalCents: number;
    totalDisplay: string;
    avgCents: number;
    avgDisplay: string;
    contributionRate: number;
  };
}

export interface SinergiaRevenueSummary {
  series: SeriesRevenue[];
  totals: {
    sessions: number;
    rsvps: number;
    contributors: number;
    totalCents: number;
    totalDisplay: string;
    /** Average per contributor, not per attendee. */
    avgCents: number;
    avgDisplay: string;
    contributionRate: number;
  };
  /** Paid rows later cancelled — excluded from every total above. */
  cancelled: {
    eventId: string;
    count: number;
    totalCents: number;
    totalDisplay: string;
  }[];
  /** Counted-status rows priced in something other than ARS — excluded. */
  otherCurrencies: { currency: string; count: number; totalCents: number }[];
  /** Counted donations whose receipt email never went out. */
  pendingReceipts: { eventId: string; count: number }[];
}

const SERIES_LABELS: Record<string, string> = {
  sinergia: "Sinergia",
  "sinergia-parrafo": "Sinergia × Párrafo",
};

export function seriesLabel(series: string): string {
  return SERIES_LABELS[series] ?? series;
}

/** Statuses that represent a real, standing participation. */
const COUNTED_STATUSES = new Set(["confirmed", "used"]);

/** NULL currency means ARS — that is what the client renders too. */
function normalizeCurrency(currency: string | null): string {
  return (currency ?? "ARS").toUpperCase();
}

function isoDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value).slice(0, 10)
    : d.toISOString().slice(0, 10);
}

function money(cents: number): string {
  return formatArs(Math.round(cents / 100));
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

interface SessionAccumulator {
  eventId: string;
  eventName: string;
  date: string;
  series: string;
  rsvps: number;
  contributors: number;
  totalCents: number;
  maxCents: number;
}

/**
 * Roll a flat list of participation rows into per-session, per-series and
 * overall revenue. Pure — the script does the SQL, this does the arithmetic,
 * which is the half worth testing.
 */
export function summarizeSinergiaRevenue(
  rows: SinergiaRevenueRow[],
): SinergiaRevenueSummary {
  const sessions = new Map<string, SessionAccumulator>();
  const cancelled = new Map<string, { count: number; totalCents: number }>();
  const otherCurrencies = new Map<string, { count: number; totalCents: number }>();
  const pendingReceipts = new Map<string, number>();

  for (const row of rows) {
    const series = row.series ?? "sinergia";
    const price = row.priceCents ?? 0;
    const paid = price > 0;

    if (row.status === "cancelled") {
      if (paid) {
        const acc = cancelled.get(row.eventId) ?? { count: 0, totalCents: 0 };
        acc.count += 1;
        acc.totalCents += price;
        cancelled.set(row.eventId, acc);
      }
      continue;
    }

    if (!COUNTED_STATUSES.has(row.status)) continue;

    // The session line exists as soon as one confirmed RSVP does, donation
    // or not — a Wednesday where nobody contributed is a real data point,
    // not a gap in the table.
    let session = sessions.get(row.eventId);
    if (!session) {
      session = {
        eventId: row.eventId,
        eventName: row.eventName,
        date: isoDate(row.eventDate),
        series,
        rsvps: 0,
        contributors: 0,
        totalCents: 0,
        maxCents: 0,
      };
      sessions.set(row.eventId, session);
    }
    session.rsvps += 1;

    if (!paid) continue;

    const currency = normalizeCurrency(row.currency);
    if (currency !== "ARS") {
      const acc = otherCurrencies.get(currency) ?? { count: 0, totalCents: 0 };
      acc.count += 1;
      acc.totalCents += price;
      otherCurrencies.set(currency, acc);
      continue;
    }

    session.contributors += 1;
    session.totalCents += price;
    session.maxCents = Math.max(session.maxCents, price);

    if (row.receiptSent === false) {
      pendingReceipts.set(
        row.eventId,
        (pendingReceipts.get(row.eventId) ?? 0) + 1,
      );
    }
  }

  const bySeries = new Map<string, SessionAccumulator[]>();
  for (const session of sessions.values()) {
    const list = bySeries.get(session.series) ?? [];
    list.push(session);
    bySeries.set(session.series, list);
  }

  const seriesRevenue: SeriesRevenue[] = [...bySeries.entries()]
    .map(([series, list]) => {
      const ordered = [...list].sort(
        (a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId),
      );
      const rsvps = ordered.reduce((n, s) => n + s.rsvps, 0);
      const contributors = ordered.reduce((n, s) => n + s.contributors, 0);
      const totalCents = ordered.reduce((n, s) => n + s.totalCents, 0);
      const avgCents =
        contributors > 0 ? Math.round(totalCents / contributors) : 0;

      return {
        series,
        label: seriesLabel(series),
        sessions: ordered.map((s) => {
          const avg =
            s.contributors > 0 ? Math.round(s.totalCents / s.contributors) : 0;
          return {
            eventId: s.eventId,
            eventName: s.eventName,
            date: s.date,
            rsvps: s.rsvps,
            contributors: s.contributors,
            totalCents: s.totalCents,
            totalDisplay: money(s.totalCents),
            avgCents: avg,
            avgDisplay: money(avg),
            maxCents: s.maxCents,
            maxDisplay: money(s.maxCents),
            contributionRate: ratio(s.contributors, s.rsvps),
          };
        }),
        totals: {
          sessions: ordered.length,
          rsvps,
          contributors,
          totalCents,
          totalDisplay: money(totalCents),
          avgCents,
          avgDisplay: money(avgCents),
          contributionRate: ratio(contributors, rsvps),
        },
      };
    })
    .sort((a, b) => b.totals.totalCents - a.totals.totalCents);

  const rsvps = seriesRevenue.reduce((n, s) => n + s.totals.rsvps, 0);
  const contributors = seriesRevenue.reduce(
    (n, s) => n + s.totals.contributors,
    0,
  );
  const totalCents = seriesRevenue.reduce((n, s) => n + s.totals.totalCents, 0);
  const avgCents = contributors > 0 ? Math.round(totalCents / contributors) : 0;

  return {
    series: seriesRevenue,
    totals: {
      sessions: seriesRevenue.reduce((n, s) => n + s.totals.sessions, 0),
      rsvps,
      contributors,
      totalCents,
      totalDisplay: money(totalCents),
      avgCents,
      avgDisplay: money(avgCents),
      contributionRate: ratio(contributors, rsvps),
    },
    cancelled: [...cancelled.entries()]
      .map(([eventId, acc]) => ({
        eventId,
        count: acc.count,
        totalCents: acc.totalCents,
        totalDisplay: money(acc.totalCents),
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
    otherCurrencies: [...otherCurrencies.entries()]
      .map(([currency, acc]) => ({ currency, ...acc }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    pendingReceipts: [...pendingReceipts.entries()]
      .map(([eventId, count]) => ({ eventId, count }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
  };
}

/** `0.4` → `"40%"`. Whole percents; this is a headline figure, not stats. */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
