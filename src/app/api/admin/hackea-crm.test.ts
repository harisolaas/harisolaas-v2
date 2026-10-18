import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AdminSession } from "@/lib/admin-auth";
import { phoneSearchFragments } from "@/lib/admin-phone-search";

// DB-backed: the admin surfaces where Hackeá tu mente rows land must cope
// with phone-only people (email NULL) — Personas list/search/detail, the
// event drawer and the events list (which lazily creates the event).
// The hackea event id is mocked to a test-owned key so the lazy insert in
// GET /api/admin/events never touches the real row on the shared branch.

const EVENT = "test-d1crm-hackea-evt";
const NAME_PREFIX = "D1CRM Test";
// Digits nobody real should hold; stored in the flow's +549… form.
const PHONE_PAID = "+5491190017701";
const PHONE_LEAD = "+5491190017702";
const EMAIL_PAID = "d1crm-paid@example.com";
const PRICE = 2_130_000;

vi.mock("@/data/hackea", async (orig) => {
  const actual = await orig<typeof import("@/data/hackea")>();
  return {
    ...actual,
    hackeaConfig: { ...actual.hackeaConfig, eventId: "test-d1crm-hackea-evt" },
  };
});

const OWNER: AdminSession = {
  email: "owner@example.com",
  userId: null,
  role: "owner",
  scope: "all",
  allowedEventIds: [],
  createdAt: new Date().toISOString(),
};

vi.mock("@/lib/admin-api-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin-api-auth")>();
  return {
    ...actual,
    requireAdminSession: async () => OWNER,
  };
});

const { GET: listPeople } = await import("./people/route");
const { GET: searchPeople } = await import("./people/search/route");
const { GET: personDetail } = await import("./people/[id]/route");
const { GET: eventDetail } = await import("./events/[id]/route");
const { GET: listEvents } = await import("./events/route");
const { GET: community } = await import("./community/route");

async function sweep() {
  await db.execute(sql`DELETE FROM participations WHERE event_id = ${EVENT}`);
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
  await db.execute(
    sql`DELETE FROM people WHERE name LIKE ${NAME_PREFIX + "%"}`,
  );
}

const ids: { phoneOnly: number; withEmail: number; lead: number } = {
  phoneOnly: 0,
  withEmail: 0,
  lead: 0,
};

async function insertPerson(
  name: string,
  email: string | null,
  phone: string,
): Promise<number> {
  const res = await db.execute<{ id: number }>(sql`
    INSERT INTO people (name, email, phone)
    VALUES (${name}, ${email}, ${phone})
    RETURNING id
  `);
  return Number(res.rows[0].id);
}

async function insertParticipation(
  id: string,
  personId: number,
  status: string,
  contact: { name: string; phone: string; email: string | null },
) {
  await db.execute(sql`
    INSERT INTO participations
      (id, person_id, event_id, role, status, price_cents, currency, metadata)
    VALUES (
      ${id}, ${personId}, ${EVENT}, 'attendee', ${status}, ${PRICE}, 'ARS',
      ${JSON.stringify({ contact })}::jsonb
    )
  `);
}

beforeAll(async () => {
  await sweep();
  await db.execute(sql`
    INSERT INTO events (id, type, name, date, status)
    VALUES (${EVENT}, 'hackea', 'D1CRM test event', NOW() + INTERVAL '10 days', 'upcoming')
  `);
  ids.phoneOnly = await insertPerson(`${NAME_PREFIX} Solo Tel`, null, PHONE_PAID);
  ids.withEmail = await insertPerson(`${NAME_PREFIX} Con Mail`, EMAIL_PAID, "+5491190017703");
  ids.lead = await insertPerson(`${NAME_PREFIX} Lead`, null, PHONE_LEAD);
  // The contact snapshot differs from the person row on purpose: the
  // drawer must show what the buyer typed on this flow.
  await insertParticipation("HTM-D1CRM001", ids.phoneOnly, "confirmed", {
    name: "Solo Tel (form)",
    phone: PHONE_PAID,
    email: null,
  });
  await insertParticipation("HTM-D1CRM002", ids.withEmail, "used", {
    name: "Con Mail",
    phone: "+5491190017703",
    email: EMAIL_PAID,
  });
  await insertParticipation("HTM-D1CRM003", ids.lead, "pending", {
    name: "Lead",
    phone: PHONE_LEAD,
    email: null,
  });
});
afterAll(sweep);

const req = (path: string) => new Request(`http://localhost${path}`);

describe("Personas with null email", () => {
  it("list returns phone-only people with phone and the hackea chip flag", async () => {
    const res = await listPeople(
      req(`/api/admin/people?search=${encodeURIComponent(NAME_PREFIX)}`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const p = body.people.find((x: { id: number }) => x.id === ids.phoneOnly);
    expect(p).toMatchObject({ email: null, phone: PHONE_PAID });
    expect(p.eventSummary.hackea).toBe(true);
  });

  it("list search matches by phone digits in another spelling", async () => {
    const res = await listPeople(
      req(`/api/admin/people?search=${encodeURIComponent("11 9001-7701")}`),
    );
    const body = await res.json();
    const found = body.people.map((x: { id: number }) => x.id);
    expect(found).toContain(ids.phoneOnly);
    expect(found).not.toContain(ids.lead);
  });

  it("search endpoint finds a stored +549 number from the local form", async () => {
    const res = await searchPeople(
      req(`/api/admin/people/search?q=${encodeURIComponent("1190017702")}`),
    );
    const body = await res.json();
    const found = body.people.map((x: { id: number }) => Number(x.id));
    expect(found).toEqual([ids.lead]);
  });

  it("only phone-shaped queries become digit searches", () => {
    expect(phoneSearchFragments("Sala 9001")).toEqual([]);
    expect(phoneSearchFragments("123")).toEqual([]);
    expect(phoneSearchFragments("9001")).toEqual(["9001"]);
    // A full +549 number also looks for its national spelling.
    expect(phoneSearchFragments("+54 9 11 9001-7701")).toContain("1190017701");
  });

  it("detail renders a phone-only person", async () => {
    const res = await personDetail(req(`/api/admin/people/${ids.phoneOnly}`), {
      params: Promise.resolve({ id: String(ids.phoneOnly) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.person).toMatchObject({ email: null, phone: PHONE_PAID });
    expect(body.participations).toHaveLength(1);
  });

  it("legacy community list carries id + phone for phone-only people", async () => {
    const res = await community(req("/api/admin/community"));
    const body = await res.json();
    const p = body.people.find(
      (x: { id: number }) => Number(x.id) === ids.phoneOnly,
    );
    expect(p).toMatchObject({ email: null, phone: PHONE_PAID });
  });
});

describe("Event drawer for type hackea", () => {
  it("revenue counts confirmed/used only; pending leads are counted apart", async () => {
    const res = await eventDetail(req(`/api/admin/events/${EVENT}`), {
      params: Promise.resolve({ id: EVENT }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hackea).toEqual({
      paid: 2,
      pendingLeads: 1,
      revenueCents: 2 * PRICE,
      currency: "ARS",
    });
    expect(body.counts.pending).toBe(1);
  });

  it("participants expose the contact snapshot, falling back to the person", async () => {
    const res = await eventDetail(req(`/api/admin/events/${EVENT}`), {
      params: Promise.resolve({ id: EVENT }),
    });
    const body = await res.json();
    const byId = Object.fromEntries(
      body.participants.map((p: { participationId: string }) => [
        p.participationId,
        p,
      ]),
    );
    expect(byId["HTM-D1CRM001"]).toMatchObject({
      personEmail: null,
      personPhone: PHONE_PAID,
      contact: { name: "Solo Tel (form)", phone: PHONE_PAID, email: null },
    });
    expect(byId["HTM-D1CRM002"].contact.email).toBe(EMAIL_PAID);
  });

  it("non-hackea events get hackea: null", async () => {
    await db.execute(sql`UPDATE events SET type = 'sinergia' WHERE id = ${EVENT}`);
    try {
      const res = await eventDetail(req(`/api/admin/events/${EVENT}`), {
        params: Promise.resolve({ id: EVENT }),
      });
      expect((await res.json()).hackea).toBeNull();
    } finally {
      await db.execute(sql`UPDATE events SET type = 'hackea' WHERE id = ${EVENT}`);
    }
  });
});

describe("GET /api/admin/events", () => {
  it("lazily creates the hackea event so it shows before the first sale", async () => {
    await db.execute(sql`DELETE FROM participations WHERE event_id = ${EVENT}`);
    await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
    const res = await listEvents(req("/api/admin/events"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ev = body.events.find((e: { id: string }) => e.id === EVENT);
    expect(ev).toMatchObject({ type: "hackea" });
  });
});
