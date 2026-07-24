import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendBroteVerificationCodeEmail } from "@/lib/brote-verification-email";
import type { Locale } from "@/i18n/config";

const emailVerifications = schema.emailVerifications;

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_MIN_INTERVAL_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const TOKEN_VALID_MS = 30 * 60 * 1000;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export type RequestVerificationResult =
  | { outcome: "sent" }
  | { outcome: "resend_too_soon" }
  | { outcome: "hourly_limit" };

// Throttling reads-then-writes over email_verifications rather than Redis.
// Not integrity-critical — in the worst case a race lets one extra send
// through; it never breaks a business invariant. Per-IP rate limiting is
// the API route's job.
export async function requestEmailVerification(
  rawEmail: string,
  buyerName: string,
  locale: Locale = "es",
): Promise<RequestVerificationResult> {
  const email = normalizeEmail(rawEmail);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentSends = await db
    .select({ createdAt: emailVerifications.createdAt })
    .from(emailVerifications)
    .where(and(eq(emailVerifications.email, email), gt(emailVerifications.createdAt, oneHourAgo)));

  if (recentSends.length >= MAX_SENDS_PER_HOUR) {
    return { outcome: "hourly_limit" };
  }

  const newestSentAt = recentSends.reduce(
    (max, row) => (row.createdAt > max ? row.createdAt : max),
    new Date(0),
  );
  if (recentSends.length > 0 && Date.now() - newestSentAt.getTime() < RESEND_MIN_INTERVAL_MS) {
    return { outcome: "resend_too_soon" };
  }

  // A resend supersedes the previous pending row — only one may be live
  // per email (enforced by the partial unique index).
  await db
    .update(emailVerifications)
    .set({ status: "superseded" })
    .where(and(eq(emailVerifications.email, email), eq(emailVerifications.status, "pending")));

  const code = generateCode();
  const [row] = await db
    .insert(emailVerifications)
    .values({
      email,
      codeHash: hashCode(code),
      token: randomBytes(16).toString("base64url"),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    })
    .returning();

  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[email-verification] código para ${email}: ${code}`);
    } else {
      await sendBroteVerificationCodeEmail({ email, code, name: buyerName, locale });
    }
  } catch (error) {
    // Don't charge the hourly send quota for a Resend failure.
    await db.delete(emailVerifications).where(eq(emailVerifications.id, row.id));
    throw error;
  }

  return { outcome: "sent" };
}

export type VerifyCodeResult =
  | { outcome: "verified"; token: string }
  | { outcome: "invalid_code" | "expired" | "too_many_attempts" | "not_found" };

export async function verifyEmailCode(rawEmail: string, code: string): Promise<VerifyCodeResult> {
  const email = normalizeEmail(rawEmail);
  const hash = hashCode(code);

  // Single atomic UPDATE: the attempt always counts, and status only flips
  // to 'verified' when the hash matches — never read-then-write.
  const [updated] = await db
    .update(emailVerifications)
    .set({
      attempts: sql`${emailVerifications.attempts} + 1`,
      status: sql`case when ${emailVerifications.codeHash} = ${hash} then 'verified' else ${emailVerifications.status} end`,
      verifiedAt: sql`case when ${emailVerifications.codeHash} = ${hash} then now() else ${emailVerifications.verifiedAt} end`,
    })
    .where(
      and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.status, "pending"),
        sql`${emailVerifications.attempts} < ${MAX_ATTEMPTS}`,
        sql`${emailVerifications.expiresAt} > now()`,
      ),
    )
    .returning();

  if (updated) {
    return updated.status === "verified"
      ? { outcome: "verified", token: updated.token }
      : { outcome: "invalid_code" };
  }

  // 0 rows: no live pending verification — a separate read just to pick
  // the right error message.
  const [latest] = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.email, email))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  if (!latest) return { outcome: "not_found" };
  // Double verify (second tab, magic link after manual entry): the row is
  // already verified — re-return the token on a correct code instead of
  // confusing the person who just proved ownership with "not_found".
  if (latest.status === "verified" && latest.codeHash === hash) {
    return { outcome: "verified", token: latest.token };
  }
  if (latest.attempts >= MAX_ATTEMPTS) return { outcome: "too_many_attempts" };
  if (latest.expiresAt <= new Date()) return { outcome: "expired" };
  return { outcome: "not_found" };
}

export async function consumeEmailVerification(token: string, rawEmail: string): Promise<boolean> {
  if (!token) return false;
  const email = normalizeEmail(rawEmail);
  const notBefore = new Date(Date.now() - TOKEN_VALID_MS);

  const [row] = await db
    .update(emailVerifications)
    .set({ status: "consumed", consumedAt: sql`now()` })
    .where(
      and(
        eq(emailVerifications.token, token),
        eq(emailVerifications.email, email),
        eq(emailVerifications.status, "verified"),
        gt(emailVerifications.verifiedAt, notBefore),
      ),
    )
    .returning({ id: emailVerifications.id });

  return Boolean(row);
}
