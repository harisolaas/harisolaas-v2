import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  assertEventAccess,
  assertCanWriteEvent,
  scopeEventIdsClause,
} from "./admin-api-auth";
import type { AdminSession } from "./admin-auth";

function session(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    email: "a@example.com",
    userId: 1,
    role: "editor",
    scope: "scoped",
    allowedEventIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("assertEventAccess", () => {
  it("returns null for scope=all regardless of eventId", () => {
    const s = session({ role: "owner", scope: "all", allowedEventIds: [] });
    expect(assertEventAccess(s, "plant-2026-04")).toBeNull();
    expect(assertEventAccess(s, "anything")).toBeNull();
  });

  it("returns null when scoped and eventId is allowed", () => {
    const s = session({ scope: "scoped", allowedEventIds: ["plant-2026-04"] });
    expect(assertEventAccess(s, "plant-2026-04")).toBeNull();
  });

  it("returns a 404 when scoped and eventId is not in the allow list", async () => {
    const s = session({ scope: "scoped", allowedEventIds: ["plant-2026-04"] });
    const res = assertEventAccess(s, "brote-2026-03");
    expect(res).toBeInstanceOf(NextResponse);
    expect(res?.status).toBe(404);
    await expect(res?.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 404 when scoped and allowedEventIds is empty", () => {
    const s = session({ scope: "scoped", allowedEventIds: [] });
    const res = assertEventAccess(s, "any-event");
    expect(res?.status).toBe(404);
  });
});

describe("assertCanWriteEvent", () => {
  it("returns 403 for viewers regardless of scope", async () => {
    const s = session({
      role: "viewer",
      scope: "scoped",
      allowedEventIds: ["plant-2026-04"],
    });
    const res = assertCanWriteEvent(s, "plant-2026-04");
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns null for editors with access to the event", () => {
    const s = session({
      role: "editor",
      scope: "scoped",
      allowedEventIds: ["plant-2026-04"],
    });
    expect(assertCanWriteEvent(s, "plant-2026-04")).toBeNull();
  });

  it("returns 404 for editors without access to the event", () => {
    const s = session({
      role: "editor",
      scope: "scoped",
      allowedEventIds: ["plant-2026-04"],
    });
    expect(assertCanWriteEvent(s, "brote-2026-03")?.status).toBe(404);
  });

  it("returns null for owners targeting any event", () => {
    const s = session({ role: "owner", scope: "all", allowedEventIds: [] });
    expect(assertCanWriteEvent(s, "literally-anything")).toBeNull();
  });
});

describe("scopeEventIdsClause", () => {
  const column = sql`events.id`;

  it("returns null when scope=all (no extra filter needed)", () => {
    const s = session({ role: "owner", scope: "all", allowedEventIds: [] });
    expect(scopeEventIdsClause(s, column)).toBeNull();
  });

  it("returns a clause matching no rows when scoped with empty allow list", () => {
    const s = session({ scope: "scoped", allowedEventIds: [] });
    const clause = scopeEventIdsClause(s, column);
    expect(clause).not.toBeNull();
    // A user with zero allowed events should match zero rows — the SQL
    // fragment is `events.id IN ('')`, which is never true for real ids.
  });

  it("returns a non-null clause when scoped with entries", () => {
    const s = session({
      scope: "scoped",
      allowedEventIds: ["plant-2026-04", "brote-2026-03"],
    });
    const clause = scopeEventIdsClause(s, column);
    expect(clause).not.toBeNull();
  });
});
