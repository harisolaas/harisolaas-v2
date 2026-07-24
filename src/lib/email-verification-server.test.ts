import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

// These tests hit a real Postgres (dev Neon branch via DATABASE_URL).
// Vitest serializes test files (maxWorkers: 1), and every row this file
// creates is scoped by the test-verif- email prefix.

vi.mock("@/lib/brote-verification-email", () => ({
  sendBroteVerificationCodeEmail: vi.fn(),
}));

import { sendBroteVerificationCodeEmail } from "@/lib/brote-verification-email";
import {
  consumeEmailVerification,
  requestEmailVerification,
  verifyEmailCode,
} from "./email-verification-server";

const emailVerifications = schema.emailVerifications;
const sendMock = vi.mocked(sendBroteVerificationCodeEmail);

const EMAIL_PREFIX = "test-verif-";

function testEmail(slug: string): string {
  return `${EMAIL_PREFIX}${slug}@example.com`;
}

async function cleanup() {
  await db.execute(
    sql`DELETE FROM email_verifications WHERE email LIKE ${`${EMAIL_PREFIX}%@example.com`}`,
  );
}

async function sendAndGetCode(email: string): Promise<string> {
  await requestEmailVerification(email, "Ana");
  const call = sendMock.mock.calls.at(-1);
  if (!call) throw new Error("sendBroteVerificationCodeEmail was not called");
  return call[0].code;
}

async function rowFor(email: string) {
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.email, email));
  return row;
}

afterEach(async () => {
  vi.clearAllMocks();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("requestEmailVerification", () => {
  it("creates a pending row and emails a hashed 6-digit code", async () => {
    const email = testEmail("ana");

    const result = await requestEmailVerification(email, "Ana");
    expect(result).toEqual({ outcome: "sent" });
    expect(sendMock).toHaveBeenCalledTimes(1);

    const input = sendMock.mock.calls[0][0];
    expect(input.email).toBe(email);
    expect(input.code).toMatch(/^\d{6}$/);
    expect(input.locale).toBe("es");

    const row = await rowFor(email);
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);
    expect(row.codeHash).toBe(
      createHash("sha256").update(input.code).digest("hex"),
    );
  });

  it("normalizes the email to lowercase/trim", async () => {
    const email = testEmail("ana");

    await requestEmailVerification(`  ${email.toUpperCase()}  `, "Ana");

    const rows = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email));
    expect(rows).toHaveLength(1);
  });

  it("rejects a resend within the throttle window", async () => {
    const email = testEmail("ana");
    await requestEmailVerification(email, "Ana");

    const second = await requestEmailVerification(email, "Ana");

    expect(second).toEqual({ outcome: "resend_too_soon" });
    const rows = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email));
    expect(rows).toHaveLength(1);
  });

  it("allows a resend after the throttle window and supersedes the previous code", async () => {
    const email = testEmail("ana");
    await requestEmailVerification(email, "Ana");
    await db
      .update(emailVerifications)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(emailVerifications.email, email));

    const result = await requestEmailVerification(email, "Ana");

    expect(result).toEqual({ outcome: "sent" });
    const rows = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email));
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === "pending")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "superseded")).toHaveLength(1);
  });

  it("throttles after 5 sends within an hour", async () => {
    const email = testEmail("ana");

    for (let i = 0; i < 5; i++) {
      const result = await requestEmailVerification(email, "Ana");
      expect(result).toEqual({ outcome: "sent" });
      await db
        .update(emailVerifications)
        .set({ createdAt: new Date(Date.now() - (5 - i) * 2 * 60_000) })
        .where(
          and(
            eq(emailVerifications.email, email),
            eq(emailVerifications.status, "pending"),
          ),
        );
    }

    const sixth = await requestEmailVerification(email, "Ana");
    expect(sixth).toEqual({ outcome: "hourly_limit" });
  });

  it("deletes the row and rethrows when sending fails", async () => {
    const email = testEmail("ana");
    sendMock.mockRejectedValueOnce(new Error("resend down"));

    await expect(requestEmailVerification(email, "Ana")).rejects.toThrow(
      "resend down",
    );

    const rows = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, email));
    expect(rows).toHaveLength(0);
  });
});

describe("verifyEmailCode", () => {
  it("verifies the correct code and returns a one-time token", async () => {
    const email = testEmail("ana");
    const code = await sendAndGetCode(email);

    const result = await verifyEmailCode(email, code);

    expect(result.outcome).toBe("verified");
    expect(result).toHaveProperty("token");
    const row = await rowFor(email);
    expect(row.status).toBe("verified");
    expect(row.verifiedAt).not.toBeNull();
  });

  it("rejects a wrong code and increments attempts", async () => {
    const email = testEmail("ana");
    const code = await sendAndGetCode(email);
    const wrongCode = code === "000000" ? "111111" : "000000";

    const result = await verifyEmailCode(email, wrongCode);

    expect(result).toEqual({ outcome: "invalid_code" });
    const row = await rowFor(email);
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
  });

  it("locks out after 5 wrong attempts, even with the correct code afterwards", async () => {
    const email = testEmail("ana");
    const code = await sendAndGetCode(email);
    const wrongCode = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      await verifyEmailCode(email, wrongCode);
    }
    const result = await verifyEmailCode(email, code);

    expect(result).toEqual({ outcome: "too_many_attempts" });
  });

  it("rejects an expired code", async () => {
    const email = testEmail("ana");
    const code = await sendAndGetCode(email);
    await db
      .update(emailVerifications)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(emailVerifications.email, email));

    const result = await verifyEmailCode(email, code);

    expect(result).toEqual({ outcome: "expired" });
  });

  it("increments attempts on the active pending row when given a superseded row's code", async () => {
    const email = testEmail("ana");
    const oldCode = await sendAndGetCode(email);
    await db
      .update(emailVerifications)
      .set({ createdAt: new Date(Date.now() - 61_000) })
      .where(eq(emailVerifications.email, email));
    await requestEmailVerification(email, "Ana");

    const result = await verifyEmailCode(email, oldCode);

    expect(result).toEqual({ outcome: "invalid_code" });
    const [pendingRow] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.status, "pending"),
        ),
      );
    expect(pendingRow.attempts).toBe(1);
  });

  it("verifies with a messy-cased/whitespace email", async () => {
    const email = testEmail("ana");
    const code = await sendAndGetCode(email);

    const result = await verifyEmailCode(`  ${email.toUpperCase()}  `, code);

    expect(result.outcome).toBe("verified");
  });
});

describe("consumeEmailVerification", () => {
  async function verifiedToken(email: string): Promise<string> {
    const code = await sendAndGetCode(email);
    const result = await verifyEmailCode(email, code);
    if (result.outcome !== "verified") {
      throw new Error("test setup failed to verify");
    }
    return result.token;
  }

  it("consumes a verified token for the matching email", async () => {
    const email = testEmail("ana");
    const token = await verifiedToken(email);

    const consumed = await consumeEmailVerification(token, email);

    expect(consumed).toBe(true);
    const row = await rowFor(email);
    expect(row.status).toBe("consumed");
  });

  it("rejects replaying an already-consumed token", async () => {
    const email = testEmail("ana");
    const token = await verifiedToken(email);
    await consumeEmailVerification(token, email);

    const secondAttempt = await consumeEmailVerification(token, email);

    expect(secondAttempt).toBe(false);
  });

  it("rejects a token when the email doesn't match", async () => {
    const email = testEmail("ana");
    const otherEmail = testEmail("otra");
    const token = await verifiedToken(email);

    const consumed = await consumeEmailVerification(token, otherEmail);

    expect(consumed).toBe(false);
  });

  it("rejects a token for a row that hasn't been verified yet", async () => {
    const email = testEmail("ana");
    await requestEmailVerification(email, "Ana");
    const row = await rowFor(email);

    const consumed = await consumeEmailVerification(row.token, email);

    expect(consumed).toBe(false);
  });

  it("rejects a token verified more than 30 minutes ago", async () => {
    const email = testEmail("ana");
    const token = await verifiedToken(email);
    await db
      .update(emailVerifications)
      .set({ verifiedAt: new Date(Date.now() - 31 * 60_000) })
      .where(eq(emailVerifications.email, email));

    const consumed = await consumeEmailVerification(token, email);

    expect(consumed).toBe(false);
  });
});
