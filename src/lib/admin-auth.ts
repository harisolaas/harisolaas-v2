import { nanoid } from "nanoid";
import { getRedis } from "./redis";

// Allowlist of admin emails (comma-separated env var)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
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

// Sessions — 7 day TTL, stored in Redis
const SESSION_TTL = 604800; // 7 days in seconds

export async function createSession(email: string): Promise<string> {
  const sessionId = nanoid(32);
  const redis = await getRedis();
  await redis.set(
    `admin:session:${sessionId}`,
    JSON.stringify({ email, createdAt: new Date().toISOString() }),
    { EX: SESSION_TTL },
  );
  return sessionId;
}

export async function validateSession(
  sessionId: string,
): Promise<{ email: string } | null> {
  if (!sessionId) return null;
  const redis = await getRedis();
  const raw = await redis.get(`admin:session:${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email: string };
  } catch {
    return null;
  }
}

export async function destroySession(sessionId: string): Promise<void> {
  const redis = await getRedis();
  await (redis as unknown as { del: (k: string) => Promise<number> }).del(
    `admin:session:${sessionId}`,
  );
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
