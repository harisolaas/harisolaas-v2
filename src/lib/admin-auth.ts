import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "./redis";

export type AdminRole = "owner" | "editor" | "viewer";
export type AdminScope = "all" | "scoped";

export interface AdminSession {
  email: string;
  userId: number | null; // null when logged in via ADMIN_EMAILS fallback only
  role: AdminRole;
  scope: AdminScope;
  // Event IDs this user can access. Only meaningful when scope==='scoped';
  // for scope==='all' this is always empty (callers must check scope first).
  allowedEventIds: string[];
  createdAt: string;
}

// Emergency fallback — lets the repo owner log in as implicit owner/all
// if the admin_users table is empty (e.g. before the seed script has run).
// After seeding this env var is belt-and-suspenders.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isEnvFallbackEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Looks up the admin_users row for an email and returns the scope shape
// used by sessions. Falls back to implicit owner/all when the email is
// missing from the table but present in ADMIN_EMAILS.
// Returns null if the email is neither in the table nor in the env fallback.
export async function loadAdminUserByEmail(
  email: string,
): Promise<Pick<AdminSession, "userId" | "role" | "scope" | "allowedEventIds"> | null> {
  const normalized = email.trim().toLowerCase();

  const rows = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, normalized))
    .limit(1);

  if (rows.length > 0) {
    const user = rows[0];
    const role = user.role as AdminRole;
    const scope = user.scope as AdminScope;
    let allowedEventIds: string[] = [];
    if (scope === "scoped") {
      const scopeRows = await db
        .select({ eventId: schema.adminUserEventScopes.eventId })
        .from(schema.adminUserEventScopes)
        .where(eq(schema.adminUserEventScopes.adminUserId, user.id));
      allowedEventIds = scopeRows.map((r) => r.eventId);
    }
    return { userId: user.id, role, scope, allowedEventIds };
  }

  if (isEnvFallbackEmail(normalized)) {
    return { userId: null, role: "owner", scope: "all", allowedEventIds: [] };
  }

  return null;
}

// Used by /api/admin/auth/login to decide whether to send a magic link.
// Any email with either a DB row OR an ADMIN_EMAILS entry is allowed to
// request one; verification later re-checks and builds the session.
export async function isAllowedEmail(email: string): Promise<boolean> {
  const user = await loadAdminUserByEmail(email);
  return user !== null;
}

// Magic link tokens — 10 min TTL, one-time use
export async function createMagicLinkToken(email: string): Promise<string> {
  const token = nanoid(32);
  const redis = await getRedis();
  await redis.set(`admin:magic:${token}`, email.toLowerCase(), { EX: 600 });
  return token;
}

export async function verifyMagicLinkToken(
  token: string,
): Promise<string | null> {
  const redis = await getRedis();
  const email = await redis.get(`admin:magic:${token}`);
  if (!email) return null;
  // One-time use — delete immediately
  await (redis as unknown as { del: (k: string) => Promise<number> }).del(
    `admin:magic:${token}`,
  );
  return email;
}

// Sessions — 7 day TTL, stored in Redis. The blob carries the full
// AdminSession shape so API routes don't hit the DB on every request;
// staleness on role/scope changes is accepted up to the 7-day TTL, and
// the access-management UI exposes a "revoke sessions" button for
// immediate invalidation when needed.
const SESSION_TTL = 604800; // 7 days in seconds

export async function createSession(
  payload: Omit<AdminSession, "createdAt">,
): Promise<string> {
  const sessionId = nanoid(32);
  const redis = await getRedis();
  const session: AdminSession = {
    ...payload,
    email: payload.email.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  await redis.set(`admin:session:${sessionId}`, JSON.stringify(session), {
    EX: SESSION_TTL,
  });
  // Side index so we can revoke all of a user's sessions at once when the
  // owner changes their role/scope. Scoped by userId; env-fallback sessions
  // (userId=null) don't get indexed because only the repo owner uses them.
  if (payload.userId !== null) {
    await redis.sAdd(
      `admin:user-sessions:${payload.userId}`,
      sessionId,
    );
    await redis.expire(
      `admin:user-sessions:${payload.userId}`,
      SESSION_TTL,
    );
  }
  return sessionId;
}

export async function validateSession(
  sessionId: string,
): Promise<AdminSession | null> {
  if (!sessionId) return null;
  const redis = await getRedis();
  const raw = await redis.get(`admin:session:${sessionId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    // Reject old-shape sessions (missing role/scope) — forces a clean
    // re-login after the enrichment deploy. The PR description's deploy
    // sequence includes a one-shot `redis-cli DEL admin:session:*` to
    // accelerate this rather than waiting for natural expiry.
    if (
      !parsed.email ||
      !parsed.role ||
      !parsed.scope ||
      !Array.isArray(parsed.allowedEventIds)
    ) {
      return null;
    }
    return {
      email: parsed.email,
      userId: parsed.userId ?? null,
      role: parsed.role as AdminRole,
      scope: parsed.scope as AdminScope,
      allowedEventIds: parsed.allowedEventIds,
      createdAt: parsed.createdAt ?? "",
    };
  } catch {
    return null;
  }
}

export async function destroySession(sessionId: string): Promise<void> {
  const redis = await getRedis();
  const raw = await redis.get(`admin:session:${sessionId}`);
  await (redis as unknown as { del: (k: string) => Promise<number> }).del(
    `admin:session:${sessionId}`,
  );
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AdminSession>;
      if (parsed.userId != null) {
        await redis.sRem(
          `admin:user-sessions:${parsed.userId}`,
          sessionId,
        );
      }
    } catch {
      // ignore — session blob was malformed, best-effort cleanup only
    }
  }
}

// Revokes every active session for a given admin user. Called from the
// access-management UI whenever an owner changes a user's role or scope.
export async function revokeUserSessions(userId: number): Promise<number> {
  const redis = await getRedis();
  const ids = await redis.sMembers(`admin:user-sessions:${userId}`);
  if (ids.length === 0) return 0;
  const del = redis as unknown as { del: (k: string) => Promise<number> };
  for (const id of ids) {
    await del.del(`admin:session:${id}`);
  }
  await del.del(`admin:user-sessions:${userId}`);
  return ids.length;
}

// Cookie helpers
export const SESSION_COOKIE_NAME = "admin_session";

export function buildSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
