import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordParticipation } from "./community";

// DB-level tests for the links + link_clicks schema. Hit the Neon dev branch
// via DATABASE_URL. Vitest is configured with maxWorkers: 1 to serialize.

const EVT = "test-links-evt";
const SLUG_A = "test-ig-story-20260418-t01";
const SLUG_B = "test-ig-story-20260418-t02";
const SLUG_C = "test-ig-story-20260418-t03";
const EMAIL_PREFIX = "test-links-";

async function reset() {
  await db.execute(sql`
    DELETE FROM participations WHERE event_id = ${EVT}
  `);
  await db.execute(sql`
    DELETE FROM link_clicks WHERE link_slug IN (${SLUG_A}, ${SLUG_B}, ${SLUG_C})
  `);
  await db.execute(sql`
    DELETE FROM links WHERE slug IN (${SLUG_A}, ${SLUG_B}, ${SLUG_C})
  `);
  await db.execute(sql`
    DELETE FROM events WHERE id = ${EVT}
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}
  `);
}

beforeAll(async () => {
  await reset();
  await db.insert(schema.events).values({
    id: EVT,
    type: "plant",
    name: "Test links event",
    date: new Date("2027-02-01T00:00:00Z"),
    status: "upcoming",
  });
  await db.insert(schema.links).values([
    {
      slug: SLUG_A,
      destination: "/es/plantacion",
      label: "Test A",
      channel: "ig-story",
      source: "instagram",
      medium: "story",
      campaign: "plant_launch",
      createdDate: "2026-04-18",
      createdBy: "test@example.com",
      status: "active",
    },
    {
      slug: SLUG_B,
      destination: "/es/plantacion",
      label: "Test B",
      channel: "email-campaign",
      source: "email",
      medium: "campaign",
      campaign: "plant_launch",
      createdDate: "2026-04-18",
      createdBy: "test@example.com",
      status: "active",
    },
    {
      slug: SLUG_C,
      destination: "/es/plantacion",
      label: "Test C (unused)",
      channel: "ig-post",
      source: "instagram",
      medium: "post",
      campaign: null,
      createdDate: "2026-04-18",
      createdBy: "test@example.com",
      status: "active",
    },
  ]);
});

afterAll(async () => {
  await reset();
});

describe("links schema + FK behavior", () => {
  it("records a participation with link_slug via attribution", async () => {
    await recordParticipation({
      email: `${EMAIL_PREFIX}one@example.com`,
      name: "One",
      eventId: EVT,
      participationId: "TEST-LINKS-1",
      role: "planter",
      attribution: {
        linkSlug: SLUG_A,
        source: "instagram",
        medium: "story",
        campaign: "plant_launch",
        capturedAt: new Date().toISOString(),
      },
    });

    const rows = await db.execute<{ link_slug: string | null }>(sql`
      SELECT link_slug FROM participations WHERE id = 'TEST-LINKS-1'
    `);
    expect(rows.rows?.[0]?.link_slug).toBe(SLUG_A);
  });

  it("the FK is enforced — inserting with an unknown link_slug fails", async () => {
    await expect(
      db.execute(sql`
        INSERT INTO participations (id, person_id, event_id, role, status, link_slug)
        VALUES ('TEST-LINKS-BAD', 999999, ${EVT}, 'planter', 'confirmed', 'does-not-exist')
      `),
    ).rejects.toThrow();
  });

  it("ON DELETE SET NULL clears participation.link_slug when link is deleted", async () => {
    // Insert a confirmed participation via SLUG_C (no signups yet, so deletable)
    await recordParticipation({
      email: `${EMAIL_PREFIX}c@example.com`,
      name: "C",
      eventId: EVT,
      participationId: "TEST-LINKS-C",
      role: "planter",
      attribution: {
        linkSlug: SLUG_C,
        capturedAt: new Date().toISOString(),
      },
    });

    // Verify the participation is stamped.
    const beforeRows = await db.execute<{ link_slug: string | null }>(sql`
      SELECT link_slug FROM participations WHERE id = 'TEST-LINKS-C'
    `);
    expect(beforeRows.rows?.[0]?.link_slug).toBe(SLUG_C);

    // Delete the link directly (bypasses the app's "block if signups" guard
    // — this test exercises the DB-level ON DELETE SET NULL behavior).
    await db.execute(sql`DELETE FROM links WHERE slug = ${SLUG_C}`);

    const afterRows = await db.execute<{ link_slug: string | null }>(sql`
      SELECT link_slug FROM participations WHERE id = 'TEST-LINKS-C'
    `);
    expect(afterRows.rows?.[0]?.link_slug).toBeNull();
  });

  it("link_clicks cascades delete when the link is deleted", async () => {
    // SLUG_B has no signups yet; insert clicks then delete the link.
    await db.insert(schema.linkClicks).values([
      { linkSlug: SLUG_B, isBot: false },
      { linkSlug: SLUG_B, isBot: false },
      { linkSlug: SLUG_B, isBot: true },
    ]);

    const before = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM link_clicks WHERE link_slug = ${SLUG_B}
    `);
    expect(Number(before.rows?.[0]?.n ?? 0)).toBe(3);

    await db.execute(sql`DELETE FROM links WHERE slug = ${SLUG_B}`);

    const after = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM link_clicks WHERE link_slug = ${SLUG_B}
    `);
    expect(Number(after.rows?.[0]?.n ?? 0)).toBe(0);
  });
});
