import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const PLANT_EVENT_ID = "plant-2026-04";

export const dynamic = "force-dynamic";

function getInitials(name: string): string {
  if (!name) return "?";
  if (name.includes("@")) return name.charAt(0).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    const rows = await db
      .select({
        name: schema.people.name,
        message: sql<string>`metadata->>'message'`,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.eventId, PLANT_EVENT_ID));

    const messages: { initials: string; message: string }[] = [];
    for (const r of rows) {
      if (r.message && typeof r.message === "string" && r.message.trim()) {
        messages.push({
          initials: getInitials(r.name || ""),
          message: r.message.trim(),
        });
      }
    }
    return NextResponse.json({ messages: shuffle(messages) });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
