import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

const BROTE_EVENT_ID = "brote-2026-03-28";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.BROTE_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        email: schema.people.email,
        name: schema.people.name,
        ticketId: schema.participations.id,
        createdAt: schema.participations.createdAt,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.eventId, BROTE_EVENT_ID))
      .orderBy(asc(schema.participations.createdAt));

    const attendees = rows.map((r) => ({
      email: r.email,
      name: r.name,
      ticketId: r.ticketId,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ count: attendees.length, attendees });
  } catch (err) {
    console.error("Attendees fetch failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
