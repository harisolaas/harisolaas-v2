import { describe, it, expect } from "vitest";
import {
  broteConfig,
  isEarlyBird,
  currentTicketPrice,
  earlyBirdSavings,
  formatArs,
  fillTokens,
  pricingTokens,
} from "./brote";

// Pure pricing/date logic. No DB, no server imports, no network.
//
// These guard the class of bug that costs money rather than pixels: a price
// rendered on the landing that disagrees with the price the checkout API
// charges. Before this file, that expression lived inline in three places.

/** "$24.750" -> 24750. Deliberately strict: rejects "$24,750". */
function parseArs(display: string): number {
  expect(display, `${display} must be $-prefixed`).toMatch(/^\$[\d.]+$/);
  return Number(display.slice(1).replace(/\./g, ""));
}

const AR = "-03:00";
const DEADLINE = broteConfig.earlyBirdDeadline; // "2026-08-13"

describe("formatArs", () => {
  it("groups with dots, not commas (es-AR)", () => {
    // A bare .toLocaleString() resolves to en-US in this repo's Node and
    // yields "8,250" — which reads as eight-point-two-five to the Argentine
    // buyer this page is for. That comma is the defect.
    expect(formatArs(8250)).toBe("$8.250");
    expect(formatArs(24750)).toBe("$24.750");
    expect(formatArs(33000)).toBe("$33.000");
  });
});

describe("earlyBirdSavings", () => {
  it("actually subtracts, rather than restating today's number", () => {
    // Caught a real hole: asserting only against the live config blesses a
    // hardcoded "$8.250", because the expected value is built from the same
    // two constants. Feeding prices the config has never held is what makes
    // this assertion prove the arithmetic.
    expect(earlyBirdSavings(50_000, 40_000)).toBe("$10.000");
    expect(earlyBirdSavings(1_000_000, 1)).toBe("$999.999");
    expect(earlyBirdSavings(500, 500)).toBe("$0");
  });

  it("is the real difference between the two configured prices", () => {
    expect(earlyBirdSavings()).toBe(
      formatArs(broteConfig.ticketPriceRaw - broteConfig.earlyBirdPriceRaw),
    );
  });

  it("matches the handoff's stated saving", () => {
    expect(earlyBirdSavings()).toBe("$8.250");
  });

  it("stays consistent with the display strings", () => {
    // Pins the drift bug: someone edits ticketPrice but not ticketPriceRaw,
    // and the savings line silently starts lying.
    expect(parseArs(broteConfig.ticketPrice)).toBe(broteConfig.ticketPriceRaw);
    expect(parseArs(broteConfig.earlyBirdPrice)).toBe(
      broteConfig.earlyBirdPriceRaw,
    );
  });
});

describe("isEarlyBird", () => {
  it("is true through the last second of the deadline day, Argentina time", () => {
    expect(isEarlyBird(new Date(`${DEADLINE}T23:59:59${AR}`))).toBe(true);
  });

  it("is false from midnight the next day, Argentina time", () => {
    expect(isEarlyBird(new Date("2026-08-14T00:00:00-03:00"))).toBe(false);
  });

  it("does not close early for a UTC-midnight reader", () => {
    // 01:00Z on the 14th is still 22:00 on the 13th in Buenos Aires.
    // A helper built on `new Date(deadline)` with no offset closes the
    // preventa ~3h early and drops the discount on a live ticket page.
    expect(isEarlyBird(new Date("2026-08-14T01:00:00Z"))).toBe(true);
  });

  it("is true well before the deadline", () => {
    expect(isEarlyBird(new Date("2026-08-01T12:00:00-03:00"))).toBe(true);
  });
});

describe("currentTicketPrice", () => {
  it("serves the early-bird price during the preventa", () => {
    const p = currentTicketPrice(new Date(`${DEADLINE}T23:59:59${AR}`));
    expect(p).toEqual({
      raw: broteConfig.earlyBirdPriceRaw,
      display: broteConfig.earlyBirdPrice,
      isEarlyBird: true,
    });
  });

  it("serves the general price once the preventa closes", () => {
    const p = currentTicketPrice(new Date("2026-08-14T00:00:00-03:00"));
    expect(p).toEqual({
      raw: broteConfig.ticketPriceRaw,
      display: broteConfig.ticketPrice,
      isEarlyBird: false,
    });
  });

  it("never shows a price it would not charge", () => {
    // D1. The landing renders `display`; the checkout API charges `raw`.
    // If those two ever disagree the buyer is quoted one number and billed
    // another — the exact regression collapsing the pricing block to a
    // single block would otherwise have introduced.
    for (const when of [
      new Date("2026-08-01T12:00:00-03:00"),
      new Date(`${DEADLINE}T23:59:59${AR}`),
      new Date("2026-08-14T00:00:00-03:00"),
      new Date("2026-09-01T12:00:00-03:00"),
    ]) {
      const p = currentTicketPrice(when);
      expect(parseArs(p.display), `display vs raw at ${when.toISOString()}`).toBe(
        p.raw,
      );
    }
  });
});

describe("fillTokens", () => {
  it("replaces every occurrence of a known token", () => {
    expect(fillTokens("{a} y {a} y {b}", { a: "1", b: "2" })).toBe("1 y 1 y 2");
  });

  it("leaves unknown tokens intact so they are detectable", () => {
    // This is what lets the dictionary test assert "no {token} survives".
    // Silently dropping unknowns would hide the bug instead of exposing it.
    expect(fillTokens("{known} {mystery}", { known: "ok" })).toBe(
      "ok {mystery}",
    );
  });
});

describe("pricingTokens", () => {
  it("supplies exactly the tokens the pricing copy uses", () => {
    expect(Object.keys(pricingTokens()).sort()).toEqual(["price", "savings"]);
  });

  it("carries the derived saving, not a hardcoded string", () => {
    expect(pricingTokens().savings).toBe(earlyBirdSavings());
    expect(pricingTokens().price).toBe(broteConfig.ticketPrice);
  });
});
