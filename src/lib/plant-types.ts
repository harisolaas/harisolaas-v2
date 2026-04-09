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
