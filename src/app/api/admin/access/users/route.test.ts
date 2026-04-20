import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AdminSession } from "@/lib/admin-auth";

// Owner-only gating on the access management API. The important check here
// is that editors/viewers can't escalate privileges by POSTing new users.

const OWNER: AdminSession = {
  email: "owner@example.com",
  userId: null,
  role: "owner",
  scope: "all",
  allowedEventIds: [],
  createdAt: new Date().toISOString(),
};
const EDITOR: AdminSession = {
  ...OWNER,
  email: "editor@example.com",
  userId: 1,
  role: "editor",
  scope: "scoped",
  allowedEventIds: ["some-event"],
};
const VIEWER: AdminSession = {
  ...EDITOR,
  email: "viewer@example.com",
  role: "viewer",
};

let currentSession: AdminSession = OWNER;

vi.mock("@/lib/admin-api-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin-api-auth")>();
  return {
    ...actual,
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

const { GET, POST } = await import("./route");

const EMAIL_PREFIX = "access-test-";

async function cleanup() {
  await db.execute(sql`
    DELETE FROM admin_users WHERE email LIKE ${EMAIL_PREFIX + "%"}
  `);
}

beforeEach(async () => {
  await cleanup();
  currentSession = OWNER;
});

afterAll(async () => {
  await cleanup();
});

function req(url = "http://localhost/api/admin/access/users", init?: RequestInit) {
  return new Request(url, init);
}

describe("POST /api/admin/access/users", () => {
  it("owner can create a scoped editor", async () => {
    const res = await POST(
      req("http://localhost/api/admin/access/users", {
        method: "POST",
        body: JSON.stringify({
          email: `${EMAIL_PREFIX}editor@example.com`,
          role: "editor",
          scope: "scoped",
          allowedEventIds: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe(`${EMAIL_PREFIX}editor@example.com`);
  });

  it("editor cannot create an admin user (403)", async () => {
    currentSession = EDITOR;
    const res = await POST(
      req("http://localhost/api/admin/access/users", {
        method: "POST",
        body: JSON.stringify({
          email: `${EMAIL_PREFIX}escalation@example.com`,
          role: "owner",
          scope: "all",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("viewer cannot create an admin user (403)", async () => {
    currentSession = VIEWER;
    const res = await POST(
      req("http://localhost/api/admin/access/users", {
        method: "POST",
        body: JSON.stringify({
          email: `${EMAIL_PREFIX}escalation2@example.com`,
          role: "viewer",
          scope: "scoped",
          allowedEventIds: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects an owner with scope=scoped (check constraint)", async () => {
    const res = await POST(
      req("http://localhost/api/admin/access/users", {
        method: "POST",
        body: JSON.stringify({
          email: `${EMAIL_PREFIX}bad-owner@example.com`,
          role: "owner",
          scope: "scoped",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/access/users", () => {
  it("editor gets 403", async () => {
    currentSession = EDITOR;
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
