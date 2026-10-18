import { describe, it, expect } from "vitest";
import { validateHackeaLead } from "./hackea-validation";

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
});
