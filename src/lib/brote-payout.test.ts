import { describe, expect, it } from "vitest";
import { isPaid, summarizePayout, type PayoutRow } from "./brote-payout";

/**
 * The whole point of this report is that it cannot be inflated by anything
 * that isn't a real payment, so most of these tests are about what it
 * REFUSES to count.
 */

function row(over: Partial<PayoutRow> = {}): PayoutRow {
  return {
    invite: "jose",
    priceCents: 2475000,
    status: "confirmed",
    externalPaymentId: "MP-1",
    ...over,
  };
}

describe("isPaid", () => {
  it("requires both a payment id and a non-zero price", () => {
    expect(isPaid(row())).toBe(true);
    expect(isPaid(row({ externalPaymentId: null }))).toBe(false);
    expect(isPaid(row({ priceCents: null }))).toBe(false);
    expect(isPaid(row({ priceCents: 0 }))).toBe(false);
  });

  it("rejects a comped ticket", () => {
    // `gift-ticket` in the admin writes `GIFT-…` as the payment id but no
    // price, so it must not earn anyone a fee.
    expect(isPaid(row({ externalPaymentId: "GIFT-X", priceCents: null }))).toBe(
      false,
    );
  });
});

describe("summarizePayout", () => {
  it("counts tickets and sums revenue per collaborator", () => {
    const s = summarizePayout([
      row({ invite: "jose" }),
      row({ invite: "jose" }),
      row({ invite: "gian", priceCents: 3300000 }),
    ]);

    const jose = s.collaborators.find((c) => c.slug === "jose")!;
    expect(jose.tickets).toBe(2);
    expect(jose.revenueCents).toBe(4950000);
    expect(jose.revenueDisplay).toBe("$49.500");
    expect(jose.name).toBe("José Dezanzo");
    expect(jose.kind).toBe("artist");

    expect(s.totals.tickets).toBe(3);
    expect(s.totals.revenueDisplay).toBe("$82.500");
  });

  it("ignores rows with no payment — the whole reason this exists", () => {
    // A free plant registration can carry any link_slug it likes. It cannot
    // carry a payment, so it cannot reach this report.
    const s = summarizePayout([
      row({ invite: "jose" }),
      row({ invite: "jose", externalPaymentId: null, priceCents: null }),
      row({ invite: "jose", priceCents: 0 }),
    ]);

    expect(s.collaborators.find((c) => c.slug === "jose")!.tickets).toBe(1);
  });

  it("ignores rows with no invite at all", () => {
    const s = summarizePayout([row({ invite: null }), row({ invite: "" })]);
    expect(s.collaborators).toHaveLength(0);
    expect(s.totals.tickets).toBe(0);
  });

  it("surfaces an unrecognised invite instead of dropping it", () => {
    // A renamed slug would otherwise vanish from the report and the
    // collaborator would simply not get paid, with nothing to notice.
    const s = summarizePayout([
      row({ invite: "jose" }),
      row({ invite: "artista-viejo" }),
      row({ invite: "artista-viejo" }),
    ]);

    expect(s.unknownInvites).toEqual([{ invite: "artista-viejo", tickets: 2 }]);
    expect(s.totals.tickets).toBe(1);
  });

  it("separates cancelled tickets instead of silently counting them", () => {
    const s = summarizePayout([
      row({ invite: "jose" }),
      row({ invite: "jose", status: "cancelled" }),
    ]);

    expect(s.collaborators.find((c) => c.slug === "jose")!.tickets).toBe(1);
    expect(s.cancelled).toEqual([
      { slug: "jose", tickets: 1, revenueCents: 2475000 },
    ]);
  });

  it("counts a no-show — they paid, the collaborator sold it", () => {
    const s = summarizePayout([row({ invite: "jose", status: "no_show" })]);
    expect(s.collaborators.find((c) => c.slug === "jose")!.tickets).toBe(1);
  });

  it("counts a used ticket — scanned at the door is still a sale", () => {
    const s = summarizePayout([row({ invite: "gian", status: "used" })]);
    expect(s.collaborators.find((c) => c.slug === "gian")!.tickets).toBe(1);
  });

  it("charges a fee for artists only, never brands or the community", () => {
    // Brands and the returning-community page discount their own audience;
    // nobody owes them anything. Applying the rate to them prints a
    // plausible table that overstates what has to be paid.
    const s = summarizePayout(
      [
        row({ invite: "jose" }),
        row({ invite: "pulso", priceCents: 2145000 }),
        row({ invite: "comunidad", priceCents: 2145000 }),
      ],
      300000, // $3.000 per ticket
    );

    const by = (slug: string) => s.collaborators.find((c) => c.slug === slug)!;
    expect(by("jose").feeCents).toBe(300000);
    expect(by("pulso").feeCents).toBeUndefined();
    expect(by("comunidad").feeCents).toBeUndefined();

    // …and the total is the artists' fees only, not 3 × the rate.
    expect(s.totals.feeCents).toBe(300000);
    expect(s.totals.feeDisplay).toBe("$3.000");

    // Sales of every kind still count toward tickets and revenue — this is
    // a sales report as well as a payout one.
    expect(s.totals.tickets).toBe(3);
  });

  it("reports the returning-community page like any other seller", () => {
    const s = summarizePayout([row({ invite: "comunidad", priceCents: 2145000 })]);
    const comunidad = s.collaborators.find((c) => c.slug === "comunidad")!;
    expect(comunidad.kind).toBe("community");
    expect(comunidad.revenueDisplay).toBe("$21.450");
  });

  it("applies a fee per ticket only when one is given", () => {
    const rows = [row({ invite: "jose" }), row({ invite: "jose" })];

    expect(summarizePayout(rows).collaborators[0].feeCents).toBeUndefined();
    expect(summarizePayout(rows).totals.feeCents).toBeUndefined();

    const withFee = summarizePayout(rows, 300000); // $3.000 per ticket
    expect(withFee.collaborators[0].feeCents).toBe(600000);
    expect(withFee.collaborators[0].feeDisplay).toBe("$6.000");
    expect(withFee.totals.feeDisplay).toBe("$6.000");
  });

  it("sorts by tickets so the biggest debt reads first", () => {
    const s = summarizePayout([
      row({ invite: "gian" }),
      row({ invite: "jose" }),
      row({ invite: "jose" }),
      row({ invite: "jose" }),
    ]);
    expect(s.collaborators.map((c) => c.slug)).toEqual(["jose", "gian"]);
  });

  it("reports brands too — they don't earn a fee but they do sell", () => {
    const s = summarizePayout([row({ invite: "pulso", priceCents: 2145000 })]);
    const pulso = s.collaborators.find((c) => c.slug === "pulso")!;
    expect(pulso.kind).toBe("brand");
    expect(pulso.revenueDisplay).toBe("$21.450");
  });

  it("returns an empty summary for no rows", () => {
    const s = summarizePayout([]);
    expect(s.collaborators).toHaveLength(0);
    expect(s.totals.tickets).toBe(0);
    expect(s.totals.revenueDisplay).toBe("$0");
    expect(s.unknownInvites).toHaveLength(0);
  });
});
