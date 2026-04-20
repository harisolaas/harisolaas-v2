import { NextResponse } from "next/server";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { revokeUserSessions } from "@/lib/admin-auth";
import type { AdminRole, AdminScope } from "@/lib/admin-auth";

const VALID_ROLES: AdminRole[] = ["owner", "editor", "viewer"];
const VALID_SCOPES: AdminScope[] = ["all", "scoped"];

function isRole(v: unknown): v is AdminRole {
  return typeof v === "string" && (VALID_ROLES as string[]).includes(v);
}
function isScope(v: unknown): v is AdminScope {
  return typeof v === "string" && (VALID_SCOPES as string[]).includes(v);
}

// PATCH /api/admin/access/users/:id — update role, scope, or allowedEventIds.
// Any change revokes the user's existing sessions so the new permissions
// take effect on next login (instead of waiting for the session TTL).
export async function PATCH(
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

  const existing = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, id))
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const current = existing[0];

  const body = (await req.json()) as {
    role?: string;
    scope?: string;
    allowedEventIds?: string[];
  };

  const update: Record<string, unknown> = { updatedAt: sql`NOW()` };

  const nextRole = body.role !== undefined
    ? (isRole(body.role) ? body.role : null)
    : (current.role as AdminRole);
  if (nextRole === null) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const nextScope = body.scope !== undefined
    ? (isScope(body.scope) ? body.scope : null)
    : (current.scope as AdminScope);
  if (nextScope === null) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }

  if (nextRole === "owner" && nextScope !== "all") {
    return NextResponse.json(
      { error: "owners must have scope='all'" },
      { status: 400 },
    );
  }

  // Block owners from demoting themselves — that's a lock-out risk. If
  // they genuinely need to hand off, another owner has to do it. (Env
  // ADMIN_EMAILS would still rescue them, but silent self-lockouts are
  // worth surfacing explicitly.)
  if (
    session.userId === id &&
    (current.role as AdminRole) === "owner" &&
    nextRole !== "owner"
  ) {
    return NextResponse.json(
      { error: "owners cannot demote themselves — ask another owner" },
      { status: 400 },
    );
  }

  if (body.role !== undefined) update.role = nextRole;
  if (body.scope !== undefined) update.scope = nextScope;

  await db
    .update(schema.adminUsers)
    .set(update)
    .where(eq(schema.adminUsers.id, id));

  // Scope membership reconciliation. When scope flips to 'all', drop any
  // lingering rows so they don't silently come back on a future scope
  // flip. When scoped, replace the set with the provided list.
  if (nextScope === "all") {
    await db
      .delete(schema.adminUserEventScopes)
      .where(eq(schema.adminUserEventScopes.adminUserId, id));
  } else if (body.allowedEventIds !== undefined) {
    const allowed = Array.from(
      new Set((body.allowedEventIds ?? []).filter(Boolean)),
    );
    if (allowed.length === 0) {
      await db
        .delete(schema.adminUserEventScopes)
        .where(eq(schema.adminUserEventScopes.adminUserId, id));
    } else {
      await db
        .delete(schema.adminUserEventScopes)
        .where(
          and(
            eq(schema.adminUserEventScopes.adminUserId, id),
            notInArray(schema.adminUserEventScopes.eventId, allowed),
          ),
        );
      await db
        .insert(schema.adminUserEventScopes)
        .values(allowed.map((eventId) => ({ adminUserId: id, eventId })))
        .onConflictDoNothing();
    }
  }

  const revoked = await revokeUserSessions(id);

  const after = await db
    .select({
      id: schema.adminUsers.id,
      email: schema.adminUsers.email,
      role: schema.adminUsers.role,
      scope: schema.adminUsers.scope,
      updatedAt: schema.adminUsers.updatedAt,
    })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, id))
    .limit(1);
  const scopesAfter = await db
    .select({ eventId: schema.adminUserEventScopes.eventId })
    .from(schema.adminUserEventScopes)
    .where(eq(schema.adminUserEventScopes.adminUserId, id));

  return NextResponse.json({
    ok: true,
    sessionsRevoked: revoked,
    user: {
      ...after[0],
      allowedEventIds: scopesAfter.map((r) => r.eventId),
      updatedAt: after[0].updatedAt.toISOString(),
    },
  });
}

// DELETE /api/admin/access/users/:id — remove a collaborator entirely.
// Also revokes their sessions. An owner can't delete themselves — this
// protects against accidentally locking yourself out of the one role
// that can re-add people.
export async function DELETE(
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

  if (session.userId === id) {
    return NextResponse.json(
      { error: "owners cannot delete themselves" },
      { status: 400 },
    );
  }

  const deleted = await db
    .delete(schema.adminUsers)
    .where(eq(schema.adminUsers.id, id))
    .returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const revoked = await revokeUserSessions(id);
  return NextResponse.json({ ok: true, sessionsRevoked: revoked });
}

