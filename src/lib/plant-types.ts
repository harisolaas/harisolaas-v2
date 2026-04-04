export interface PlantRegistration {
  id: string; // PLANT-XXXXXXXX
  email: string;
  name: string;
  status: "registered";
  createdAt: string;
  utm?: { source?: string; medium?: string; campaign?: string };
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
