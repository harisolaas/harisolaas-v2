import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertEventAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";
import {
  CapacityReachedError,
  promoteWaitlist,
} from "@/lib/community";

// POST /api/admin/participations/:id/promote
// Body: { externalPaymentId?, priceCents?, currency?, metadata? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req, { minRole: "editor" });
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const existing = await db
    .select({ eventId: schema.participations.eventId })
    .from(schema.participations)
    .where(eq(schema.participations.id, id))
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = assertEventAccess(session, existing[0].eventId);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    externalPaymentId?: string;
    priceCents?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    const res = await promoteWaitlist(id, body);
    return NextResponse.json({ ok: true, result: res });
  } catch (err) {
    if (err instanceof CapacityReachedError) {
      return NextResponse.json(
        { ok: false, error: "capacity_reached" },
        { status: 409 },
      );
    }
    console.error("promoteWaitlist failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
