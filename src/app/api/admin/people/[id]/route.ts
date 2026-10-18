import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/people/:id — profile + participations + memberships
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

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
  const session = await requireAdminSession(req, { minRole: "editor" });
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

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
    email?: string | null;
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
  for (const field of ["email", "phone", "instagram"] as const) {
    const v = body[field];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return NextResponse.json(
        { error: `El campo ${field} tiene que ser texto` },
        { status: 400 },
      );
    }
  }
  // Blank → NULL: email is unique, so two people saved with "" would
  // collide, and phone-only people legitimately have none.
  if (body.email !== undefined) update.email = body.email?.trim() || null;

  // people_contact_check needs at least one of email/phone/instagram.
  // Check against the current row so the operator gets a 400, not a 500.
  if ("email" in update || "phone" in update || "instagram" in update) {
    const current = await db
      .select({
        email: schema.people.email,
        phone: schema.people.phone,
        instagram: schema.people.instagram,
      })
      .from(schema.people)
      .where(eq(schema.people.id, id))
      .limit(1);
    if (current.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const next = { ...current[0], ...update };
    if (next.email == null && next.phone == null && next.instagram == null) {
      return NextResponse.json({ error: NO_CONTACT_ERROR }, { status: 400 });
    }
  }

  let res;
  try {
    res = await db
      .update(schema.people)
      .set(update)
      .where(eq(schema.people.id, id))
      .returning();
  } catch (err) {
    // Backstop for a concurrent edit racing the check above.
    if (isCheckViolation(err)) {
      return NextResponse.json({ error: NO_CONTACT_ERROR }, { status: 400 });
    }
    throw err;
  }

  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, person: res[0] });
}

const NO_CONTACT_ERROR =
  "La persona tiene que conservar al menos un contacto (email, WhatsApp o Instagram)";

// Drizzle wraps the pg error, so the code sits somewhere in the cause chain
// (same reason as isUniqueViolation in brote-contact.ts).
function isCheckViolation(err: unknown): boolean {
  let cursor: unknown = err;
  for (let depth = 0; cursor && depth < 5; depth++) {
    if (typeof cursor !== "object") return false;
    if ((cursor as { code?: string }).code === "23514") return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}
