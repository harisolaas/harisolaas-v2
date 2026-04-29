import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordParticipation } from "@/lib/community";
import type { AdminSession } from "@/lib/admin-auth";

// Scope/role enforcement across event-scoped and cross-event admin
// endpoints. Three personas seeded as mutable sessions; each test block
// swaps in the persona it cares about and calls the real route handler.

const OWNER: AdminSession = {
  email: "owner@example.com",
  userId: null,
  role: "owner",
  scope: "all",
  allowedEventIds: [],
  createdAt: new Date().toISOString(),
};
const EDITOR_SCOPED_TO_A: AdminSession = {
  email: "editor@example.com",
  userId: 9001,
  role: "editor",
  scope: "scoped",
  allowedEventIds: ["scope-test-event-A"],
  createdAt: new Date().toISOString(),
};
const VIEWER_SCOPED_TO_A: AdminSession = {
  email: "viewer@example.com",
  userId: 9002,
  role: "viewer",
  scope: "scoped",
  allowedEventIds: ["scope-test-event-A"],
  createdAt: new Date().toISOString(),
};

// Module-level holder the mock reads from. Tests swap this between the
// three personas above; the actual handler logic (assertEventAccess,
// scopeEventIdsClause, role gating) runs unchanged.
let currentSession: AdminSession = OWNER;

vi.mock("@/lib/admin-api-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin-api-auth")>();
  return {
    ...actual,
    // Mirror the real shape: honor minRole so write-gating tests exercise
    // the viewer→403 branch.
    requireAdminSession: async (
      _req: Request,
      opts: { minRole?: "viewer" | "editor" | "owner" } = {},
    ) => {
      const rank = { viewer: 0, editor: 1, owner: 2 } as const;
      if (
        opts.minRole &&
        rank[currentSession.role] < rank[opts.minRole]
      ) {
        const { NextResponse } = await import("next/server");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return currentSession;
    },
  };
});

const { GET: getEvents } = await import("./events/route");
const { GET: getEventDetail } = await import("./events/[id]/route");
const { PATCH: patchParticipation, DELETE: deleteParticipation } = await import(
  "./participations/[id]/route"
);
const { GET: getPeople } = await import("./people/route");
const { GET: getPanorama } = await import("./panorama/route");

const EVENT_A = "scope-test-event-A";
const EVENT_B = "scope-test-event-B";
const EMAIL_PREFIX = "scope-test-";

async function cleanup() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id IN (${EVENT_A}, ${EVENT_B})
      OR person_id IN (
        SELECT id FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}
      )
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}
  `);
}

beforeAll(async () => {
  for (const id of [EVENT_A, EVENT_B]) {
    await db
      .insert(schema.events)
      .values({
        id,
        type: "plant",
        name: `Scope test ${id}`,
        date: new Date("2027-01-01T00:00:00Z"),
        status: "upcoming",
      })
      .onConflictDoNothing();
  }
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.execute(sql`DELETE FROM events WHERE id IN (${EVENT_A}, ${EVENT_B})`);
});

beforeEach(async () => {
  await cleanup();
});

async function seedParticipation(eventId: string, suffix: string) {
  const email = `${EMAIL_PREFIX}${suffix}@example.com`;
  const participationId = `SCOPE-${suffix.toUpperCase()}`;
  await recordParticipation({
    email,
    name: email,
    eventId,
    participationId,
    role: "attendee",
    status: "confirmed",
  });
  return participationId;
}

function makeReq(url = "http://localhost/api/admin/events") {
  return new Request(url, { method: "GET" });
}

describe("GET /api/admin/events (list) scope filtering", () => {
  it("owner sees both events", async () => {
    currentSession = OWNER;
    const res = await getEvents(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: { id: string }[] };
    const ids = body.events.map((e) => e.id);
    expect(ids).toContain(EVENT_A);
    expect(ids).toContain(EVENT_B);
  });

  it("editor scoped to A sees only A", async () => {
    currentSession = EDITOR_SCOPED_TO_A;
    const res = await getEvents(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: { id: string }[] };
    const ids = body.events.map((e) => e.id);
    expect(ids).toContain(EVENT_A);
    expect(ids).not.toContain(EVENT_B);
  });

  it("viewer scoped to A sees only A", async () => {
    currentSession = VIEWER_SCOPED_TO_A;
    const res = await getEvents(makeReq());
    const body = (await res.json()) as { events: { id: string }[] };
    expect(body.events.map((e) => e.id)).toEqual([EVENT_A]);
  });
});

describe("GET /api/admin/events/[id] single-event gating", () => {
  it("owner can fetch either event", async () => {
    currentSession = OWNER;
    const reqA = makeReq(`http://localhost/api/admin/events/${EVENT_A}`);
    const res = await getEventDetail(reqA, {
      params: Promise.resolve({ id: EVENT_A }),
    });
    expect(res.status).toBe(200);
  });

  it("editor scoped to A gets the allowed event", async () => {
    currentSession = EDITOR_SCOPED_TO_A;
    const res = await getEventDetail(makeReq(), {
      params: Promise.resolve({ id: EVENT_A }),
    });
    expect(res.status).toBe(200);
  });

  it("editor scoped to A gets 404 for out-of-scope event B", async () => {
    // 404, not 403 — scoped users shouldn't be able to probe the URL space
    // and learn which event IDs exist.
    currentSession = EDITOR_SCOPED_TO_A;
    const res = await getEventDetail(makeReq(), {
      params: Promise.resolve({ id: EVENT_B }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/participations/[id] role + scope gating", () => {
  it("editor scoped to A can PATCH a participation in A", async () => {
    const pid = await seedParticipation(EVENT_A, "edit-a");
    currentSession = EDITOR_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "used" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await patchParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(200);
  });

  it("viewer scoped to A cannot PATCH even its own event", async () => {
    const pid = await seedParticipation(EVENT_A, "view-a");
    currentSession = VIEWER_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "used" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await patchParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(403);
  });

  it("editor scoped to A gets 404 on PATCH of participation in B (no disclosure)", async () => {
    const pid = await seedParticipation(EVENT_B, "edit-b");
    currentSession = EDITOR_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "used" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await patchParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(404);
  });

  it("editor scoped to A can DELETE a participation in A", async () => {
    const pid = await seedParticipation(EVENT_A, "del-a");
    currentSession = EDITOR_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      { method: "DELETE" },
    );
    const res = await deleteParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(200);
  });

  it("viewer scoped to A cannot DELETE even its own event", async () => {
    const pid = await seedParticipation(EVENT_A, "del-view-a");
    currentSession = VIEWER_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      { method: "DELETE" },
    );
    const res = await deleteParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(403);
  });

  it("editor scoped to A gets 404 on DELETE of participation in B (no disclosure)", async () => {
    const pid = await seedParticipation(EVENT_B, "del-b");
    currentSession = EDITOR_SCOPED_TO_A;
    const req = new Request(
      `http://localhost/api/admin/participations/${pid}`,
      { method: "DELETE" },
    );
    const res = await deleteParticipation(req, {
      params: Promise.resolve({ id: pid }),
    });
    expect(res.status).toBe(404);
  });
});

describe("cross-event endpoints 403 for scoped users", () => {
  it("owner can GET /people", async () => {
    currentSession = OWNER;
    const res = await getPeople(makeReq());
    expect(res.status).toBe(200);
  });

  it("editor scoped gets 403 on /people", async () => {
    currentSession = EDITOR_SCOPED_TO_A;
    const res = await getPeople(makeReq());
    expect(res.status).toBe(403);
  });

  it("viewer scoped gets 403 on /panorama", async () => {
    currentSession = VIEWER_SCOPED_TO_A;
    const res = await getPanorama(makeReq());
    expect(res.status).toBe(403);
  });
});
