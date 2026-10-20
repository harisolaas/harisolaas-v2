// Hackeá tu mente — validation of the purchase form, shared by the landing
// (client) and POST /api/hackea/checkout (server). Pure: no server imports,
// so the client bundle can use it and both sides reject the same input.
import { isValidEmail } from "./plant-types";
import { parseHackeaWhatsApp } from "./hackea-phone";
import { isHackeaQuantity } from "../data/hackea";

/** Form order: the quantity select sits above the identity fields. */
export type HackeaField = "quantity" | "name" | "phone" | "email";
export type HackeaTextField = Exclude<HackeaField, "quantity">;

export interface HackeaLeadInput {
  name: string;
  phone: string;
  /** Optional by design: people can buy with WhatsApp only. */
  email?: string;
  /** Entradas in this purchase, 1..HACKEA_MAX_QUANTITY. */
  quantity: number;
}

export type HackeaValidation =
  | { ok: true; value: HackeaLeadInput }
  | { ok: false; errors: HackeaField[] };

/**
 * Upper bounds, in characters after trimming. The landing sets the same
 * values as `maxLength` on its inputs. Email: RFC 5321's 254. Phone: E.164
 * already caps the digits at 15; this bounds the separators around them so
 * a padded string can't reach the DB.
 */
export const HACKEA_MAX_LENGTH: Record<HackeaTextField, number> = {
  name: 120,
  phone: 40,
  email: 254,
};

const asTrimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Name: trimmed, non-empty. WhatsApp: a real mobile number per
 * `parseHackeaWhatsApp` (any AR spelling, or a foreign one with `+`/`00`). Email: optional — blank means "no email", anything
 * else must pass `isValidEmail`. Quantity: missing means 1, anything else
 * must be an integer 1..HACKEA_MAX_QUANTITY. Errors come back in form order.
 */
export function validateHackeaLead(raw: {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  quantity?: unknown;
}): HackeaValidation {
  const name = asTrimmed(raw.name);
  const phone = asTrimmed(raw.phone);
  const email = asTrimmed(raw.email);

  const quantity = raw.quantity === undefined ? 1 : raw.quantity;

  const errors: HackeaField[] = [];
  if (!isHackeaQuantity(quantity)) errors.push("quantity");
  if (!name || name.length > HACKEA_MAX_LENGTH.name) errors.push("name");
  if (phone.length > HACKEA_MAX_LENGTH.phone || parseHackeaWhatsApp(phone) === null) {
    errors.push("phone");
  }
  if (email && (email.length > HACKEA_MAX_LENGTH.email || !isValidEmail(email))) {
    errors.push("email");
  }

  if (errors.length > 0) return { ok: false, errors };
  const q = quantity as number;
  return {
    ok: true,
    value: email ? { name, phone, email, quantity: q } : { name, phone, quantity: q },
  };
}
