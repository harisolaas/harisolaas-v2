import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordParticipation } from "@/lib/community";

// Cover the PATCH route's usedAt transition logic. The SQL (COALESCE on
// 'used', NULL otherwise) is the fragile part — if it ever regresses,
// "Asistieron" counters and the attendance toggle go out of sync with
// the usedAt column.

vi.mock("@/lib/admin-api-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin-api-auth")>();
  return {
    ...actual,
    requireAdminSession: async () => ({
      email: "test@example.com",
      userId: null,
      role: "owner" as const,
      scope: "all" as const,
      allowedEventIds: [],
      createdAt: new Date().toISOString(),
    }),
  };
});

// Imported AFTER the mock so the route picks up the mocked auth.
const { PATCH, DELETE } = await import("./route");

const EVENT_ID = "test-patch-participation";
const EMAIL_PREFIX = "test-patch-participation-";

async function cleanup() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id = ${EVENT_ID}
      OR person_id IN (
        SELECT id FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}
      )
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}
  `);
}

beforeAll(async () => {
  await db
    .insert(schema.events)
    .values({
      id: EVENT_ID,
      type: "plant",
      name: "Test PATCH participation",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    })
    .onConflictDoNothing();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT_ID}`);
});

beforeEach(async () => {
  await cleanup();
});

async function seed(email: string, participationId: string) {
  await recordParticipation({
    email,
    name: email,
    eventId: EVENT_ID,
    participationId,
    role: "attendee",
    status: "confirmed",
  });
  return participationId;
}

async function callPatch(
  participationId: string,
  body: Record<string, unknown>,
) {
  const req = new Request(
    `http://localhost/api/admin/participations/${participationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
  return PATCH(req, { params: Promise.resolve({ id: participationId }) });
}

async function readParticipation(id: string) {
  const rows = await db
    .select({
      status: schema.participations.status,
      usedAt: schema.participations.usedAt,
    })
    .from(schema.participations)
    .where(eq(schema.participations.id, id))
    .limit(1);
  return rows[0];
}

describe("PATCH /api/admin/participations/[id] — attendance transitions", () => {
  it("confirmed → used stamps usedAt", async () => {
    const id = "PATCH-TEST-1";
    await seed(`${EMAIL_PREFIX}a@example.com`, id);

    const res = await callPatch(id, { status: "used" });
    expect(res.status).toBe(200);

    const row = await readParticipation(id);
    expect(row.status).toBe("used");
    expect(row.usedAt).toBeInstanceOf(Date);
  });

  it("used → confirmed clears usedAt", async () => {
    const id = "PATCH-TEST-2";
    await seed(`${EMAIL_PREFIX}b@example.com`, id);
    await callPatch(id, { status: "used" });
    expect((await readParticipation(id)).usedAt).toBeInstanceOf(Date);

    const res = await callPatch(id, { status: "confirmed" });
    expect(res.status).toBe(200);

    const row = await readParticipation(id);
    expect(row.status).toBe("confirmed");
    expect(row.usedAt).toBeNull();
  });

  it("used → used (no-op PATCH) preserves the original usedAt via COALESCE", async () => {
    const id = "PATCH-TEST-3";
    await seed(`${EMAIL_PREFIX}c@example.com`, id);
    await callPatch(id, { status: "used" });
    const first = (await readParticipation(id)).usedAt as Date;

    // Redundant PATCH. Without COALESCE this would overwrite with a fresh
    // NOW() and lose the original door-scan timestamp.
    await new Promise((r) => setTimeout(r, 20));
    await callPatch(id, { status: "used" });
    const second = (await readParticipation(id)).usedAt as Date;

    expect(second.getTime()).toBe(first.getTime());
  });

  it("confirmed → cancelled leaves usedAt null (invariant: used ⇔ usedAt)", async () => {
    const id = "PATCH-TEST-4";
    await seed(`${EMAIL_PREFIX}d@example.com`, id);

    const res = await callPatch(id, { status: "cancelled" });
    expect(res.status).toBe(200);

    const row = await readParticipation(id);
    expect(row.status).toBe("cancelled");
    expect(row.usedAt).toBeNull();
  });

  it("used → no_show clears usedAt", async () => {
    const id = "PATCH-TEST-5";
    await seed(`${EMAIL_PREFIX}e@example.com`, id);
    await callPatch(id, { status: "used" });
    expect((await readParticipation(id)).usedAt).toBeInstanceOf(Date);

    const res = await callPatch(id, { status: "no_show" });
    expect(res.status).toBe(200);

    const row = await readParticipation(id);
    expect(row.status).toBe("no_show");
    expect(row.usedAt).toBeNull();
  });

  it("rejects a non-string status (e.g. null or a number)", async () => {
    const id = "PATCH-TEST-6";
    await seed(`${EMAIL_PREFIX}f@example.com`, id);

    const resNull = await callPatch(id, { status: null });
    expect(resNull.status).toBe(400);

    const resNum = await callPatch(id, { status: 42 });
    expect(resNum.status).toBe(400);

    // Sanity: original row untouched.
    const row = await readParticipation(id);
    expect(row.status).toBe("confirmed");
    expect(row.usedAt).toBeNull();
  });

  it("rejects an unknown status string", async () => {
    const id = "PATCH-TEST-7";
    await seed(`${EMAIL_PREFIX}g@example.com`, id);

    const res = await callPatch(id, { status: "hacked" });
    expect(res.status).toBe(400);
  });
});

async function callDelete(participationId: string) {
  const req = new Request(
    `http://localhost/api/admin/participations/${participationId}`,
    { method: "DELETE" },
  );
  return DELETE(req, { params: Promise.resolve({ id: participationId }) });
}

describe("DELETE /api/admin/participations/[id]", () => {
  it("removes the row entirely", async () => {
    const id = "DELETE-TEST-1";
    await seed(`${EMAIL_PREFIX}h@example.com`, id);
    expect(await readParticipation(id)).toBeDefined();

    const res = await callDelete(id);
    expect(res.status).toBe(200);

    expect(await readParticipation(id)).toBeUndefined();
  });

  it("404s on an unknown id", async () => {
    const res = await callDelete("does-not-exist");
    expect(res.status).toBe(404);
  });
});
