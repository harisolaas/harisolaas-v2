// Hackeá tu mente — WhatsApp number parsing, shared by the landing (client)
// and the checkout (server). Pure: no server imports.
//
// Uses libphonenumber-js with its *mobile* metadata (≈24 KB gzipped, ~5 KB
// more than `min`): `min` only checks lengths, so it takes nonexistent area
// codes like `+54 9 999 …`; `mobile` knows the real mobile ranges per area
// code, which is exactly the question for a WhatsApp number.
import { parsePhoneNumberFromString, type PhoneNumber } from "libphonenumber-js/mobile";

/**
 * In Argentina a mobile and a landline look the same unless the number is
 * spelled with the `9` (international) or `15` (local) marker — and people
 * almost never type either: `11 2345-6789` is how everyone writes their own
 * celular. So an AR number that parses without the marker is retried as a
 * mobile (`+54 9 …`); it is accepted when that mobile number is valid. A
 * real landline that happens to fall in a mobile range slips through, but
 * there is no way to tell them apart and rejecting `11 2345-6789` would turn
 * away nearly every buyer.
 */
function asArMobile(parsed: PhoneNumber): PhoneNumber | undefined {
  if (parsed.countryCallingCode !== "54" || parsed.isValid()) return parsed;
  if (parsed.nationalNumber.length !== 10) return parsed;
  return parsePhoneNumberFromString(`+549${parsed.nationalNumber}`);
}

/** `11 1111-1111`, `+54 9 351 000-0000`: a placeholder, not a number. */
function hasRepeatedSubscriber(nationalNumber: string): boolean {
  return /^(\d)\1+$/.test(nationalNumber.slice(-7));
}

/**
 * The E.164 WhatsApp number (`+549…` for Argentina) for what the buyer
 * typed, or null when it isn't a valid mobile number.
 *
 * - No `+` / `00`: read as Argentine, in any local spelling — `11 2345-6789`,
 *   `011 15 2345-6789`, `0351 15 612-3456`, `2235 12-3456`, `+54 9 …`.
 * - `+` / `00` + another country code: any valid mobile of that country.
 * - Rejected: wrong length for the area code, nonexistent area codes,
 *   unallocated ranges, numbers without area code (`15 2345 6789`), foreign
 *   landlines, and repeated-digit placeholders.
 */
export function parseHackeaWhatsApp(raw: string): string | null {
  const first = parsePhoneNumberFromString(raw.trim(), "AR");
  if (!first) return null;
  const parsed = asArMobile(first);
  if (!parsed || !parsed.isValid()) return null;
  const type = parsed.getType();
  if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
  if (hasRepeatedSubscriber(parsed.nationalNumber)) return null;
  return parsed.number;
}
