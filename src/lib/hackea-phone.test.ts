import { describe, it, expect } from "vitest";
import mobileMetadata from "libphonenumber-js/metadata.mobile.json";
import { AR_AREA_CODES, parseHackeaWhatsApp } from "./hackea-phone";
import { validateHackeaLead } from "./hackea-validation";
import { normalizeArPhone } from "./hackea";
import { canonicalPhoneDigits, phoneMatchCandidates } from "./community";

// The table Hari asked for: what a buyer can type in the WhatsApp field.
// Valid inputs map to the E.164 the server stores (and wa.me dials).
const ACCEPTED: [string, string][] = [
  // Argentina — CABA/AMBA, every way people spell their own celular
  ["11 2345-6789", "+5491123456789"],
  ["1123456789", "+5491123456789"],
  ["011 2345-6789", "+5491123456789"],
  ["011 15 2345-6789", "+5491123456789"],
  ["(011) 15-2345-6789", "+5491123456789"],
  ["11 15 2345 6789", "+5491123456789"],
  ["9 11 2345 6789", "+5491123456789"],
  ["+54 9 11 2345 6789", "+5491123456789"],
  ["+54 (9) 11 2345-6789", "+5491123456789"],
  ["+54 11 2345 6789", "+5491123456789"],
  ["+54 11 15 2345 6789", "+5491123456789"],
  ["5491123456789", "+5491123456789"],
  ["541123456789", "+5491123456789"],
  ["0054 9 11 2345 6789", "+5491123456789"],
  ["00 54 11 2345 6789", "+5491123456789"],
  // Argentina — interior, 3- and 4-digit area codes, with and without 15
  ["2235 12-3456", "+5492235123456"],
  ["0223 15 512-3456", "+5492235123456"],
  ["0351 15 612-3456", "+5493516123456"],
  ["351 15 612 3456", "+5493516123456"],
  ["0351 612 3456", "+5493516123456"],
  ["0261 15 512-3456", "+5492615123456"],
  ["299 412 3456", "+5492994123456"],
  ["+54 9 3794 12 3456", "+5493794123456"],
  // Argentina — real-looking numbers outside libphonenumber's mobile blocks,
  // accepted by the area-code fallback
  ["221 7123456", "+5492217123456"],
  ["223 7123456", "+5492237123456"],
  ["261 9123456", "+5492619123456"],
  ["264 7123456", "+5492647123456"],
  ["299 7123456", "+5492997123456"],
  ["342 7123456", "+5493427123456"],
  ["362 7123456", "+5493627123456"],
  ["381 9123456", "+5493819123456"],
  ["387 9123456", "+5493879123456"],
  ["3755 912345", "+5493755912345"],
  ["0221 15 712-3456", "+5492217123456"],
  ["+54 9 221 712 3456", "+5492217123456"],
  ["11 9123 4567", "+5491191234567"],
  // Argentina — 4-digit spelling plus 15, which the parser doesn't strip
  ["2944 15 423456", "+5492944423456"],
  ["02944 15 423456", "+5492944423456"],
  ["+54 9 2944 15 42-3456", "+5492944423456"],
  ["3624 15 423456", "+5493624423456"],
  ["3884 15 423456", "+5493884423456"],
  ["2364 15 423456", "+5492364423456"],
  // Argentina — repeated digits that are still real numbers
  ["11 2000 0000", "+5491120000000"],
  ["11 5555 5555", "+5491155555555"],
  ["351 777 7777", "+5493517777777"],
  // Foreign mobiles, with + or 00
  ["+1 415 555 2671", "+14155552671"],
  ["001 415 555 2671", "+14155552671"],
  ["+34 612 34 56 78", "+34612345678"],
  ["0034 612 345 678", "+34612345678"],
  ["+598 94 123 456", "+59894123456"],
  ["+55 11 91234 5678", "+5511912345678"],
  ["+44 7911 123456", "+447911123456"],
];

const REJECTED: [string, string][] = [
  ["12345678", "too short, no area code"],
  ["11111111", "too short"],
  ["15 2345 6789", "no area code"],
  ["11 2345 678", "one digit short for area 11"],
  ["11 2345 67890", "one digit long for area 11"],
  ["1234567890", "area code 12 doesn't exist"],
  ["0000000000", "not a number"],
  ["+54 9 999 123 4567", "area code 999 doesn't exist"],
  ["+54 9 351 123 4567", "unallocated range (subscriber can't start with 1)"],
  ["0800 222 1234", "toll-free, not a mobile"],
  ["1111111111", "repeated digits"],
  ["+54 9 11 1111 1111", "repeated digits"],
  ["11 0000 0000", "subscriber all zeros"],
  ["11 1111 1111", "repeated digits"],
  ["+54 9 351 000 0000", "subscriber all zeros"],
  ["+54 9 351 111 1111", "subscriber all ones"],
  ["+54 9 999 712 3456", "area code 999 doesn't exist"],
  ["221 012 3456", "subscriber can't start with 0"],
  ["221 712 345", "one digit short"],
  ["221 712 34567", "one digit long"],
  ["2944 15 42345", "15 spelling, one digit short"],
  ["0810 222 1234", "shared-cost, not a mobile"],
  ["+44 20 7946 0958", "foreign landline"],
  ["34 612 345 678", "foreign number without + reads as AR"],
  ["11 abcd 5678", "letters"],
  ["+54", "country code only"],
  ["", "empty"],
];

describe("parseHackeaWhatsApp", () => {
  it.each(ACCEPTED)("accepts %s → %s", (raw, e164) => {
    expect(parseHackeaWhatsApp(raw)).toBe(e164);
  });

  it.each(REJECTED)("rejects %s (%s)", (raw) => {
    expect(parseHackeaWhatsApp(raw)).toBeNull();
  });

  it("is idempotent on its own output", () => {
    for (const [, e164] of ACCEPTED) expect(parseHackeaWhatsApp(e164)).toBe(e164);
  });

  // AR_AREA_CODES is hardcoded from libphonenumber's AR `15` rule; if an
  // upgrade of the library changes that list, this fails so it's re-derived.
  it("knows the same AR area codes as the installed libphonenumber", () => {
    const ar = (mobileMetadata as unknown as { countries: Record<string, unknown[]> })
      .countries.AR;
    const rule = ar.find(
      (x): x is string => typeof x === "string" && x.startsWith("0?(?:(11|"),
    );
    expect(rule).toBeDefined();
    const group = rule!.slice(rule!.indexOf("(11|"), rule!.lastIndexOf("15)?"));
    const re = new RegExp(`^${group}$`);
    const derived: string[] = [];
    for (const len of [2, 3, 4]) {
      for (let i = 10 ** (len - 1); i < 10 ** len; i++) {
        if (re.test(String(i))) derived.push(String(i));
      }
    }
    expect([...AR_AREA_CODES]).toEqual(derived);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseHackeaWhatsApp("  11 2345-6789 \n")).toBe("+5491123456789");
  });
});

// The form validates with parseHackeaWhatsApp, the checkout stores
// normalizeArPhone, and locking/dedupe key on canonicalPhoneDigits. All three
// must agree on every number the form lets through.
describe("validator ⇄ normalizer agreement", () => {
  it.each(ACCEPTED)("%s: validator accepts, server stores %s", (raw, e164) => {
    expect(validateHackeaLead({ name: "A", phone: raw }).ok).toBe(true);
    expect(normalizeArPhone(raw)).toBe(e164);
  });

  it.each(ACCEPTED)("%s: the stored form keys the lock and dedupe on itself", (_raw, e164) => {
    const digits = e164.slice(1);
    expect(canonicalPhoneDigits(e164)).toBe(digits);
    expect(phoneMatchCandidates(e164)).toContain(digits);
    expect(normalizeArPhone(e164)).toBe(e164);
  });

  it.each(REJECTED)("%s: validator rejects (%s)", (raw) => {
    expect(validateHackeaLead({ name: "A", phone: raw })).toEqual({
      ok: false,
      errors: ["phone"],
    });
  });

  // Spellings the shared helper already understood keep their stored form,
  // so leads written before this change still dedupe against new ones. The
  // exceptions are spellings it used to mangle (15 outside area 11, a bare
  // leading 9, foreign `00`), which the validator now accepts correctly.
  const OLD_HELPER_MANGLED = new Set([
    "0223 15 512-3456",
    "0351 15 612-3456",
    "351 15 612 3456",
    "0261 15 512-3456",
    "0221 15 712-3456",
    "2944 15 423456",
    "02944 15 423456",
    "+54 9 2944 15 42-3456",
    "3624 15 423456",
    "3884 15 423456",
    "2364 15 423456",
    "9 11 2345 6789",
    "001 415 555 2671",
    "0034 612 345 678",
  ]);
  it.each(
    ACCEPTED.filter(([raw]) => !OLD_HELPER_MANGLED.has(raw)),
  )("%s: same as the old `+canonicalPhoneDigits` form", (raw, e164) => {
    expect(`+${canonicalPhoneDigits(raw)}`).toBe(e164);
  });
});
