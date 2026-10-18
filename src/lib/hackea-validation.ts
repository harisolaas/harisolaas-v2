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

/**
 * Upper bounds, in characters after trimming. The landing sets the same
 * values as `maxLength` on its inputs. Email: RFC 5321's 254. Phone: the
 * digit count is already capped at 15; this bounds the separators around
 * them so a padded string can't reach the DB.
 */
export const HACKEA_MAX_LENGTH: Record<HackeaField, number> = {
  name: 120,
  phone: 40,
  email: 254,
};

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
  if (!name || name.length > HACKEA_MAX_LENGTH.name) errors.push("name");
  if (phone.length > HACKEA_MAX_LENGTH.phone || !isValidWhatsApp(phone)) {
    errors.push("phone");
  }
  if (email && (email.length > HACKEA_MAX_LENGTH.email || !isValidEmail(email))) {
    errors.push("email");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: email ? { name, phone, email } : { name, phone } };
}
