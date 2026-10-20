import { describe, it, expect } from "vitest";
import {
  HACKEA_MAX_QUANTITY,
  formatArsLabel,
  hackeaConfig,
  hackeaGroupDiscountPercent,
  hackeaGroupPriceCents,
  hackeaGroupSavingsCents,
  hackeaPerPersonCents,
} from "./hackea";

describe("hackeaConfig.ticketPriceLabel", () => {
  it("is derived from ticketPriceCents", () => {
    expect(hackeaConfig.ticketPriceLabel).toBe("$21.300");
    expect(hackeaConfig.ticketPriceLabel).toBe(formatArsLabel(hackeaConfig.ticketPriceCents));
  });

  it("formats whole pesos with the es-AR thousands separator", () => {
    expect(formatArsLabel(930_000)).toBe("$9.300");
    expect(formatArsLabel(50_000)).toBe("$500");
    expect(formatArsLabel(123_456_700)).toBe("$1.234.567");
  });
});

describe("group tiers", () => {
  const quantities = Array.from({ length: HACKEA_MAX_QUANTITY }, (_, i) => i + 1);

  it("charges the single price for one entrada", () => {
    expect(hackeaGroupPriceCents(1)).toBe(hackeaConfig.ticketPriceCents);
    expect(hackeaGroupSavingsCents(1)).toBe(0);
    expect(hackeaGroupDiscountPercent(1)).toBe(0);
  });

  it("pins the published tiers", () => {
    expect(quantities.map((q) => formatArsLabel(hackeaPerPersonCents(q)))).toEqual([
      "$21.300",
      "$16.900",
      "$15.300",
      "$13.900",
    ]);
    expect(quantities.map((q) => formatArsLabel(hackeaGroupPriceCents(q)))).toEqual([
      "$21.300",
      "$33.800",
      "$45.900",
      "$55.600",
    ]);
    expect(quantities.map((q) => formatArsLabel(hackeaGroupSavingsCents(q)))).toEqual([
      "$0",
      "$8.800",
      "$18.000",
      "$29.600",
    ]);
    expect(quantities.map(hackeaGroupDiscountPercent)).toEqual([0, 20, 28, 34]);
  });

  it("gets cheaper per person with every tier, never past 35% off", () => {
    for (const q of quantities.slice(1)) {
      expect(hackeaPerPersonCents(q)).toBeLessThan(hackeaPerPersonCents(q - 1));
      expect(hackeaGroupDiscountPercent(q)).toBeLessThan(35);
      // Per-person price divides the total exactly — no rounding in the copy.
      expect(hackeaPerPersonCents(q) * q).toBe(hackeaGroupPriceCents(q));
    }
  });

  it("makes four cheaper than three single entradas", () => {
    expect(hackeaGroupPriceCents(4)).toBeLessThan(3 * hackeaConfig.ticketPriceCents);
  });

  it("reads an out-of-range quantity as one", () => {
    expect(hackeaGroupPriceCents(0)).toBe(hackeaConfig.ticketPriceCents);
    expect(hackeaGroupPriceCents(HACKEA_MAX_QUANTITY + 1)).toBe(hackeaConfig.ticketPriceCents);
  });
});
