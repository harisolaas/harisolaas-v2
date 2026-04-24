import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  isValidWhatsApp,
  phoneDigits,
  phoneToWaMe,
} from "./plant-types";

describe("isValidEmail", () => {
  it.each([
    "hari@harisolaas.com",
    "a@b.co",
    "a.b+c@sub.domain.org",
  ])("accepts %s", (input) => {
    expect(isValidEmail(input)).toBe(true);
  });

  it.each([
    "",
    "foo",
    "foo@",
    "foo@gmail",
    "foo@.com",
    " ",
  ])("rejects %s", (input) => {
    expect(isValidEmail(input)).toBe(false);
  });
});

describe("isValidWhatsApp", () => {
  it.each([
    "1122555110",
    "+54 9 11 2255-5110",
    "(11) 2255 5110",
    "+549 1122 555110",
    "11.2255.5110",
    "+1 415 867 5309",
  ])("accepts %s", (input) => {
    expect(isValidWhatsApp(input)).toBe(true);
  });

  it.each([
    "",
    "abc",
    "123",
    "1234567",
    "12345678901234567",
    "not-a-number",
  ])("rejects %s", (input) => {
    expect(isValidWhatsApp(input)).toBe(false);
  });
});

describe("phoneDigits", () => {
  it("strips separators", () => {
    expect(phoneDigits("+54 9 11 2255-5110")).toBe("5491122555110");
    expect(phoneDigits("(11) 2255 5110")).toBe("1122555110");
    expect(phoneDigits("1122555110")).toBe("1122555110");
  });
});

describe("phoneToWaMe", () => {
  it("prepends 549 for 10-digit AR local mobile", () => {
    expect(phoneToWaMe("1122555110")).toBe("5491122555110");
    expect(phoneToWaMe("(11) 2255 5110")).toBe("5491122555110");
    expect(phoneToWaMe("11-2255-5110")).toBe("5491122555110");
  });

  it("strips + and leaves international numbers alone", () => {
    expect(phoneToWaMe("+54 9 11 2255-5110")).toBe("5491122555110");
    expect(phoneToWaMe("+1 415 867 5309")).toBe("14158675309");
  });

  it("passes other-length local numbers through as-is", () => {
    // 11-digit AR land line without country code — broken wa.me link is
    // no worse than no link; let it pass and the recipient can copy.
    expect(phoneToWaMe("01122555110")).toBe("01122555110");
  });
});
