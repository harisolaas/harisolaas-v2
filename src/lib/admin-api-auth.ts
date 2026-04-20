import { NextResponse } from "next/server";
import { sql, type SQL } from "drizzle-orm";
import {
  validateSession,
  SESSION_COOKIE_NAME,
  type AdminRole,
  type AdminSession,
} from "./admin-auth";

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

function hasMinRole(session: AdminSession, min: AdminRole): boolean {
  return ROLE_RANK[session.role] >= ROLE_RANK[min];
}

export interface RequireSessionOptions {
  // Reject the request with 403 if the session's role is below this
  // threshold. Defaults to 'viewer' (any authenticated admin is allowed).
  minRole?: AdminRole;
}

/**
 * Reads the admin session cookie, validates it, and enforces a minimum
 * role. Returns the enriched session or a NextResponse (401/403).
 *
 * Usage in an API route:
 * ```ts
 * const session = await requireAdminSession(req, { minRole: 'editor' });
 * if (session instanceof NextResponse) return session;
 * // session.email / role / scope / allowedEventIds available
 * ```
 */
export async function requireAdminSession(
  req: Request,
  options: RequireSessionOptions = {},
): Promise<AdminSession | NextResponse> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  const sessionId = match?.split("=")[1];
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await validateSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  if (options.minRole && !hasMinRole(session, options.minRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

/**
 * Returns a 403 when the session is scoped to specific events. Used by
 * cross-event endpoints (global people index, cross-event analytics, link
 * management) that can't be meaningfully filtered per event — those are
 * hidden from scoped users entirely. Returns null when the caller has
 * full access.
 */
export function assertFullAccess(
  session: AdminSession,
): NextResponse | null {
  if (session.scope === "all") return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * For single-event endpoints. Returns null when the caller has access,
 * a 404 NextResponse when they don't — 404 (not 403) avoids disclosing
 * which event IDs exist to scoped users probing the URL space.
 */
export function assertEventAccess(
  session: AdminSession,
  eventId: string,
): NextResponse | null {
  if (session.scope === "all") return null;
  if (session.allowedEventIds.includes(eventId)) return null;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * For list endpoints. Returns a SQL fragment to AND into the WHERE
 * clause — `null` when the session is scope='all' (no extra filter
 * needed). The `column` arg is the Drizzle column reference to filter
 * on (usually `events.id` or `participations.eventId`).
 *
 * Scoped users with zero allowed events get `column IN ('')` — a clause
 * that matches nothing, which is the correct result (they have access
 * to no events).
 */
export function scopeEventIdsClause(
  session: AdminSession,
  // The SQL fragment representing the column to filter, e.g. sql`${events.id}`.
  column: SQL,
): SQL | null {
  if (session.scope === "all") return null;
  if (session.allowedEventIds.length === 0) {
    return sql`${column} IN ('')`;
  }
  const values = sql.join(
    session.allowedEventIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`${column} IN (${values})`;
}

/**
 * Shorthand used for write endpoints that check `minRole: 'editor'`
 * in requireAdminSession — callers often still need to enforce
 * event-level access on the specific target event.
 */
export function assertCanWriteEvent(
  session: AdminSession,
  eventId: string,
): NextResponse | null {
  if (!hasMinRole(session, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return assertEventAccess(session, eventId);
}
