import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  CapacityReachedError,
  getPersonByEmail,
  markSinergiaDonationReceiptSent,
  promoteWaitlist,
  recordParticipation,
  recordSinergiaDonation,
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

  it("bypassLinkSlug confirms a signup past a sold-out cap and stamps the referrer", async () => {
    // Seed a referrer + an active bypass link pointing at them.
    const { person: referrer } = await (
      await import("./community")
    ).upsertPerson({
      email: "test-community-bp-ref@example.com",
      name: "Referrer",
    });
    const slug = "test-bypass-link-active";
    await db.execute(sql`
      INSERT INTO links (
        slug, destination, label, channel, source, medium,
        created_date, created_by, status, bypass_capacity, referred_by_person_id
      ) VALUES (
        ${slug}, '/es/sinergia', 'test', 'wa-personal', 'whatsapp', 'invite',
        '2026-04-20', 'test', 'active', true, ${referrer.id}
      )
    `);

    // Fill the 2-seat cap.
    await recordParticipation({
      email: "test-community-bp1@example.com",
      name: "BP1",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-BP000001",
      role: "planter",
    });
    await recordParticipation({
      email: "test-community-bp2@example.com",
      name: "BP2",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-BP000002",
      role: "planter",
    });

    // Bypass should succeed even though the event is full; link resolution
    // happens inside the tx, so flags come from the DB row.
    const bypassed = await recordParticipation({
      email: "test-community-bp3@example.com",
      name: "BP3",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-BP000003",
      role: "planter",
      bypassLinkSlug: slug,
    });
    expect(bypassed.created).toBe(true);

    const drill = await getPersonByEmail("test-community-bp3@example.com");
    expect(drill!.participations).toHaveLength(1);
    expect(drill!.participations[0].status).toBe("confirmed");
    expect(Number(drill!.participations[0].referredByPersonId)).toBe(
      Number(referrer.id),
    );

    // Cleanup the test link.
    await db.execute(sql`DELETE FROM links WHERE slug = ${slug}`);
  });

  it("bypassLinkSlug for an archived link enforces capacity (kill-switch)", async () => {
    // Seed an archived bypass link — should be treated as non-override.
    const slug = "test-bypass-link-archived";
    await db.execute(sql`
      INSERT INTO links (
        slug, destination, label, channel, source, medium,
        created_date, created_by, status, bypass_capacity
      ) VALUES (
        ${slug}, '/es/sinergia', 'test', 'wa-personal', 'whatsapp', 'invite',
        '2026-04-20', 'test', 'archived', true
      )
    `);

    // Fill the cap.
    await recordParticipation({
      email: "test-community-kill1@example.com",
      name: "K1",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-KILL0001",
      role: "planter",
    });
    await recordParticipation({
      email: "test-community-kill2@example.com",
      name: "K2",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-KILL0002",
      role: "planter",
    });

    // A signup with the archived slug should hit the normal capacity path.
    await expect(
      recordParticipation({
        email: "test-community-kill3@example.com",
        name: "K3",
        eventId: TEST_EVENT_CAPPED,
        participationId: "TEST-KILL0003",
        role: "planter",
        bypassLinkSlug: slug,
      }),
    ).rejects.toBeInstanceOf(CapacityReachedError);

    await db.execute(sql`DELETE FROM links WHERE slug = ${slug}`);
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

describe("recordSinergiaDonation", () => {
  it("stamps payment info and merges into metadata", async () => {
    await recordParticipation({
      email: "test-community-don@example.com",
      name: "Donor",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-DON00001",
      role: "rsvp",
      metadata: { staysForDinner: true },
    });

    const res = await recordSinergiaDonation({
      participationId: "TEST-DON00001",
      amountCents: 1000000,
      currency: "ARS",
      paymentId: "MP-DON-1",
    });
    expect(res.applied).toBe(true);
    expect(res.receiptAlreadySent).toBe(false);

    const drill = await getPersonByEmail("test-community-don@example.com");
    const p = drill!.participations[0];
    expect(p.externalPaymentId).toBe("MP-DON-1");
    expect(p.priceCents).toBe(1000000);
    expect(p.currency).toBe("ARS");
    const meta = p.metadata as Record<string, unknown>;
    expect(meta.staysForDinner).toBe(true);
    expect(meta.donation).toEqual({
      amountCents: 1000000,
      currency: "ARS",
      paymentId: "MP-DON-1",
      receiptSent: false,
    });
  });

  it("short-circuits on a repeat call with the same paymentId", async () => {
    await recordParticipation({
      email: "test-community-don2@example.com",
      name: "Donor2",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-DON00002",
      role: "rsvp",
    });

    await recordSinergiaDonation({
      participationId: "TEST-DON00002",
      amountCents: 500000,
      currency: "ARS",
      paymentId: "MP-DON-2",
    });
    await markSinergiaDonationReceiptSent("TEST-DON00002");

    const again = await recordSinergiaDonation({
      participationId: "TEST-DON00002",
      amountCents: 500000,
      currency: "ARS",
      paymentId: "MP-DON-2",
    });
    expect(again.applied).toBe(false);
    expect(again.receiptAlreadySent).toBe(true);

    const drill = await getPersonByEmail("test-community-don2@example.com");
    const meta = drill!.participations[0].metadata as Record<string, unknown>;
    const donation = meta.donation as Record<string, unknown>;
    expect(donation.receiptSent).toBe(true);
  });

  it("throws when the participation does not exist", async () => {
    await expect(
      recordSinergiaDonation({
        participationId: "TEST-NOPE",
        amountCents: 100,
        currency: "ARS",
        paymentId: "MP-NOPE",
      }),
    ).rejects.toThrow(/not found/);
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
