import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { revokeUserSessions } from "@/lib/admin-auth";

// POST /api/admin/access/users/:id/revoke-sessions — kill every active
// session for this admin_user so a role/scope change takes effect
// immediately rather than at the 7-day session TTL.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req, { minRole: "owner" });
  if (session instanceof NextResponse) return session;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const exists = await db
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, id))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const revoked = await revokeUserSessions(id);
  return NextResponse.json({ ok: true, sessionsRevoked: revoked });
}
