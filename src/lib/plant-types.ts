export type GroupType = "solo" | "con-alguien" | "grupo";

/**
 * Email validation: requires non-empty local part, @, non-empty domain,
 * a literal dot in the domain, and at least 2 chars after the last dot (TLD).
 * Catches things like "foo@gmail" (missing TLD) and "foo@.com" (empty subdomain).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * WhatsApp / phone validation: strips common separators (+, spaces, dashes,
 * parens, dots) and requires 8–15 digits. Lenient on purpose — we accept
 * both "1122555110" (AR without country code) and "+54 9 11 2255-5110"
 * (full international). Storage stays the user's trimmed input; formatting
 * is a presentation concern.
 */
const WHATSAPP_SEPARATORS_RE = /[\s\-()+.]/g;
const WHATSAPP_DIGITS_RE = /^\d{8,15}$/;
export function isValidWhatsApp(raw: string): boolean {
  const digits = raw.replace(WHATSAPP_SEPARATORS_RE, "");
  return WHATSAPP_DIGITS_RE.test(digits);
}

/**
 * Strip a phone number to digits only. Does NOT internationalize — a
 * 10-digit AR local number stays 10 digits. For `wa.me` URLs (which
 * need country code + national number), use `phoneToWaMe` instead.
 */
export function phoneDigits(raw: string): string {
  return raw.replace(WHATSAPP_SEPARATORS_RE, "");
}

/**
 * Build the digits-only number segment for a `wa.me/<digits>` URL.
 *
 * `wa.me` requires an international-format number (country code +
 * national number). Users here usually type AR local (`11 2255 5110`,
 * 10 digits), so we prepend AR mobile (`549`) when we see that shape.
 * Numbers that start with `+` are assumed to already carry a country
 * code and pass through unchanged. Everything else (including non-AR
 * locals) is passed through as-is — a broken wa.me link is no worse
 * than no link at all.
 */
export function phoneToWaMe(raw: string): string {
  const trimmed = raw.trim();
  const digits = phoneDigits(trimmed);
  if (trimmed.startsWith("+")) return digits;
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

export interface PlantRegistration {
  id: string; // PLANT-XXXXXXXX
  email: string;
  name: string;
  groupType: GroupType;
  carpool: boolean;
  status: "registered";
  message?: string;
  createdAt: string;
  utm?: { source?: string; medium?: string; campaign?: string };
}

export interface PlantWaitlistEntry {
  email: string;
  createdAt: string;
}

export interface CommunityParticipation {
  event: string; // "brote" | "plant-2026-04"
  role: string; // "attendee" | "planter"
  id: string; // ticket or registration ID
  date: string; // ISO
}

export interface CommunityPerson {
  email: string;
  name: string;
  firstSeen: string;
  participations: CommunityParticipation[];
}
