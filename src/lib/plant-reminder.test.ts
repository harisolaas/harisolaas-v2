import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordParticipation } from "./community";
import { runPlantReminderCampaign } from "./plant-reminder";

// DB-backed tests for the audience selection / dedup / override logic.
// Preview mode is side-effect-light (only upserts the tracked WA link row,
// which is idempotent) so we exercise that branch directly. Send-path glue
// (Redis flag + Resend call) isn't covered here.

const PLANT_EVENT_ID = "plant-2026-04";
const TEST_EMAIL_PREFIX = "test-plant-reminder-";
const TEST_WA_SLUG = "email-plant-reminder-20260419";

async function cleanup() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id = ${PLANT_EVENT_ID}
      AND person_id IN (
        SELECT id FROM people WHERE email LIKE ${TEST_EMAIL_PREFIX + "%"}
      )
  `);
  await db.execute(sql`
    DELETE FROM people WHERE email LIKE ${TEST_EMAIL_PREFIX + "%"}
  `);
  // The upserted WA link is shared state — leave it alone between tests.
}

beforeAll(async () => {
  // Ensure the plant event row exists (production already has it, but dev
  // Neon may not).
  await db
    .insert(schema.events)
    .values({
      id: PLANT_EVENT_ID,
      type: "plant",
      name: "Plantación 2026-04-19",
      date: new Date("2026-04-19T17:30:00Z"),
      capacity: 40,
      status: "upcoming",
    })
    .onConflictDoNothing();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.execute(sql`DELETE FROM links WHERE slug = ${TEST_WA_SLUG}`);
});

beforeEach(async () => {
  await cleanup();
});

async function seedRegistrant(opts: {
  email: string;
  name: string;
  status: "confirmed" | "waitlist";
}) {
  await recordParticipation({
    email: opts.email,
    name: opts.name,
    eventId: PLANT_EVENT_ID,
    participationId: `PLANT-TEST-${Math.random().toString(36).slice(2, 10)}`,
    role: "attendee",
    status: opts.status,
  });
}

describe("runPlantReminderCampaign (preview)", () => {
  it("counts confirmed registrants and skips waitlist", async () => {
    await seedRegistrant({
      email: `${TEST_EMAIL_PREFIX}a@example.com`,
      name: "Ana",
      status: "confirmed",
    });
    await seedRegistrant({
      email: `${TEST_EMAIL_PREFIX}b@example.com`,
      name: "Bruno",
      status: "confirmed",
    });
    await seedRegistrant({
      email: `${TEST_EMAIL_PREFIX}c@example.com`,
      name: "Cecilia",
      status: "waitlist",
    });

    const res = await runPlantReminderCampaign({ mode: "preview" });

    expect(res.mode).toBe("preview");
    expect(res.audienceSize).toBe(2);
    expect(res.audienceSample).toEqual(
      expect.arrayContaining([
        `${TEST_EMAIL_PREFIX}a@example.com`,
        `${TEST_EMAIL_PREFIX}b@example.com`,
      ]),
    );
    expect(res.audienceSample).not.toContain(
      `${TEST_EMAIL_PREFIX}c@example.com`,
    );
    expect(res.override).toBe(false);
  });

  it("audienceOverride replaces the DB audience", async () => {
    await seedRegistrant({
      email: `${TEST_EMAIL_PREFIX}a@example.com`,
      name: "Ana",
      status: "confirmed",
    });

    const res = await runPlantReminderCampaign({
      mode: "preview",
      audienceOverride: ["  Override@Example.com  "],
    });

    expect(res.audienceSize).toBe(1);
    expect(res.audienceSample).toEqual(["override@example.com"]);
    expect(res.override).toBe(true);
  });

  it("returns the tracked WA redirect URL", async () => {
    const res = await runPlantReminderCampaign({ mode: "preview" });
    expect(res.waSlug).toBe(TEST_WA_SLUG);
    expect(res.waUrl).toMatch(new RegExp(`/go/${TEST_WA_SLUG}$`));
  });
});
