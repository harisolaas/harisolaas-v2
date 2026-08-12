import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BROTE_EVENT_ID, BROTE_1_EVENT_ID } from "@/data/brote";
import { recordParticipation } from "./community";
import {
  countComunidadAudienceMissingEmail,
  loadComunidadAudience,
  PLANT_EVENT_ID,
} from "./brote-comunidad-audience";
import { runComunidadCampaign } from "./brote-comunidad-campaign";

/**
 * DB-backed, against the shared dev branch, so nothing here may assume it is
 * alone: every assertion is about THIS test's rows, looked up by email in the
 * full result, never about a total count or a position in the sample.
 *
 * Only preview mode is exercised. It is side-effect-light — it upserts the
 * tracked link row (idempotent) and reads — whereas send mode would want a
 * live Resend key and would write Redis flags.
 */

const P = "test-comunidad-";
/**
 * Stamped into every seeded name so cleanup can still find a row whose email
 * a test has nulled out — otherwise the missing-email cases would leak people
 * into the shared branch on every run.
 */
const MARK = "[test-comunidad]";
const EVENT_IDS = [BROTE_1_EVENT_ID, PLANT_EVENT_ID, BROTE_EVENT_ID];
const WAVE_SLUGS = [
  "email-comunidad-w1",
  "email-comunidad-w2",
  "email-comunidad-w3",
];

const seededPeople = sql`
  SELECT id FROM people
  WHERE email LIKE ${P + "%"} OR name LIKE ${"%" + MARK}
`;

async function cleanup() {
  await db.execute(sql`
    DELETE FROM participations WHERE person_id IN (${seededPeople})
  `);
  await db.execute(sql`DELETE FROM people WHERE id IN (${seededPeople})`);
}

/** Everyone this test seeds, by the reason they exist. */
async function seed(opts: {
  key: string;
  eventId: string;
  status: "confirmed" | "used" | "no_show" | "cancelled" | "waitlist" | "pending";
}) {
  await recordParticipation({
    email: `${P}${opts.key}@example.com`,
    name: `Test ${opts.key} ${MARK}`,
    eventId: opts.eventId,
    participationId: `CM-TEST-${Math.random().toString(36).slice(2, 10)}`,
    role: "attendee",
    status: opts.status,
  });
}

/**
 * Drop the address but keep the person reachable, because
 * `people_contact_check` requires at least one of email / phone / instagram.
 * This is the real shape of the problem `missingEmails` reports: a
 * MercadoPago payer object that carried a phone and no mail.
 */
async function stripEmail(key: string) {
  await db.execute(sql`
    UPDATE people SET email = NULL, phone = '+5491100000000'
    WHERE email = ${emailOf(key)}
  `);
}

const emailOf = (key: string) => `${P}${key}@example.com`;

beforeAll(async () => {
  // Production has these rows; a dev Neon branch may not.
  for (const id of EVENT_IDS) {
    await db
      .insert(schema.events)
      .values({
        id,
        type: id.startsWith("plant") ? "plant" : "brote",
        name: `Test event ${id}`,
        date: new Date("2026-08-20T22:00:00Z"),
        status: "upcoming",
      })
      .onConflictDoNothing();
  }
  await cleanup();
});

afterAll(async () => {
  // In beforeAll/afterAll, not at the end of a test body: one failure
  // mid-test would otherwise poison this branch for every other PR.
  await cleanup();
});

beforeEach(cleanup);

describe("loadComunidadAudience — who is in", () => {
  it("includes BROTE 1 attendees and flags the segment", async () => {
    await seed({ key: "b1", eventId: BROTE_1_EVENT_ID, status: "used" });

    const row = (await loadComunidadAudience()).find(
      (r) => r.email === emailOf("b1"),
    );
    expect(row).toBeDefined();
    expect(row!.cameToBrote1).toBe(true);
    expect(row!.cameToPlant).toBe(false);
  });

  it("includes planting-day attendees and flags the segment", async () => {
    await seed({ key: "pl", eventId: PLANT_EVENT_ID, status: "confirmed" });

    const row = (await loadComunidadAudience()).find(
      (r) => r.email === emailOf("pl"),
    );
    expect(row?.cameToPlant).toBe(true);
    expect(row?.cameToBrote1).toBe(false);
  });

  it("collapses someone who came to both into one row with both flags", async () => {
    await seed({ key: "both", eventId: BROTE_1_EVENT_ID, status: "used" });
    await seed({ key: "both", eventId: PLANT_EVENT_ID, status: "confirmed" });

    const rows = (await loadComunidadAudience()).filter(
      (r) => r.email === emailOf("both"),
    );
    // One mail, not two — the whole point of the GROUP BY.
    expect(rows).toHaveLength(1);
    expect(rows[0].cameToBrote1).toBe(true);
    expect(rows[0].cameToPlant).toBe(true);
  });

  it("keeps no_show — they paid and didn't make it", async () => {
    await seed({ key: "ns", eventId: BROTE_1_EVENT_ID, status: "no_show" });

    const emails = (await loadComunidadAudience()).map((r) => r.email);
    expect(emails).toContain(emailOf("ns"));
  });
});

describe("loadComunidadAudience — who is out", () => {
  it("drops cancelled — they signed up and pulled out", async () => {
    await seed({ key: "cx", eventId: BROTE_1_EVENT_ID, status: "cancelled" });

    const emails = (await loadComunidadAudience()).map((r) => r.email);
    expect(emails).not.toContain(emailOf("cx"));
  });

  it.each(["waitlist", "pending"] as const)(
    "drops %s — the copy claims they were there, and they were not",
    async (status) => {
      await seed({ key: `w-${status}`, eventId: PLANT_EVENT_ID, status });

      // "El 19 de abril te tomaste el viaje hasta la reserva y plantaste con
      // las manos" is not a sentence you can send to someone who sat on the
      // waitlist, or whose checkout never completed.
      const emails = (await loadComunidadAudience()).map((r) => r.email);
      expect(emails).not.toContain(emailOf(`w-${status}`));
    },
  );

  it("still reaches someone waitlisted for one event and confirmed at the other", async () => {
    await seed({ key: "mix", eventId: PLANT_EVENT_ID, status: "waitlist" });
    await seed({ key: "mix", eventId: BROTE_1_EVENT_ID, status: "used" });

    const row = (await loadComunidadAudience()).find(
      (r) => r.email === emailOf("mix"),
    );
    expect(row).toBeDefined();
    // And the waitlisted half must not set the flag, or they get the
    // plantación paragraph about a day they never went to.
    expect(row!.cameToPlant).toBe(false);
    expect(row!.cameToBrote1).toBe(true);
  });

  it.each(["confirmed", "used", "no_show"] as const)(
    "drops anyone already holding a %s BROTE 2 ticket",
    async (status) => {
      await seed({ key: "has2", eventId: BROTE_1_EVENT_ID, status: "used" });
      await seed({ key: "has2", eventId: BROTE_EVENT_ID, status });

      const emails = (await loadComunidadAudience()).map((r) => r.email);
      // Offering a discount on a ticket they own reads as a mistake and
      // invites a refund request.
      expect(emails).not.toContain(emailOf("has2"));
    },
  );

  it("still includes someone whose BROTE 2 row was cancelled", async () => {
    await seed({ key: "cx2", eventId: BROTE_1_EVENT_ID, status: "used" });
    await seed({ key: "cx2", eventId: BROTE_EVENT_ID, status: "cancelled" });

    // They tried to buy and it fell through — that is a reason to write, not
    // a reason to stay quiet.
    const emails = (await loadComunidadAudience()).map((r) => r.email);
    expect(emails).toContain(emailOf("cx2"));
  });

  it("drops anyone who asked off the list", async () => {
    await seed({ key: "baja", eventId: BROTE_1_EVENT_ID, status: "used" });
    await db.execute(sql`
      UPDATE people SET opted_out_at = NOW() WHERE email = ${emailOf("baja")}
    `);

    const emails = (await loadComunidadAudience()).map((r) => r.email);
    expect(emails).not.toContain(emailOf("baja"));
  });
});

describe("countComunidadAudienceMissingEmail", () => {
  it("counts a qualifying person with no address on file", async () => {
    await seed({ key: "noemail", eventId: BROTE_1_EVENT_ID, status: "used" });
    const before = await countComunidadAudienceMissingEmail();

    // `recordParticipation` requires an email, so the only way to reach the
    // state this counter exists for is to strip it afterwards.
    await stripEmail("noemail");

    expect(await countComunidadAudienceMissingEmail()).toBe(before + 1);
    // And they must not silently appear in the audience either.
    const emails = (await loadComunidadAudience()).map((r) => r.email);
    expect(emails).not.toContain(emailOf("noemail"));
  });

  it("does not count someone excluded for another reason", async () => {
    const before = await countComunidadAudienceMissingEmail();
    await seed({ key: "cxne", eventId: BROTE_1_EVENT_ID, status: "cancelled" });
    await stripEmail("cxne");

    // Both halves have to ask the same question, or `missingEmails` starts
    // reporting people who were never in scope.
    expect(await countComunidadAudienceMissingEmail()).toBe(before);
  });
});

describe("runComunidadCampaign (preview)", () => {
  afterAll(async () => {
    // The wave links are shared state created by the runner; drop the ones
    // this suite caused so a preview branch isn't left with orphans.
    await db.execute(sql`
      DELETE FROM links WHERE slug IN (${sql.join(
        WAVE_SLUGS.map((s) => sql`${s}`),
        sql`, `,
      )})
    `);
  });

  it("reports the per-segment split", async () => {
    await seed({ key: "s1", eventId: BROTE_1_EVENT_ID, status: "used" });
    await seed({ key: "s2", eventId: PLANT_EVENT_ID, status: "confirmed" });
    await seed({ key: "s3", eventId: BROTE_1_EVENT_ID, status: "used" });
    await seed({ key: "s3", eventId: PLANT_EVENT_ID, status: "confirmed" });

    const res = await runComunidadCampaign({ wave: 1, mode: "preview" });

    // Relative, not absolute: the branch is shared.
    const after = res.segments;
    expect(after.brote1).toBeGreaterThanOrEqual(1);
    expect(after.plant).toBeGreaterThanOrEqual(1);
    expect(after.both).toBeGreaterThanOrEqual(1);
    expect(res.audienceSize).toBeGreaterThanOrEqual(3);
  });

  it("never sends in preview mode", async () => {
    const res = await runComunidadCampaign({ wave: 1, mode: "preview" });
    expect(res.mode).toBe("preview");
    // If these ever become numbers, preview has started delivering mail.
    expect(res.sent).toBeUndefined();
    expect(res.failed).toBeUndefined();
  });

  it("audienceOverride replaces the DB audience and normalises addresses", async () => {
    await seed({ key: "ignored", eventId: BROTE_1_EVENT_ID, status: "used" });

    const res = await runComunidadCampaign({
      wave: 2,
      mode: "preview",
      audienceOverride: ["  Override@Example.com  ", ""],
    });

    expect(res.override).toBe(true);
    expect(res.audienceSize).toBe(1);
    expect(res.audienceSample).toEqual(["override@example.com"]);
  });

  it.each([1, 2, 3] as const)(
    "wave %i upserts its own tracked link and reports its URL",
    async (wave) => {
      const res = await runComunidadCampaign({ wave, mode: "preview" });

      expect(res.linkSlug).toBe(`email-comunidad-w${wave}`);
      expect(res.ctaUrl).toMatch(new RegExp(`/go/email-comunidad-w${wave}$`));
      expect(res.campaign).toBe(`brote-comunidad-w${wave}-2026-08`);

      const row = await db.execute(sql`
        SELECT destination, channel FROM links WHERE slug = ${res.linkSlug}
      `);
      // Without the row, /go/ 404s and the whole wave is unclickable.
      expect(row.rows).toHaveLength(1);
      expect((row.rows[0] as { destination: string }).destination).toBe(
        "/es/brote/invitacion/comunidad",
      );
      expect((row.rows[0] as { channel: string }).channel).toBe(
        "email-campaign",
      );
    },
  );
});
