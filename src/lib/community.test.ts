import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  CapacityReachedError,
  getPersonByEmail,
  promoteWaitlist,
  recordParticipation,
  upsertPerson,
} from "./community";

// These tests hit a real Postgres (dev Neon branch via DATABASE_URL).
// Vitest is configured with singleFork=true to serialize them.

const TEST_EVENT_UNLIMITED = "test-evt-unlimited";
const TEST_EVENT_CAPPED = "test-evt-capped";

async function resetTestData() {
  // Clean only rows this file creates — never touch real data.
  await db.execute(sql`
    DELETE FROM participations WHERE event_id IN (${TEST_EVENT_UNLIMITED}, ${TEST_EVENT_CAPPED})
  `);
  await db.execute(sql`
    DELETE FROM events WHERE id IN (${TEST_EVENT_UNLIMITED}, ${TEST_EVENT_CAPPED})
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE 'test-community-%@example.com'
  `);
}

beforeAll(async () => {
  await resetTestData();
  await db.insert(schema.events).values([
    {
      id: TEST_EVENT_UNLIMITED,
      type: "brote",
      name: "Test unlimited",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    },
    {
      id: TEST_EVENT_CAPPED,
      type: "plant",
      name: "Test capped",
      date: new Date("2027-01-01T00:00:00Z"),
      capacity: 2,
      status: "upcoming",
    },
  ]);
});

afterAll(async () => {
  await resetTestData();
});

beforeEach(async () => {
  // Between tests, clear participations for the capped event so capacity
  // starts fresh. People rows accumulate but are scoped by email prefix.
  await db.execute(sql`
    DELETE FROM participations WHERE event_id = ${TEST_EVENT_CAPPED}
  `);
  await db.execute(sql`
    DELETE FROM participations WHERE event_id = ${TEST_EVENT_UNLIMITED}
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE 'test-community-%@example.com'
  `);
});

describe("recordParticipation", () => {
  it("creates a new person with firstSeen, firstTouch, and default opt-ins", async () => {
    const attribution = {
      source: "instagram",
      campaign: "launch",
      capturedAt: new Date().toISOString(),
    };
    const res = await recordParticipation({
      email: "test-community-a@example.com",
      name: "Alice",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-AA000001",
      role: "attendee",
      attribution,
    });

    expect(res.created).toBe(true);
    expect(res.promoted).toBe(false);
    expect(res.personCreated).toBe(true);

    const drill = await getPersonByEmail("test-community-a@example.com");
    expect(drill).not.toBeNull();
    expect(drill!.person.firstTouch).toEqual(attribution);
    expect(drill!.person.communicationOptIns).toEqual([
      "email:transactional",
      "email:marketing",
    ]);
    expect(drill!.participations).toHaveLength(1);
    expect(drill!.participations[0].role).toBe("attendee");
  });

  it("does not overwrite firstSeen or firstTouch on repeat participation", async () => {
    const first = await recordParticipation({
      email: "test-community-b@example.com",
      name: "Bob",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-BB000001",
      role: "attendee",
      attribution: { source: "a", capturedAt: "2026-01-01T00:00:00Z" },
    });
    const firstDrill = await getPersonByEmail("test-community-b@example.com");
    const firstSeen = firstDrill!.person.firstSeen.toISOString();

    // Re-run with different attribution — should NOT overwrite first_touch.
    await recordParticipation({
      email: "test-community-b@example.com",
      name: "Bob",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-BB000002",
      role: "planter",
      attribution: { source: "other", capturedAt: "2026-06-01T00:00:00Z" },
    });

    const drill = await getPersonByEmail("test-community-b@example.com");
    expect(drill!.person.firstTouch).toEqual({
      source: "a",
      capturedAt: "2026-01-01T00:00:00Z",
    });
    expect(drill!.person.firstSeen.toISOString()).toBe(firstSeen);
    expect(drill!.participations).toHaveLength(2);
    expect(first.personId).toBeGreaterThan(0);
  });

  it("is idempotent on (person_id, event_id) — same-status retry is a no-op", async () => {
    await recordParticipation({
      email: "test-community-c@example.com",
      name: "Carol",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-CC000001",
      role: "attendee",
    });

    const retry = await recordParticipation({
      email: "test-community-c@example.com",
      name: "Carol",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-CC000001",
      role: "attendee",
    });

    expect(retry.created).toBe(false);
    expect(retry.promoted).toBe(false);

    const drill = await getPersonByEmail("test-community-c@example.com");
    expect(drill!.participations).toHaveLength(1);
  });

  it("promotes waitlist → confirmed on the same row", async () => {
    const wl = await recordParticipation({
      email: "test-community-d@example.com",
      name: "Dan",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-DD000001",
      role: "planter",
      status: "waitlist",
    });
    expect(wl.created).toBe(true);

    const promoted = await recordParticipation({
      email: "test-community-d@example.com",
      name: "Dan",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-DD000001", // same id
      role: "planter",
      status: "confirmed",
      externalPaymentId: "MP-XYZ",
      priceCents: 1000,
      currency: "ARS",
    });
    expect(promoted.created).toBe(false);
    expect(promoted.promoted).toBe(true);

    const drill = await getPersonByEmail("test-community-d@example.com");
    expect(drill!.participations).toHaveLength(1);
    expect(drill!.participations[0].status).toBe("confirmed");
    expect(drill!.participations[0].externalPaymentId).toBe("MP-XYZ");
  });

  it("enforces capacity — exceeding the cap throws CapacityReachedError", async () => {
    // capacity is 2 on TEST_EVENT_CAPPED
    await recordParticipation({
      email: "test-community-e1@example.com",
      name: "E1",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-EE000001",
      role: "planter",
    });
    await recordParticipation({
      email: "test-community-e2@example.com",
      name: "E2",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-EE000002",
      role: "planter",
    });

    await expect(
      recordParticipation({
        email: "test-community-e3@example.com",
        name: "E3",
        eventId: TEST_EVENT_CAPPED,
        participationId: "TEST-EE000003",
        role: "planter",
      }),
    ).rejects.toBeInstanceOf(CapacityReachedError);
  });

  it("waitlist participations do NOT count toward capacity", async () => {
    // Fill capacity with confirmed.
    await recordParticipation({
      email: "test-community-f1@example.com",
      name: "F1",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-FF000001",
      role: "planter",
    });
    await recordParticipation({
      email: "test-community-f2@example.com",
      name: "F2",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-FF000002",
      role: "planter",
    });

    // Waitlist should succeed.
    const wl = await recordParticipation({
      email: "test-community-f3@example.com",
      name: "F3",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-FF000003",
      role: "planter",
      status: "waitlist",
    });
    expect(wl.created).toBe(true);

    // Confirming F3 now (simulated spot opening up would mean a cancellation
    // first; here we just verify promoting a waitlister when full throws).
    await expect(
      recordParticipation({
        email: "test-community-f3@example.com",
        name: "F3",
        eventId: TEST_EVENT_CAPPED,
        participationId: "TEST-FF000003",
        role: "planter",
        status: "confirmed",
      }),
    ).rejects.toBeInstanceOf(CapacityReachedError);
  });

  it("email is case-insensitive (citext)", async () => {
    await recordParticipation({
      email: "Test-Community-Case@example.com",
      name: "Casey",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-CASE0001",
      role: "attendee",
    });

    const drill = await getPersonByEmail("test-community-case@example.com");
    expect(drill).not.toBeNull();
    expect(drill!.participations).toHaveLength(1);
  });

  it("accepts custom communicationOptIns override", async () => {
    await recordParticipation({
      email: "test-community-optin@example.com",
      name: "Optin",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-OPTIN001",
      role: "attendee",
      communicationOptIns: ["email:transactional"], // no marketing
    });
    const drill = await getPersonByEmail("test-community-optin@example.com");
    expect(drill!.person.communicationOptIns).toEqual(["email:transactional"]);
  });
});

describe("promoteWaitlist", () => {
  it("wraps recordParticipation for a clear call-site", async () => {
    await recordParticipation({
      email: "test-community-pw@example.com",
      name: "Pat",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-PW0000001",
      role: "planter",
      status: "waitlist",
    });

    const res = await promoteWaitlist("TEST-PW0000001", {
      externalPaymentId: "MP-PW-1",
      priceCents: 2000,
      currency: "ARS",
    });
    expect(res.promoted).toBe(true);

    const drill = await getPersonByEmail("test-community-pw@example.com");
    expect(drill!.participations[0].status).toBe("confirmed");
    expect(drill!.participations[0].externalPaymentId).toBe("MP-PW-1");
    expect(drill!.participations[0].priceCents).toBe(2000);
  });
});

describe("upsertPerson", () => {
  it("creates then returns same person on second call", async () => {
    const a = await upsertPerson({
      email: "test-community-upsert@example.com",
      name: "Up",
    });
    expect(a.created).toBe(true);

    const b = await upsertPerson({
      email: "test-community-upsert@example.com",
      name: "Up",
    });
    expect(b.created).toBe(false);
    expect(b.person.id).toBe(a.person.id);
  });
});
