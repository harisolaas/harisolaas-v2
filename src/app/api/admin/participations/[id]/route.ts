import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

const VALID_STATUSES = new Set([
  "pending",
  "confirmed",
  "waitlist",
  "cancelled",
  "no_show",
  "used",
]);

// PATCH /api/admin/participations/:id
// Body: { referredByPersonId?, referralNote?, status?, role?, metadata? }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = (await req.json()) as {
    referredByPersonId?: number | null;
    referralNote?: string | null;
    status?: string;
    role?: string;
    metadata?: Record<string, unknown>;
  };

  if (body.status && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: sql`NOW()` };
  if (body.referredByPersonId !== undefined) {
    update.referredByPersonId = body.referredByPersonId;
  }
  if (body.referralNote !== undefined) {
    update.referralNote = body.referralNote;
  }
  if (body.status !== undefined) {
    update.status = body.status;
    // Mirror BROTE's gate flow: when a participation transitions into
    // 'used' we stamp usedAt; when it transitions out of 'used' we clear
    // it. Keeps the "Asistieron" counter and timestamp consistent across
    // BROTE ticket scans and manual dashboard check-ins.
    if (body.status === "used") {
      update.usedAt = sql`COALESCE(${schema.participations.usedAt}, NOW())`;
    } else {
      update.usedAt = sql`CASE WHEN ${schema.participations.status} = 'used' THEN NULL ELSE ${schema.participations.usedAt} END`;
    }
  }
  if (body.role !== undefined) update.role = body.role;
  if (body.metadata !== undefined) {
    update.metadata = sql`${schema.participations.metadata} || ${JSON.stringify(body.metadata)}::jsonb`;
  }

  const res = await db
    .update(schema.participations)
    .set(update)
    .where(eq(schema.participations.id, id))
    .returning();

  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, participation: res[0] });
}
