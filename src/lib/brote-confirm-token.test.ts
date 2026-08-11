import { describe, expect, it } from "vitest";
import {
  decodeStoredToken,
  encodeStoredToken,
} from "./brote-confirm-token";

/**
 * The browser stash that carries the capability token across the trip to
 * MercadoPago. It used to be a bare token string; it now carries the
 * quantity too, and the old shape has to keep working.
 */
describe("stored confirm token", () => {
  it("round-trips the token and the quantity", () => {
    expect(decodeStoredToken(encodeStoredToken("abc123", 3))).toEqual({
      ct: "abc123",
      qty: 3,
    });
  });

  it("T4.5 — reads the OLD bare-string format as one ticket", () => {
    // Anyone who bought before this change still has a bare token sitting in
    // their browser. Failing to read it would silently drop the contact step
    // for exactly the people who already paid.
    expect(decodeStoredToken("plain-token-value")).toEqual({
      ct: "plain-token-value",
      qty: 1,
    });
  });

  it.each([
    [null, "missing"],
    ["", "empty"],
    ["   ", "blank"],
    ["{not json", "malformed json"],
    ['{"qty":3}', "no token"],
    ['{"ct":"","qty":3}', "empty token"],
  ])("returns null for %p (%s)", (input) => {
    expect(decodeStoredToken(input as string | null)).toBeNull();
  });

  it.each([
    ['{"ct":"a","qty":0}', 1],
    ['{"ct":"a","qty":-2}', 1],
    ['{"ct":"a","qty":2.9}', 2],
    ['{"ct":"a"}', 1],
    ['{"ct":"a","qty":"3"}', 3],
  ])("normalizes a bad quantity in %p to %p", (input, expected) => {
    expect(decodeStoredToken(input)?.qty).toBe(expected);
  });
});
