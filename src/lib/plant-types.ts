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
 * Strip a phone number to digits only. Used when building wa.me links,
 * which require a digits-only international number.
 */
export function phoneDigits(raw: string): string {
  return raw.replace(WHATSAPP_SEPARATORS_RE, "");
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
