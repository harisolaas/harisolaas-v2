import { describe, it, expect } from "vitest";
import { formatArsLabel, hackeaConfig } from "./hackea";

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
