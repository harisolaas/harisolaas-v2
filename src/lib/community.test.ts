import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  addCompanionTickets,
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
  // The bypass-link fixtures used to be dropped only at the end of the tests
  // that create them. A run that died in between (two CI runs racing on the
  // shared dev branch is enough) left the row behind, and since nothing here
  // swept it, EVERY later run failed on a duplicate-key insert — for every
  // PR in the repo, not just the one that crashed. Sweeping them here makes
  // the fixture self-healing instead of needing a manual DB cleanup.
  // Safe before participations are gone too: `participations.link_slug` is
  // ON DELETE SET NULL.
  await db.execute(sql`
    DELETE FROM links WHERE slug LIKE 'test-bypass-link-%'
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

  it("does not overwrite when a second distinct payment arrives", async () => {
    await recordParticipation({
      email: "test-community-don3@example.com",
      name: "Donor3",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-DON00003",
      role: "rsvp",
    });

    const first = await recordSinergiaDonation({
      participationId: "TEST-DON00003",
      amountCents: 1000000,
      currency: "ARS",
      paymentId: "MP-DON-3A",
    });
    expect(first.applied).toBe(true);

    const second = await recordSinergiaDonation({
      participationId: "TEST-DON00003",
      amountCents: 2000000,
      currency: "ARS",
      paymentId: "MP-DON-3B",
    });
    expect(second.applied).toBe(false);

    const drill = await getPersonByEmail("test-community-don3@example.com");
    const p = drill!.participations[0];
    // Original donation preserved untouched.
    expect(p.externalPaymentId).toBe("MP-DON-3A");
    expect(p.priceCents).toBe(1000000);
    const donation = (p.metadata as Record<string, unknown>).donation as Record<
      string,
      unknown
    >;
    expect(donation.paymentId).toBe("MP-DON-3A");
    expect(donation.amountCents).toBe(1000000);
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

  it("overwrites a stale 'Asistente' placeholder with the real name", async () => {
    const a = await upsertPerson({
      email: "test-community-asistente@example.com",
      name: "Asistente",
    });
    expect(a.created).toBe(true);
    expect(a.person.name).toBe("Asistente");

    const b = await upsertPerson({
      email: "test-community-asistente@example.com",
      name: "Tomás Aragón",
    });
    expect(b.created).toBe(false);
    expect(b.person.name).toBe("Tomás Aragón");
    expect(b.person.id).toBe(a.person.id);
  });

  it("does NOT overwrite a real existing name", async () => {
    const a = await upsertPerson({
      email: "test-community-realname@example.com",
      name: "Maria García",
    });
    expect(a.created).toBe(true);

    const b = await upsertPerson({
      email: "test-community-realname@example.com",
      name: "Some Other Name",
    });
    expect(b.created).toBe(false);
    expect(b.person.name).toBe("Maria García");
  });

  it("rejects an empty/whitespace name (cannot blank out 'Asistente')", async () => {
    const a = await upsertPerson({
      email: "test-community-blank@example.com",
      name: "Asistente",
    });
    expect(a.created).toBe(true);

    await expect(
      upsertPerson({
        email: "test-community-blank@example.com",
        name: "   ",
      }),
    ).rejects.toThrow(/name required/);

    const drill = await getPersonByEmail("test-community-blank@example.com");
    expect(drill!.person.name).toBe("Asistente");
  });
});

describe("recordParticipation — stale 'Asistente' self-heal", () => {
  it("overwrites 'Asistente' on a follow-up participation that has a real name", async () => {
    await recordParticipation({
      email: "test-community-stale@example.com",
      name: "Asistente",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-STALE0001",
      role: "attendee",
    });

    await recordParticipation({
      email: "test-community-stale@example.com",
      name: "Slava Pankov",
      eventId: TEST_EVENT_CAPPED,
      participationId: "TEST-STALE0002",
      role: "planter",
    });

    const drill = await getPersonByEmail("test-community-stale@example.com");
    expect(drill!.person.name).toBe("Slava Pankov");
    expect(drill!.participations).toHaveLength(2);
  });
});

// ============================================================
// U1 — companion tickets (multi-entrada)
// ============================================================
//
// The `(person_id, event_id)` unique index becomes partial
// (`WHERE role <> 'companion'`) so one buyer can hold several tickets for one
// event. That index is ALSO what stops two concurrent MercadoPago webhook
// deliveries from double-issuing today, so these tests pin the replacement
// guard (caller-supplied deterministic ids + ON CONFLICT DO NOTHING) as
// carefully as they pin the feature itself.

const COMP_EMAIL = "test-community-companion@example.com";
const COMP_PAYMENT = "MP-COMPANION-1";

async function companionRows(email: string, eventId: string) {
  const res = await db.execute<{
    id: string;
    role: string;
    buyer_person_id: number | null;
    price_cents: number | null;
    external_payment_id: string | null;
    link_slug: string | null;
    metadata: Record<string, unknown>;
  }>(sql`
    SELECT p.id, p.role, p.buyer_person_id, p.price_cents,
           p.external_payment_id, p.link_slug, p.metadata
    FROM participations p
    JOIN people pe ON pe.id = p.person_id
    WHERE pe.email = ${email} AND p.event_id = ${eventId}
    ORDER BY p.created_at, p.id
  `);
  return res.rows ?? [];
}

async function seedBuyer() {
  return recordParticipation({
    email: COMP_EMAIL,
    name: "Ana",
    eventId: TEST_EVENT_UNLIMITED,
    participationId: "TEST-COMP-PRIMARY",
    role: "attendee",
    externalPaymentId: COMP_PAYMENT,
    priceCents: 2_475_000,
    currency: "ARS",
  });
}

describe("addCompanionTickets", () => {
  it("T1.1 — lets one person hold several tickets for one event, in the order asked", async () => {
    const first = await seedBuyer();

    const ids = ["TEST-COMP-A", "TEST-COMP-B", "TEST-COMP-C"];
    const res = await addCompanionTickets({
      personId: first.personId,
      eventId: TEST_EVENT_UNLIMITED,
      ticketIds: ids,
      externalPaymentId: COMP_PAYMENT,
      priceCents: 2_475_000,
      currency: "ARS",
    });

    // Order matters: the caller pairs these ids with tree numbers, so a
    // reordered return renumbers everyone's QR.
    expect(res.createdIds).toEqual(ids);
    expect(res.existingIds).toEqual([]);
    expect(await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED)).toHaveLength(4);
  });

  it("T1.5 — companion rows carry role, buyer, unit price, payment id and metadata", async () => {
    const first = await seedBuyer();

    await addCompanionTickets({
      personId: first.personId,
      eventId: TEST_EVENT_UNLIMITED,
      ticketIds: ["TEST-COMP-A"],
      externalPaymentId: COMP_PAYMENT,
      priceCents: 2_475_000,
      currency: "ARS",
      // brote-collaborator-payout.ts selects on metadata->>'invite'. Without
      // this passthrough a 3-pack pays the collaborator for one ticket.
      metadata: { invite: "pulso" },
    });

    const rows = await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED);
    const companion = rows.find((r) => r.id === "TEST-COMP-A")!;
    expect(companion.role).toBe("companion");
    expect(Number(companion.buyer_person_id)).toBe(first.personId);
    // Per ticket, never the basket total — revenue reporting sums this.
    expect(companion.price_cents).toBe(2_475_000);
    expect(companion.external_payment_id).toBe(COMP_PAYMENT);
    expect(companion.metadata.invite).toBe("pulso");
  });

  it("T1.3 — two concurrent calls with the same ids issue each ticket once", async () => {
    const first = await seedBuyer();

    const ids = ["TEST-COMP-A", "TEST-COMP-B"];
    const call = () =>
      addCompanionTickets({
        personId: first.personId,
        eventId: TEST_EVENT_UNLIMITED,
        ticketIds: ids,
        externalPaymentId: COMP_PAYMENT,
        priceCents: 2_475_000,
        currency: "ARS",
      });

    // Real interleaving, not sequential: this is two MP webhook deliveries
    // for one payment arriving at once. The partial index no longer stops
    // them, so ON CONFLICT (id) has to.
    const [a, b] = await Promise.all([call(), call()]);

    expect(await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED)).toHaveLength(3);

    // Each id is created by exactly one call, and a row that already existed
    // is reported as existing rather than missing — the webhook alerts on
    // "issued fewer than paid for", and a concurrent retry must not trip it.
    expect([...a.createdIds, ...b.createdIds].sort()).toEqual(ids);
    expect([...a.createdIds, ...a.existingIds].sort()).toEqual(ids);
    expect([...b.createdIds, ...b.existingIds].sort()).toEqual(ids);
  });

  it("T1.6 — a stale link slug drops to NULL instead of raising after payment", async () => {
    const first = await seedBuyer();

    // A cookie can name a link that has since been deleted.
    // recordParticipation sanitizes inside its transaction for exactly this
    // reason; the companion path must too, or a 23503 lands AFTER the money
    // is taken.
    const res = await addCompanionTickets({
      personId: first.personId,
      eventId: TEST_EVENT_UNLIMITED,
      ticketIds: ["TEST-COMP-A"],
      externalPaymentId: COMP_PAYMENT,
      priceCents: 2_475_000,
      currency: "ARS",
      attribution: {
        source: "instagram",
        linkSlug: "test-bypass-link-that-does-not-exist",
        capturedAt: new Date().toISOString(),
      },
    });

    expect(res.createdIds).toEqual(["TEST-COMP-A"]);
    const rows = await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED);
    expect(rows.find((r) => r.id === "TEST-COMP-A")!.link_slug).toBeNull();
  });
});

describe("recordParticipation — with companions present", () => {
  it("T1.7 — returns the attendee row, not an arbitrary one", async () => {
    const first = await seedBuyer();

    await addCompanionTickets({
      personId: first.personId,
      eventId: TEST_EVENT_UNLIMITED,
      ticketIds: ["TEST-COMP-A", "TEST-COMP-B"],
      externalPaymentId: COMP_PAYMENT,
      priceCents: 2_475_000,
      currency: "ARS",
    });

    // The existing-row probe has no ORDER BY today. Which row comes back is
    // the planner's choice — and it drives the waitlist-promotion branch and
    // every downstream Redis anchor.
    //
    // Left alone the attendee row happens to be physically first, so an
    // unordered scan returns it and this test passes against unfixed code.
    // Touch it: under MVCC an UPDATE writes a new tuple at the end of the
    // heap, so now a seq scan reaches the companions first. That is what
    // makes this assertion capable of failing — without it the test is
    // vacuous, not passing.
    await db.execute(
      sql`UPDATE participations SET updated_at = NOW() WHERE id = 'TEST-COMP-PRIMARY'`,
    );

    // And backdate the companions so they are OLDER than the attendee.
    // Ordering by created_at alone would then pick a companion, and that
    // state is reachable: U5's contact confirmation re-points a whole group
    // onto an existing person and demotes our attendee row to companion, so
    // the surviving attendee can easily be the newer row. Without this the
    // `role = 'companion'` term in the ORDER BY is untested — verified: the
    // mutation that drops it passes the whole suite.
    await db.execute(sql`
      UPDATE participations SET created_at = NOW() - interval '2 days'
      WHERE id IN ('TEST-COMP-A', 'TEST-COMP-B')
    `);

    for (let i = 0; i < 4; i++) {
      const again = await recordParticipation({
        email: COMP_EMAIL,
        name: "Ana",
        eventId: TEST_EVENT_UNLIMITED,
        participationId: "TEST-COMP-IGNORED",
        role: "attendee",
      });
      expect(again.created).toBe(false);
      expect(again.participationId).toBe("TEST-COMP-PRIMARY");
    }
  });

  it("T1.2 — a repeat attendee signup still returns the existing row (non-regression pin)", async () => {
    const first = await seedBuyer();
    const again = await recordParticipation({
      email: COMP_EMAIL,
      name: "Ana",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-COMP-SECOND",
      role: "attendee",
    });

    expect(again.created).toBe(false);
    expect(again.participationId).toBe(first.participationId);
    expect(await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED)).toHaveLength(1);
  });

  it("T1.8 — concurrent duplicate signups still collapse to one row (non-regression pin)", async () => {
    // What this pins, precisely — established by mutation testing, because
    // the obvious reading is wrong:
    //
    // It is NOT the unique index. Replacing that index with a non-unique one
    // leaves this test green. Three concurrent transactions with no
    // constraint at all still produce one row, because they all upsert the
    // same person first and `ON CONFLICT (email) DO UPDATE` holds a row lock
    // on `people` until commit — so same-person signups serialize there, and
    // the later ones then short-circuit on the existing-row SELECT.
    //
    // So this pins the serialization itself: that concurrent duplicate
    // signups for one person/event collapse to one participation, however
    // that is achieved. It would go red if the person upsert stopped locking
    // or the transaction were restructured — which is worth knowing, since
    // `addCompanionTickets` deliberately does NOT touch the people row and
    // therefore gets no such protection (see T1.3).
    const attempt = () =>
      recordParticipation({
        email: COMP_EMAIL,
        name: "Ana",
        eventId: TEST_EVENT_UNLIMITED,
        participationId: `TEST-COMP-RACE-${Math.random().toString(36).slice(2, 8)}`,
        role: "attendee",
      });

    // One of the two may lose the race and surface the 23505 rather than the
    // existing row — today's callers treat that as a failed signup. Either
    // outcome is acceptable here; a SECOND ROW is not.
    await Promise.allSettled([attempt(), attempt(), attempt()]);

    expect(await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED)).toHaveLength(1);
  });

  it("T1.4 — a repeated Sinergia RSVP still deduplicates (non-regression pin)", async () => {
    // The index goes partial. Everything that is not a companion must keep
    // the uniqueness it has today — Sinergia RSVPs, plant signups, admin.
    await recordParticipation({
      email: COMP_EMAIL,
      name: "Ana",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-COMP-RSVP-1",
      role: "rsvp",
    });
    const again = await recordParticipation({
      email: COMP_EMAIL,
      name: "Ana",
      eventId: TEST_EVENT_UNLIMITED,
      participationId: "TEST-COMP-RSVP-2",
      role: "rsvp",
    });

    expect(again.created).toBe(false);
    expect(again.participationId).toBe("TEST-COMP-RSVP-1");
    expect(await companionRows(COMP_EMAIL, TEST_EVENT_UNLIMITED)).toHaveLength(1);
  });
});
