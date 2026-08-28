import { describe, expect, it } from "vitest";
import {
  formatRate,
  seriesLabel,
  summarizeSinergiaRevenue,
  type SinergiaRevenueRow,
} from "./sinergia-revenue";

function row(over: Partial<SinergiaRevenueRow> = {}): SinergiaRevenueRow {
  return {
    eventId: "sinergia-2026-04-22",
    eventName: "Sinergia — 2026-04-22",
    eventDate: "2026-04-22T22:30:00.000Z",
    series: "sinergia",
    status: "confirmed",
    priceCents: 1_000_000,
    currency: "ARS",
    receiptSent: true,
    ...over,
  };
}

describe("summarizeSinergiaRevenue", () => {
  it("sums contributions per session and overall", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 500_000 }),
      row({ priceCents: 1_000_000 }),
      row({ priceCents: 2_000_000 }),
    ]);

    expect(s.totals.contributors).toBe(3);
    expect(s.totals.totalCents).toBe(3_500_000);
    expect(s.totals.totalDisplay).toBe("$35.000");
    expect(s.series[0].sessions[0].maxDisplay).toBe("$20.000");
  });

  it("counts free RSVPs as attendance but not as revenue", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000 }),
      row({ priceCents: null }),
      row({ priceCents: 0 }),
    ]);

    const session = s.series[0].sessions[0];
    expect(session.rsvps).toBe(3);
    expect(session.contributors).toBe(1);
    expect(session.totalCents).toBe(1_000_000);
    expect(session.contributionRate).toBeCloseTo(1 / 3);
  });

  it("keeps a session with zero contributions on the table", () => {
    // A Wednesday where nobody put money in is a data point, not a gap.
    const s = summarizeSinergiaRevenue([row({ priceCents: null })]);

    expect(s.totals.sessions).toBe(1);
    expect(s.series[0].sessions[0].totalDisplay).toBe("$0");
    expect(s.series[0].sessions[0].avgCents).toBe(0);
  });

  it("averages per contributor, not per attendee", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000 }),
      row({ priceCents: 2_000_000 }),
      row({ priceCents: null }),
      row({ priceCents: null }),
    ]);

    expect(s.totals.avgCents).toBe(1_500_000);
    expect(s.totals.avgDisplay).toBe("$15.000");
  });

  it("excludes cancelled rows from the total and lists them apart", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000 }),
      row({ priceCents: 2_000_000, status: "cancelled" }),
    ]);

    expect(s.totals.totalCents).toBe(1_000_000);
    expect(s.totals.rsvps).toBe(1);
    expect(s.cancelled).toEqual([
      {
        eventId: "sinergia-2026-04-22",
        count: 1,
        totalCents: 2_000_000,
        totalDisplay: "$20.000",
      },
    ]);
  });

  it("ignores pending and waitlist rows even when they carry a price", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000 }),
      row({ priceCents: 9_900_000, status: "pending" }),
      row({ priceCents: 9_900_000, status: "waitlist" }),
      row({ priceCents: 9_900_000, status: "no_show" }),
    ]);

    expect(s.totals.totalCents).toBe(1_000_000);
    expect(s.totals.rsvps).toBe(1);
  });

  it("counts `used` rows — marked at the door, still money in", () => {
    const s = summarizeSinergiaRevenue([
      row({ status: "used", priceCents: 1_000_000 }),
    ]);

    expect(s.totals.contributors).toBe(1);
    expect(s.totals.totalCents).toBe(1_000_000);
  });

  it("treats a NULL currency as ARS", () => {
    const s = summarizeSinergiaRevenue([
      row({ currency: null, priceCents: 500_000 }),
    ]);

    expect(s.totals.totalCents).toBe(500_000);
    expect(s.otherCurrencies).toEqual([]);
  });

  it("never mixes a non-ARS row into the peso total", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000 }),
      row({ currency: "USD", priceCents: 5_000 }),
    ]);

    expect(s.totals.totalCents).toBe(1_000_000);
    expect(s.totals.contributors).toBe(1);
    // Still an attendee — only the money is set aside.
    expect(s.totals.rsvps).toBe(2);
    expect(s.otherCurrencies).toEqual([
      { currency: "USD", count: 1, totalCents: 5_000 },
    ]);
  });

  it("counts a donation whose receipt never went out, and flags it", () => {
    const s = summarizeSinergiaRevenue([
      row({ priceCents: 1_000_000, receiptSent: false }),
    ]);

    expect(s.totals.totalCents).toBe(1_000_000);
    expect(s.pendingReceipts).toEqual([
      { eventId: "sinergia-2026-04-22", count: 1 },
    ]);
  });

  it("does not flag a paid ticket that carries no donation blob", () => {
    // Sinergia × Párrafo rows have `receiptSent: null` — no donation
    // metadata at all. That is not a missing receipt.
    const s = summarizeSinergiaRevenue([
      row({ series: "sinergia-parrafo", receiptSent: null }),
    ]);

    expect(s.pendingReceipts).toEqual([]);
  });

  it("groups by series and orders sessions chronologically", () => {
    const s = summarizeSinergiaRevenue([
      row({
        eventId: "sinergia-2026-05-06",
        eventDate: "2026-05-06T22:30:00.000Z",
        priceCents: 500_000,
      }),
      row({
        eventId: "sinergia-2026-04-22",
        eventDate: "2026-04-22T22:30:00.000Z",
        priceCents: 500_000,
      }),
      row({
        eventId: "sinergia-parrafo-2026-05-16",
        eventName: "Sinergia × Párrafo",
        eventDate: "2026-05-16T22:30:00.000Z",
        series: "sinergia-parrafo",
        priceCents: 3_300_000,
      }),
    ]);

    // Párrafo first: series are ordered by what they collected.
    expect(s.series.map((g) => g.series)).toEqual([
      "sinergia-parrafo",
      "sinergia",
    ]);
    expect(s.series[1].sessions.map((x) => x.date)).toEqual([
      "2026-04-22",
      "2026-05-06",
    ]);
    expect(s.totals.sessions).toBe(3);
    expect(s.totals.totalDisplay).toBe("$43.000");
  });

  it("returns empty totals for no rows", () => {
    const s = summarizeSinergiaRevenue([]);

    expect(s.series).toEqual([]);
    expect(s.totals.totalCents).toBe(0);
    expect(s.totals.totalDisplay).toBe("$0");
    expect(s.totals.contributionRate).toBe(0);
  });
});

describe("seriesLabel", () => {
  it("names the known series and passes anything else through", () => {
    expect(seriesLabel("sinergia")).toBe("Sinergia");
    expect(seriesLabel("sinergia-parrafo")).toBe("Sinergia × Párrafo");
    expect(seriesLabel("sinergia-otro")).toBe("sinergia-otro");
  });
});

describe("formatRate", () => {
  it("renders whole percents", () => {
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(0.4)).toBe("40%");
    expect(formatRate(1)).toBe("100%");
  });
});
