import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/people/:id — profile + participations + memberships
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const personRows = await db
    .select()
    .from(schema.people)
    .where(eq(schema.people.id, id))
    .limit(1);
  if (personRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const person = personRows[0];

  const participations = await db
    .select({
      participation: schema.participations,
      event: schema.events,
    })
    .from(schema.participations)
    .innerJoin(
      schema.events,
      eq(schema.events.id, schema.participations.eventId),
    )
    .where(eq(schema.participations.personId, id));

  const memberships = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.personId, id));

  return NextResponse.json({
    person,
    participations: participations.map((r) => ({
      ...r.participation,
      event: r.event,
    })),
    memberships,
  });
}

// PATCH /api/admin/people/:id — update profile
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await req.json()) as {
    name?: string;
    phone?: string | null;
    instagram?: string | null;
    language?: "es" | "en";
    tags?: string[];
    notes?: string | null;
    communicationOptIns?: string[];
    optedOutAt?: string | null;
    email?: string;
  };

  const update: Record<string, unknown> = { updatedAt: sql`NOW()` };
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.instagram !== undefined) update.instagram = body.instagram;
  if (body.language !== undefined) update.language = body.language;
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.communicationOptIns !== undefined) {
    update.communicationOptIns = body.communicationOptIns;
  }
  if (body.optedOutAt !== undefined) {
    update.optedOutAt = body.optedOutAt ? new Date(body.optedOutAt) : null;
  }
  if (body.email !== undefined) update.email = body.email;

  const res = await db
    .update(schema.people)
    .set(update)
    .where(eq(schema.people.id, id))
    .returning();

  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, person: res[0] });
}
