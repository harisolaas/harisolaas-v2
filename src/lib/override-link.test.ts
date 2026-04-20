import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resolveOverrideLink } from "./override-link";

// DB-backed coverage for the override-link resolver. Wrong answers here
// translate into real-world sign-ups that either silently skip capacity
// when they shouldn't, or hit "lleno" when they carry a legit invite —
// both are load-bearing for host-distributed links.

const EMAIL = "override-link-test@example.com";
const SLUG_ACTIVE_BYPASS = "override-test-active";
const SLUG_ACTIVE_PLAIN = "override-test-plain";
const SLUG_ARCHIVED = "override-test-archived";

async function cleanup() {
  await db.execute(sql`
    DELETE FROM links WHERE slug IN (
      ${SLUG_ACTIVE_BYPASS}, ${SLUG_ACTIVE_PLAIN}, ${SLUG_ARCHIVED}
    )
  `);
  await db.execute(sql`DELETE FROM people WHERE email = ${EMAIL}`);
}

let referrerId: number;

beforeAll(async () => {
  await cleanup();
  const ins = await db.execute<{ id: number }>(sql`
    INSERT INTO people (email, name)
    VALUES (${EMAIL}, 'Override Test Person')
    RETURNING id
  `);
  referrerId = Number(ins.rows![0].id);
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await db.execute(sql`
    DELETE FROM links WHERE slug IN (
      ${SLUG_ACTIVE_BYPASS}, ${SLUG_ACTIVE_PLAIN}, ${SLUG_ARCHIVED}
    )
  `);
});

async function insertLink(opts: {
  slug: string;
  status?: string;
  bypassCapacity?: boolean;
  referredByPersonId?: number | null;
}) {
  await db.execute(sql`
    INSERT INTO links (
      slug, destination, label, channel, source, medium,
      created_date, created_by, status, bypass_capacity, referred_by_person_id
    ) VALUES (
      ${opts.slug},
      '/es/sinergia',
      'override test',
      'wa-personal',
      'whatsapp',
      'invite',
      '2026-04-20',
      'test',
      ${opts.status ?? "active"},
      ${opts.bypassCapacity ?? false},
      ${opts.referredByPersonId ?? null}
    )
  `);
}

describe("resolveOverrideLink", () => {
  it("returns no-op for missing slugs", async () => {
    const res = await resolveOverrideLink(null);
    expect(res.bypassCapacity).toBe(false);
    expect(res.referredByPersonId).toBeUndefined();
    expect(res.linkExists).toBe(false);
  });

  it("returns no-op for unknown slugs", async () => {
    const res = await resolveOverrideLink("nonexistent-slug-xyz");
    expect(res.bypassCapacity).toBe(false);
    expect(res.linkExists).toBe(false);
  });

  it("returns the flags for active override links", async () => {
    await insertLink({
      slug: SLUG_ACTIVE_BYPASS,
      bypassCapacity: true,
      referredByPersonId: referrerId,
    });
    const res = await resolveOverrideLink(SLUG_ACTIVE_BYPASS);
    expect(res.bypassCapacity).toBe(true);
    expect(res.referredByPersonId).toBe(referrerId);
    expect(res.linkExists).toBe(true);
  });

  it("returns no bypass for plain active links", async () => {
    await insertLink({ slug: SLUG_ACTIVE_PLAIN, bypassCapacity: false });
    const res = await resolveOverrideLink(SLUG_ACTIVE_PLAIN);
    expect(res.bypassCapacity).toBe(false);
    expect(res.linkExists).toBe(true);
  });

  it("ignores the flag for archived links (kill-switch semantics)", async () => {
    await insertLink({
      slug: SLUG_ARCHIVED,
      status: "archived",
      bypassCapacity: true,
      referredByPersonId: referrerId,
    });
    const res = await resolveOverrideLink(SLUG_ARCHIVED);
    expect(res.bypassCapacity).toBe(false);
    expect(res.referredByPersonId).toBeUndefined();
    expect(res.linkExists).toBe(true);
  });
});
