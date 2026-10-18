import { describe, it, expect } from "vitest";
import { HACKEA_MAX_LENGTH, validateHackeaLead } from "./hackea-validation";

describe("validateHackeaLead", () => {
  it("accepts name + WhatsApp without email, and trims", () => {
    expect(
      validateHackeaLead({ name: "  Lucía  ", phone: " +54 9 11 1234-5678 ", email: "  " }),
    ).toEqual({ ok: true, value: { name: "Lucía", phone: "+54 9 11 1234-5678" } });
  });

  it("keeps a valid email", () => {
    expect(
      validateHackeaLead({ name: "Lucía", phone: "1112345678", email: " lu@mail.com " }),
    ).toEqual({
      ok: true,
      value: { name: "Lucía", phone: "1112345678", email: "lu@mail.com" },
    });
  });

  it("reports every invalid field, in form order", () => {
    expect(validateHackeaLead({ name: " ", phone: "1234", email: "nope" })).toEqual({
      ok: false,
      errors: ["name", "phone", "email"],
    });
  });

  it("rejects a phone with letters or too many digits", () => {
    expect(validateHackeaLead({ name: "A", phone: "11 abcd 5678" }).ok).toBe(false);
    expect(validateHackeaLead({ name: "A", phone: "1".repeat(16) }).ok).toBe(false);
  });

  it("rejects an email without a TLD", () => {
    expect(validateHackeaLead({ name: "A", phone: "1112345678", email: "a@gmail" })).toEqual({
      ok: false,
      errors: ["email"],
    });
  });

  it("treats non-string input as missing", () => {
    expect(validateHackeaLead({ name: 42, phone: null, email: {} })).toEqual({
      ok: false,
      errors: ["name", "phone"],
    });
  });

  describe("length caps", () => {
    const phone = "1112345678";

    it("accepts a name at the cap (after trim) and rejects one over it", () => {
      const atCap = "a".repeat(HACKEA_MAX_LENGTH.name);
      expect(validateHackeaLead({ name: `  ${atCap}  `, phone }).ok).toBe(true);
      expect(validateHackeaLead({ name: `${atCap}a`, phone })).toEqual({
        ok: false,
        errors: ["name"],
      });
    });

    it("accepts an email at 254 chars and rejects 255", () => {
      const at = (len: number) => `${"a".repeat(len - "@mail.com".length)}@mail.com`;
      expect(at(254)).toHaveLength(254);
      expect(validateHackeaLead({ name: "A", phone, email: at(254) }).ok).toBe(true);
      expect(validateHackeaLead({ name: "A", phone, email: at(255) })).toEqual({
        ok: false,
        errors: ["email"],
      });
    });

    it("rejects a valid-digit phone padded past 40 chars", () => {
      const padded = `+54 9 11 1234-5678${" ".repeat(10)}${"-".repeat(20)}`;
      expect(padded.trim().length).toBeGreaterThan(HACKEA_MAX_LENGTH.phone);
      expect(validateHackeaLead({ name: "A", phone: padded })).toEqual({
        ok: false,
        errors: ["phone"],
      });
      const ok = "+54 (9) 11 1234-5678";
      expect(validateHackeaLead({ name: "A", phone: ok }).ok).toBe(true);
    });
  });
});
