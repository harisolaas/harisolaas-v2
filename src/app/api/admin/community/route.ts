import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

interface ParticipationSummary {
  event: string;
  role: string;
  id: string;
  date: string;
}

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  // Fetch all people + their participations in two queries; join in memory.
  const [peopleRows, participationRows] = await Promise.all([
    db.select().from(schema.people).orderBy(desc(schema.people.firstSeen)),
    db
      .select({
        personId: schema.participations.personId,
        event: schema.participations.eventId,
        role: schema.participations.role,
        id: schema.participations.id,
        date: schema.participations.date,
        eventType: schema.events.type,
        eventSeries: schema.events.series,
      })
      .from(schema.participations)
      .innerJoin(
        schema.events,
        eq(schema.events.id, schema.participations.eventId),
      ),
  ]);

  const byPerson = new Map<number, typeof participationRows>();
  for (const row of participationRows) {
    const list = byPerson.get(row.personId) ?? [];
    list.push(row);
    byPerson.set(row.personId, list);
  }

  const people = peopleRows.map((p) => {
    const parts = byPerson.get(p.id) ?? [];
    const summary: ParticipationSummary[] = parts.map((r) => ({
      event: r.event,
      role: r.role,
      id: r.id,
      date: r.date.toISOString(),
    }));
    const hasBrote = parts.some((r) => r.eventType === "brote");
    const hasPlant = parts.some((r) => r.eventType === "plant");
    const sinergiaParts = parts.filter(
      (r) => r.eventType === "sinergia" || r.eventSeries === "sinergia",
    );
    const hasSinergia = sinergiaParts.length > 0;
    const sinergiaCount = sinergiaParts.length;
    const lastSinergia = sinergiaParts
      .map((r) => r.event.replace("sinergia-", ""))
      .sort()
      .at(-1) ?? null;

    return {
      email: p.email,
      name: p.name,
      firstSeen: p.firstSeen.toISOString(),
      participations: summary,
      hasBrote,
      hasPlant,
      hasSinergia,
      sinergiaCount,
      lastSinergia,
      journey:
        hasBrote && hasPlant
          ? "both"
          : hasBrote
            ? "brote"
            : hasPlant
              ? "plant"
              : "sinergia",
    };
  });

  return NextResponse.json({ people });
}
