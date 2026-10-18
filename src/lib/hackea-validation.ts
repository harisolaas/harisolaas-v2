// Hackeá tu mente — validation of the purchase form, shared by the landing
// (client) and POST /api/hackea/checkout (server). Pure: no server imports,
// so the client bundle can use it and both sides reject the same input.
import { isValidEmail, isValidWhatsApp } from "./plant-types";

export type HackeaField = "name" | "phone" | "email";

export interface HackeaLeadInput {
  name: string;
  phone: string;
  /** Optional by design: people can buy with WhatsApp only. */
  email?: string;
}

export type HackeaValidation =
  | { ok: true; value: HackeaLeadInput }
  | { ok: false; errors: HackeaField[] };

const asTrimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Name: trimmed, non-empty. WhatsApp: `isValidWhatsApp` (8–15 digits after
 * stripping separators). Email: optional — blank means "no email", anything
 * else must pass `isValidEmail`. Errors come back in form order.
 */
export function validateHackeaLead(raw: {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
}): HackeaValidation {
  const name = asTrimmed(raw.name);
  const phone = asTrimmed(raw.phone);
  const email = asTrimmed(raw.email);

  const errors: HackeaField[] = [];
  if (!name) errors.push("name");
  if (!isValidWhatsApp(phone)) errors.push("phone");
  if (email && !isValidEmail(email)) errors.push("email");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: email ? { name, phone, email } : { name, phone } };
}
