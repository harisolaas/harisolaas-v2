import { NextResponse } from "next/server";
import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import type { AdminRole, AdminScope } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type AdminUserResponse = {
  id: number;
  email: string;
  role: AdminRole;
  scope: AdminScope;
  allowedEventIds: string[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

const VALID_ROLES: AdminRole[] = ["owner", "editor", "viewer"];
const VALID_SCOPES: AdminScope[] = ["all", "scoped"];

function isRole(v: unknown): v is AdminRole {
  return typeof v === "string" && (VALID_ROLES as string[]).includes(v);
}
function isScope(v: unknown): v is AdminScope {
  return typeof v === "string" && (VALID_SCOPES as string[]).includes(v);
}

// GET /api/admin/access/users — list all admin users + their scopes
export async function GET(req: Request) {
  const session = await requireAdminSession(req, { minRole: "owner" });
  if (session instanceof NextResponse) return session;

  const users = await db
    .select()
    .from(schema.adminUsers)
    .orderBy(asc(schema.adminUsers.email));

  const userIds = users.map((u) => u.id);
  const scopeRows = userIds.length
    ? await db
        .select()
        .from(schema.adminUserEventScopes)
        .where(inArray(schema.adminUserEventScopes.adminUserId, userIds))
    : [];

  const scopesByUser = new Map<number, string[]>();
  for (const row of scopeRows) {
    const list = scopesByUser.get(row.adminUserId) ?? [];
    list.push(row.eventId);
    scopesByUser.set(row.adminUserId, list);
  }

  const result: AdminUserResponse[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role as AdminRole,
    scope: u.scope as AdminScope,
    allowedEventIds: scopesByUser.get(u.id) ?? [],
    createdByEmail: u.createdByEmail,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));

  return NextResponse.json({ users: result });
}

// POST /api/admin/access/users — create a collaborator
// Body: { email, role, scope, allowedEventIds? }
export async function POST(req: Request) {
  const session = await requireAdminSession(req, { minRole: "owner" });
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as {
    email?: string;
    role?: string;
    scope?: string;
    allowedEventIds?: string[];
  };

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!isRole(body.role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }
  if (!isScope(body.scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }
  // DB check constraint will also catch this, but enforce it early with a
  // friendlier error message than "constraint violation".
  if (body.role === "owner" && body.scope !== "all") {
    return NextResponse.json(
      { error: "owners must have scope='all'" },
      { status: 400 },
    );
  }

  const allowed =
    body.scope === "scoped" && Array.isArray(body.allowedEventIds)
      ? Array.from(new Set(body.allowedEventIds.filter(Boolean)))
      : [];

  // onConflictDoNothing + empty returning = pre-existing email. Cleaner
  // than catching a unique-violation pg error code, which the drizzle/neon
  // driver chain doesn't always surface with a stable shape.
  const inserted = await db
    .insert(schema.adminUsers)
    .values({
      email,
      role: body.role,
      scope: body.scope,
      createdByEmail: session.email,
    })
    .onConflictDoNothing({ target: schema.adminUsers.email })
    .returning();
  const created = inserted[0];
  if (!created) {
    return NextResponse.json(
      { error: "email already exists" },
      { status: 409 },
    );
  }

  if (allowed.length > 0) {
    await db
      .insert(schema.adminUserEventScopes)
      .values(allowed.map((eventId) => ({ adminUserId: created.id, eventId })))
      .onConflictDoNothing();
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: created.id,
      email: created.email,
      role: created.role as AdminRole,
      scope: created.scope as AdminScope,
      allowedEventIds: allowed,
      createdByEmail: created.createdByEmail,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    } satisfies AdminUserResponse,
  });
}

