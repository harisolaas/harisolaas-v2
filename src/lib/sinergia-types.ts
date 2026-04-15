import { isValidEmail } from "@/lib/plant-types";
import { sinergiaConfig } from "@/data/sinergia";

export { isValidEmail };

export type SinergiaSessionStatus = "open" | "full" | "closed";

export interface SinergiaSession {
  date: string;
  capacity: number;
  status: SinergiaSessionStatus;
}

export interface SinergiaRsvp {
  id: string;
  sessionDate: string;
  email: string;
  name: string;
  staysForDinner: boolean;
  createdAt: string;
  status: "registered";
}

export interface SinergiaAttendeeEntry {
  email: string;
  name: string;
  staysForDinner: boolean;
  rsvpId: string;
  createdAt: string;
}

export function communityEventForSession(date: string): string {
  return `sinergia-${date}`;
}

const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export function nextSinergiaDate(now: Date = new Date()): string {
  const arg = new Date(now.getTime() - ART_OFFSET_MS);

  const day = arg.getUTCDay();
  const hour = arg.getUTCHours();
  const minutes = arg.getUTCMinutes();

  let daysUntilWednesday = (3 - day + 7) % 7;
  if (day === 3 && (hour > 19 || (hour === 19 && minutes >= 30))) {
    daysUntilWednesday = 7;
  }

  const target = new Date(arg);
  target.setUTCDate(arg.getUTCDate() + daysUntilWednesday);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const natural = `${y}-${m}-${d}`;

  const first = sinergiaConfig.firstSessionDate;
  return first && natural < first ? first : natural;
}

export function formatSessionDateEs(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `Miércoles ${date.getUTCDate()} de ${months[date.getUTCMonth()]}`;
}

export function formatSessionDateEn(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `Wednesday, ${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}
