import { describe, expect, it } from "vitest";
import {
  companionTicketId,
  companionTicketIds,
  MAX_TICKETS_PER_PURCHASE,
  parseTicketQuantity,
} from "./brote-ticket-ids";

describe("companionTicketId", () => {
  it("is deterministic — the same payment and index always give the same id", () => {
    // This is the whole point. Two concurrent webhook deliveries of one
    // payment must compute identical ids so `ON CONFLICT (id) DO NOTHING`
    // can dedup them; companion rows get no uniqueness from the database.
    expect(companionTicketId("MP-1", 0)).toBe(companionTicketId("MP-1", 0));
    expect(companionTicketIds("MP-1", 3)).toEqual(companionTicketIds("MP-1", 3));
  });

  it("differs per index and per payment", () => {
    const a = companionTicketIds("MP-1", 3);
    expect(new Set(a).size).toBe(3);
    expect(companionTicketId("MP-1", 0)).not.toBe(companionTicketId("MP-2", 0));
  });

  it("looks exactly like a primary ticket id", () => {
    // The QR, the gate and the admin lookup all treat ids opaquely; a
    // companion that is visibly different would leak "you're the spare".
    for (const id of companionTicketIds("MP-1", 5)) {
      expect(id).toMatch(/^BROTE2-[0-9A-Z]{8}$/);
    }
  });
});

describe("parseTicketQuantity", () => {
  it("accepts a string, because MercadoPago's REST response sends one", () => {
    // The SDK types additional_info.items[].quantity as a number while the
    // REST payload returns "3". Coercing is load-bearing: without it every
    // multi-ticket purchase silently issues exactly one ticket.
    expect(parseTicketQuantity("3")).toBe(3);
    expect(parseTicketQuantity(" 3 ")).toBe(3);
    expect(parseTicketQuantity(3)).toBe(3);
  });

  it.each([
    [undefined, 1],
    [null, 1],
    ["", 1],
    ["abc", 1],
    [NaN, 1],
    [0, 1],
    [-5, 1],
    [2.7, 2],
    [Infinity, 1],
    [999, MAX_TICKETS_PER_PURCHASE],
    [{}, 1],
  ])("clamps %p to %p", (input, expected) => {
    expect(parseTicketQuantity(input)).toBe(expected);
  });

  it("never exceeds the ceiling, so a tampered value cannot mint a thousand rows", () => {
    expect(parseTicketQuantity(10_000)).toBe(MAX_TICKETS_PER_PURCHASE);
    expect(parseTicketQuantity("10000")).toBe(MAX_TICKETS_PER_PURCHASE);
  });
});
