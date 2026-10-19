import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  findPersonIdByPhone,
  phoneMatchCandidates,
  recordParticipation,
} from "./community";
import {
  confirmHackeaPayment,
  createHackeaLead,
  ensureHackeaEvent,
  markHackeaFlag,
  normalizeArPhone,
} from "./hackea";
import { hackeaConfig } from "@/data/hackea";

// DB-backed: hits the shared dev Neon branch (see docs/ops/test-database.md).
// Everything this file creates is keyed on a `hackea-test-` prefix — event
// ids, person names and emails — and swept in beforeAll/afterAll, so a run
// that dies halfway heals on the next one.

const EVT_OPEN = "hackea-test-evt-open";
const EVT_CAPPED = "hackea-test-evt-capped";

// Phone-only people have no email to match on, so the sweep keys on the
// name prefix. Every fixture name below starts with it.
const N = (s: string) => `hackea-test-${s}`;
const E = (s: string) => `hackea-test-${s}@example.com`;

async function sweep() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id LIKE 'hackea-test-%'
       OR person_id IN (
         SELECT id FROM people
         WHERE name LIKE 'hackea-test-%' OR email LIKE 'hackea-test-%@example.com'
       )
  `);
  await db.execute(sql`
    DELETE FROM people
    WHERE name LIKE 'hackea-test-%' OR email LIKE 'hackea-test-%@example.com'
  `);
  await db.execute(sql`DELETE FROM events WHERE id LIKE 'hackea-test-%'`);
}

beforeAll(async () => {
  await sweep();
  await db.insert(schema.events).values([
    {
      id: EVT_OPEN,
      type: "hackea",
      name: "hackea test open",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    },
    {
      id: EVT_CAPPED,
      type: "hackea",
      name: "hackea test capped",
      date: new Date("2027-01-01T00:00:00Z"),
      capacity: 1,
      status: "upcoming",
    },
  ]);
});

// ensureHackeaEvent writes the REAL event row. Only remove it afterwards if
// this suite is the one that created it — on a branch where the admin or the
// seeder already made it, it stays.
let realEventExisted = true;

beforeAll(async () => {
  const res = await db.execute<{ id: string }>(
    sql`SELECT id FROM events WHERE id = ${hackeaConfig.eventId}`,
  );
  realEventExisted = (res.rows?.length ?? 0) > 0;
});

afterAll(async () => {
  await sweep();
  if (!realEventExisted) {
    await db.execute(sql`
      DELETE FROM events
      WHERE id = ${hackeaConfig.eventId}
        AND NOT EXISTS (
          SELECT 1 FROM participations WHERE event_id = ${hackeaConfig.eventId}
        )
    `);
  }
});

beforeEach(async () => {
  await db.execute(sql`
    DELETE FROM participations WHERE event_id IN (${EVT_OPEN}, ${EVT_CAPPED})
  `);
  await db.execute(sql`
    DELETE FROM people
    WHERE name LIKE 'hackea-test-%' OR email LIKE 'hackea-test-%@example.com'
  `);
});

async function personById(id: number) {
  const res = await db.execute<{
    id: number;
    email: string | null;
    phone: string | null;
    name: string;
  }>(sql`SELECT id, email, phone, name FROM people WHERE id = ${id}`);
  return res.rows[0];
}

async function participation(id: string) {
  const res = await db.execute<{
    id: string;
    person_id: number;
    status: string;
    external_payment_id: string | null;
    price_cents: number | null;
    currency: string | null;
    role: string;
    metadata: Record<string, unknown>;
  }>(sql`SELECT * FROM participations WHERE id = ${id}`);
  return res.rows[0];
}

// ============================================================
// Pure helpers
// ============================================================

describe("normalizeArPhone", () => {
  // Every spelling isValidWhatsApp lets through for one AR number must land
  // on the same `+549` + 10-digit national form — it's stored on the lead
  // and turned into the host's wa.me link.
  it.each([
    ["11 1234-5678", "+5491112345678"],
    ["011 1234-5678", "+5491112345678"],
    ["011 15 1234-5678", "+5491112345678"],
    ["+54 9 11 1234-5678", "+5491112345678"],
    ["+54 11 1234-5678", "+5491112345678"],
    ["54 11 1234 5678", "+5491112345678"],
    ["5491112345678", "+5491112345678"],
    ["+5491112345678", "+5491112345678"],
    ["0351 412-3456", "+5493514123456"],
    ["351 412 3456", "+5493514123456"],
    ["11 15 1234-5678", "+5491112345678"],
    ["+54 11 15 1234-5678", "+5491112345678"],
    ["0054 9 11 1234-5678", "+5491112345678"],
    ["0054 11 1234-5678", "+5491112345678"],
  ])("AR %s → %s", (raw, expected) => {
    expect(normalizeArPhone(raw)).toBe(expected);
  });

  it.each([
    ["+1 415 555 0123", "+14155550123"],
    ["+34 612 34 56 78", "+34612345678"],
    ["+598 99 123 456", "+59899123456"],
  ])("foreign %s keeps its digits → %s", (raw, expected) => {
    expect(normalizeArPhone(raw)).toBe(expected);
  });

  it.each([
    "011 15 1234-5678",
    "+54 11 1234-5678",
    "+1 415 555 0123",
  ])("is idempotent for %s", (raw) => {
    const once = normalizeArPhone(raw);
    expect(normalizeArPhone(once)).toBe(once);
  });

  // Stored form and typed form must still find each other in people.phone.
  it.each([
    "11 1234-5678",
    "011 1234-5678",
    "011 15 1234-5678",
    "+54 11 1234-5678",
    "0351 412-3456",
    "+34 612 34 56 78",
    "11 15 1234-5678",
    "+54 11 15 1234-5678",
    "0054 9 11 1234-5678",
    "0054 11 1234-5678",
  ])("round-trips through phoneMatchCandidates for %s", (raw) => {
    const stored = normalizeArPhone(raw);
    expect(phoneMatchCandidates(raw)).toContain(stored.slice(1));
    expect(phoneMatchCandidates(stored)).toContain(raw.replace(/[+\s\-().]/g, ""));
  });
});

// ============================================================
// recordParticipation — phone-only path
// ============================================================

describe("recordParticipation phone-only", () => {
  it("rejects when neither email nor phone is given", async () => {
    await expect(
      recordParticipation({
        name: N("nadie"),
        eventId: EVT_OPEN,
        participationId: "hackea-test-p0",
        role: "attendee",
      }),
    ).rejects.toThrow("email or phone required");
  });

  it("rejects a phone with fewer than 8 digits when there is no email", async () => {
    for (const junk of ["+", " - ", "1234567"]) {
      await expect(
        recordParticipation({
          name: N("junk"),
          phone: junk,
          eventId: EVT_OPEN,
          participationId: "hackea-test-pjunk",
          role: "attendee",
          status: "pending",
        }),
      ).rejects.toThrow("email or phone required");
    }
  });

  it("creates a person with a null email", async () => {
    const res = await recordParticipation({
      name: N("ana"),
      phone: "+5491100000101",
      eventId: EVT_OPEN,
      participationId: "hackea-test-p1",
      role: "attendee",
      status: "pending",
    });
    expect(res.created).toBe(true);
    expect(res.personCreated).toBe(true);
    const p = await personById(res.personId);
    expect(p.email).toBeNull();
    expect(p.phone).toBe("+5491100000101");
    expect(p.name).toBe(N("ana"));
  });

  it("reuses the person when the same number arrives in another format", async () => {
    const first = await recordParticipation({
      name: N("beto"),
      phone: "+5491100000102",
      eventId: EVT_OPEN,
      participationId: "hackea-test-p2",
      role: "attendee",
      status: "pending",
    });
    const second = await recordParticipation({
      name: N("beto-otro"),
      phone: "11 0000-0102",
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p3",
      role: "attendee",
      status: "pending",
    });
    expect(second.personId).toBe(first.personId);
    expect(second.personCreated).toBe(false);
    const p = await personById(first.personId);
    // Existing values are sticky.
    expect(p.name).toBe(N("beto"));
    expect(p.phone).toBe("+5491100000102");
  });

  it("matches a person stored in AR local form from an international number", async () => {
    const first = await recordParticipation({
      name: N("caro"),
      phone: "11 0000-0103",
      eventId: EVT_OPEN,
      participationId: "hackea-test-p4",
      role: "attendee",
      status: "pending",
    });
    const second = await recordParticipation({
      name: N("caro"),
      phone: "+54 9 11 0000-0103",
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p5",
      role: "attendee",
      status: "pending",
    });
    expect(second.personId).toBe(first.personId);
  });

  it("keeps the email path keyed on email (phone does not merge people)", async () => {
    const phoneOnly = await recordParticipation({
      name: N("dani"),
      phone: "+5491100000104",
      eventId: EVT_OPEN,
      participationId: "hackea-test-p6",
      role: "attendee",
      status: "pending",
    });
    const withEmail = await recordParticipation({
      email: E("dani"),
      name: N("dani"),
      phone: "+5491100000104",
      eventId: EVT_OPEN,
      participationId: "hackea-test-p7",
      role: "attendee",
      status: "pending",
    });
    expect(withEmail.personId).not.toBe(phoneOnly.personId);
    expect(withEmail.created).toBe(true);
  });
});

// ============================================================
// Hackeá tu mente lib
// ============================================================

describe("ensureHackeaEvent", () => {
  it("creates the event row from hackeaConfig, idempotently", async () => {
    await ensureHackeaEvent();
    await ensureHackeaEvent();
    const res = await db.execute<{
      id: string;
      type: string;
      landing_path: string | null;
      status: string;
    }>(sql`SELECT id, type, landing_path, status FROM events WHERE id = ${hackeaConfig.eventId}`);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].type).toBe(hackeaConfig.eventType);
    expect(res.rows[0].landing_path).toBe(hackeaConfig.landingPath);
  });
});

describe("createHackeaLead", () => {
  it("writes a pending HTM- participation with the config price", async () => {
    const lead = await createHackeaLead({
      name: N("eli"),
      phone: "11 0000-0105",
      eventId: EVT_OPEN,
    });
    expect(lead.created).toBe(true);
    expect(lead.status).toBe("pending");
    expect(lead.participationId).toMatch(/^HTM-[A-Z0-9]{8}$/);
    const row = await participation(lead.participationId);
    expect(row.status).toBe("pending");
    expect(row.role).toBe("attendee");
    expect(Number(row.price_cents)).toBe(hackeaConfig.ticketPriceCents);
    expect(row.currency).toBe(hackeaConfig.currency);
    const p = await personById(Number(row.person_id));
    // Stored in normalized form for this flow.
    expect(p.phone).toBe("+5491100000105");
    expect(p.email).toBeNull();
  });

  // Before libphonenumber, `0351 15 600-0107` was stored mangled as
  // `+0351156000107`. Typing it again must still find that paid lead.
  it("finds a paid lead stored in the pre-libphonenumber form (409, no new row)", async () => {
    const legacy = "+0351156000107";
    const old = await recordParticipation({
      name: N("legacy"),
      phone: legacy,
      eventId: EVT_OPEN,
      participationId: "hackea-test-p-legacy",
      role: "attendee",
      status: "pending",
      metadata: { contact: { name: N("legacy"), phone: legacy, email: null } },
    });
    await confirmHackeaPayment({
      participationId: "hackea-test-p-legacy",
      paymentId: "hackea-test-pay-legacy",
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(normalizeArPhone("0351 15 600-0107")).toBe("+5493516000107");

    const again = await createHackeaLead({
      name: N("legacy"),
      phone: "0351 15 600-0107",
      eventId: EVT_OPEN,
    });
    expect(again.created).toBe(false);
    expect(again.participationId).toBe("hackea-test-p-legacy");
    expect(again.paid).toBe(true);
    const count = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM participations WHERE event_id = ${EVT_OPEN}
    `);
    expect(Number(count.rows[0].n)).toBe(1);
    expect(old.created).toBe(true);
  });

  it("is idempotent and returns the existing row's status", async () => {
    const a = await createHackeaLead({
      name: N("fede"),
      phone: "+5491100000106",
      eventId: EVT_OPEN,
    });
    const b = await createHackeaLead({
      name: N("fede"),
      phone: "11 0000 0106",
      eventId: EVT_OPEN,
    });
    expect(b.created).toBe(false);
    expect(b.participationId).toBe(a.participationId);
    expect(b.status).toBe("pending");

    await confirmHackeaPayment({
      participationId: a.participationId,
      paymentId: "hackea-test-pay-106",
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    const c = await createHackeaLead({
      name: N("fede"),
      phone: "+5491100000106",
      eventId: EVT_OPEN,
    });
    expect(c.participationId).toBe(a.participationId);
    expect(c.status).toBe("confirmed");
  });

  it("fills in a missing email without overwriting existing values", async () => {
    const a = await createHackeaLead({
      name: N("gabi"),
      phone: "+5491100000107",
      eventId: EVT_OPEN,
    });
    const b = await createHackeaLead({
      name: N("gabi-otro"),
      phone: "+5491100000107",
      email: E("gabi"),
      eventId: EVT_OPEN,
    });
    expect(b.participationId).toBe(a.participationId);
    expect(b.created).toBe(false);
    const row = await participation(a.participationId);
    const p = await personById(Number(row.person_id));
    expect(p.email).toBe(E("gabi"));
    expect(p.name).toBe(N("gabi"));

    // A later lead with a different email does not replace it, and the
    // WhatsApp number (the required field) keeps it on the same lead.
    const c = await createHackeaLead({
      name: N("gabi"),
      phone: "+5491100000107",
      email: E("gabi-2"),
      eventId: EVT_OPEN,
    });
    expect(c.participationId).toBe(a.participationId);
    const after = await personById(Number(row.person_id));
    expect(after.email).toBe(E("gabi"));
    const dup = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM people WHERE email = ${E("gabi-2")}
    `);
    expect(Number(dup.rows[0].n)).toBe(0);
  });

  it("fills in a missing phone on an email-known person", async () => {
    await recordParticipation({
      email: E("hugo"),
      name: N("hugo"),
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p8",
      role: "attendee",
      status: "pending",
    });
    const lead = await createHackeaLead({
      name: N("hugo"),
      phone: "11 0000-0108",
      email: E("hugo"),
      eventId: EVT_OPEN,
    });
    const row = await participation(lead.participationId);
    const p = await personById(Number(row.person_id));
    expect(p.email).toBe(E("hugo"));
    expect(p.phone).toBe("+5491100000108");
  });
});

describe("confirmHackeaPayment", () => {
  it("confirms a pending lead and stamps the payment", async () => {
    const lead = await createHackeaLead({
      name: N("ines"),
      phone: "+5491100000109",
      email: E("ines"),
      eventId: EVT_OPEN,
    });
    const res = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-109",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(res.outcome).toBe("confirmed");
    expect(res.participant).toEqual({
      id: lead.participationId,
      name: N("ines"),
      phone: "+5491100000109",
      email: E("ines"),
    });
    const row = await participation(lead.participationId);
    expect(row.status).toBe("confirmed");
    expect(row.external_payment_id).toBe("hackea-test-pay-109");
    expect(Number(row.price_cents)).toBe(2_130_000);
    expect(row.currency).toBe("ARS");
  });

  it("returns already on a replay of the same payment", async () => {
    const lead = await createHackeaLead({
      name: N("juli"),
      phone: "+5491100000110",
      eventId: EVT_OPEN,
    });
    const args = {
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-110",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    };
    expect((await confirmHackeaPayment(args)).outcome).toBe("confirmed");
    const again = await confirmHackeaPayment(args);
    expect(again.outcome).toBe("already");
    expect(again.participant?.email).toBeNull();
    expect(again.participant?.phone).toBe("+5491100000110");
  });

  it("keeps a cancelled paid entrada cancelled on a redelivery", async () => {
    const lead = await createHackeaLead({
      name: N("cancelada"),
      phone: "+5491100000190",
      eventId: EVT_OPEN,
    });
    const args = {
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-190",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    };
    expect((await confirmHackeaPayment(args)).outcome).toBe("confirmed");
    // The drawer's "No vendrá".
    await db.execute(sql`
      UPDATE participations SET status = 'cancelled'
      WHERE id = ${lead.participationId}
    `);

    expect((await confirmHackeaPayment(args)).outcome).toBe("already");
    const second = await confirmHackeaPayment({
      ...args,
      paymentId: "hackea-test-pay-191",
    });
    expect(second.outcome).toBe("already");

    const row = await participation(lead.participationId);
    expect(row.status).toBe("cancelled");
    expect(row.external_payment_id).toBe("hackea-test-pay-190");
  });

  it("a cancelled paid entrada is still paid for a resubmit", async () => {
    const lead = await createHackeaLead({
      name: N("cancelada-reenvia"),
      phone: "+5491100000193",
      eventId: EVT_OPEN,
    });
    await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-193",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    await db.execute(sql`
      UPDATE participations SET status = 'cancelled'
      WHERE id = ${lead.participationId}
    `);
    const again = await createHackeaLead({
      name: N("cancelada-reenvia otra"),
      phone: "+5491100000193",
      eventId: EVT_OPEN,
    });
    expect(again).toMatchObject({
      participationId: lead.participationId,
      status: "cancelled",
      paid: true,
    });
    const row = await participation(lead.participationId);
    expect((row.metadata.contact as { name: string }).name).toBe(
      N("cancelada-reenvia"),
    );
  });

  it("a refunded entrada can be bought again as a fresh purchase", async () => {
    const lead = await createHackeaLead({
      name: N("reintegro"),
      phone: "+5491100000194",
      eventId: EVT_OPEN,
    });
    await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-194",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    // What the webhook writes on a refund, the first purchase's mail
    // flags, and a door check-in left over (the refund doesn't touch it).
    await db.execute(sql`
      UPDATE participations SET
        status = 'used',
        used_at = NOW(),
        metadata = metadata || jsonb_build_object(
          'refund', jsonb_build_object('status', 'refunded', 'paymentId', 'hackea-test-pay-194'),
          'buyerEmailSent', true,
          'hostNotified', true
        )
      WHERE id = ${lead.participationId}
    `);

    const again = await createHackeaLead({
      name: N("reintegro vuelve"),
      phone: "+5491100000194",
      eventId: EVT_OPEN,
    });
    expect(again).toMatchObject({
      participationId: lead.participationId,
      status: "used",
      paid: false,
    });

    const fresh = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-195",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(fresh.outcome).toBe("confirmed");
    expect(fresh.participant?.name).toBe(N("reintegro vuelve"));

    const row = await participation(lead.participationId);
    expect(row.status).toBe("confirmed");
    expect(row.external_payment_id).toBe("hackea-test-pay-195");
    expect(row.metadata.extraPaymentIds).toBeUndefined();
    // The new purchase mails again; the old refund stays as a trail.
    expect(row.metadata.buyerEmailSent).toBeUndefined();
    expect(row.metadata.hostNotified).toBeUndefined();
    expect(row.metadata.refund).toMatchObject({
      paymentId: "hackea-test-pay-194",
    });
    // The refunded payment stays recognisable for a pending refund alert.
    expect(row.metadata.refundedPaymentIds).toEqual(["hackea-test-pay-194"]);
    // The new purchase hasn't checked in.
    const usedAt = await db.execute<{ used_at: Date | null }>(
      sql`SELECT used_at FROM participations WHERE id = ${lead.participationId}`,
    );
    expect(usedAt.rows[0].used_at).toBeNull();

    // And it is paid again.
    const third = await createHackeaLead({
      name: N("reintegro vuelve"),
      phone: "+5491100000194",
      eventId: EVT_OPEN,
    });
    expect(third.paid).toBe(true);
  });

  it("a paid row set back to pending in the admin stays pending on a redelivery", async () => {
    const lead = await createHackeaLead({
      name: N("vuelta-pending"),
      phone: "+5491100000196",
      eventId: EVT_OPEN,
    });
    const args = {
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-196",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    };
    await confirmHackeaPayment(args);
    await db.execute(sql`
      UPDATE participations SET status = 'pending'
      WHERE id = ${lead.participationId}
    `);

    expect((await confirmHackeaPayment(args)).outcome).toBe("already");
    const row = await participation(lead.participationId);
    expect(row.status).toBe("pending");
    expect(row.external_payment_id).toBe("hackea-test-pay-196");
    expect(row.metadata.extraPaymentIds).toBeUndefined();
  });

  it("a resubmit after the payment landed sees confirmed and keeps the snapshot", async () => {
    const lead = await createHackeaLead({
      name: N("pagó"),
      phone: "+5491100000192",
      eventId: EVT_OPEN,
    });
    await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-192",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    const again = await createHackeaLead({
      name: N("pagó otra vez"),
      phone: "+5491100000192",
      email: E("pago-otra"),
      eventId: EVT_OPEN,
    });
    expect(again).toMatchObject({
      participationId: lead.participationId,
      status: "confirmed",
      created: false,
    });
    const res = await db.execute<{ contact: { name: string } }>(sql`
      SELECT metadata->'contact' AS contact FROM participations
      WHERE id = ${lead.participationId}
    `);
    expect(res.rows[0].contact.name).toBe(N("pagó"));
  });

  it("returns not_found for an unknown participation", async () => {
    const res = await confirmHackeaPayment({
      participationId: "HTM-NOPE0000",
      paymentId: "hackea-test-pay-x",
      amountCents: 1,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(res.outcome).toBe("not_found");
    expect(res.participant).toBeUndefined();
  });

  it("returns not_found for a participation of another event", async () => {
    const lead = await createHackeaLead({
      name: N("kari"),
      phone: "+5491100000111",
      eventId: EVT_OPEN,
    });
    const res = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-111",
      amountCents: 1,
      currency: "ARS",
      eventId: EVT_CAPPED,
    });
    expect(res.outcome).toBe("not_found");
    expect((await participation(lead.participationId)).status).toBe("pending");
  });

  it("keeps the overflow lead pending and records the payment id", async () => {
    const first = await createHackeaLead({
      name: N("lu"),
      phone: "+5491100000112",
      eventId: EVT_CAPPED,
    });
    const second = await createHackeaLead({
      name: N("mati"),
      phone: "+5491100000113",
      eventId: EVT_CAPPED,
    });
    const ok = await confirmHackeaPayment({
      participationId: first.participationId,
      paymentId: "hackea-test-pay-112",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_CAPPED,
    });
    expect(ok.outcome).toBe("confirmed");

    const over = await confirmHackeaPayment({
      participationId: second.participationId,
      paymentId: "hackea-test-pay-113",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_CAPPED,
    });
    expect(over.outcome).toBe("capacity");
    expect(over.participant?.name).toBe(N("mati"));
    const row = await participation(second.participationId);
    expect(row.status).toBe("pending");
    expect(row.external_payment_id).toBeNull();
    expect(row.metadata.overflowPaymentId).toBe("hackea-test-pay-113");
  });

  it("a refunded entrada in a full event repurchases into its own seat", async () => {
    // Capacity 1, filled by this very row. The webhook never cancels on a
    // refund, so the row is still `confirmed` when the repurchase lands —
    // the capacity count must not count it against itself.
    const lead = await createHackeaLead({
      name: N("lleno-reintegro"),
      phone: "+5491100000114",
      eventId: EVT_CAPPED,
    });
    const first = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-114",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_CAPPED,
    });
    expect(first.outcome).toBe("confirmed");
    await db.execute(sql`
      UPDATE participations SET
        metadata = metadata || jsonb_build_object(
          'refund', jsonb_build_object('status', 'refunded', 'paymentId', 'hackea-test-pay-114')
        )
      WHERE id = ${lead.participationId}
    `);
    expect((await participation(lead.participationId)).status).toBe("confirmed");

    const again = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-115",
      amountCents: 2_130_000,
      currency: "ARS",
      eventId: EVT_CAPPED,
    });
    expect(again.outcome).toBe("confirmed");
    const row = await participation(lead.participationId);
    expect(row.status).toBe("confirmed");
    expect(row.external_payment_id).toBe("hackea-test-pay-115");
    expect(row.metadata.overflowPaymentId).toBeUndefined();
  });
});

describe("markHackeaFlag", () => {
  it("merges flags without clobbering existing metadata", async () => {
    const lead = await createHackeaLead({
      name: N("nico"),
      phone: "+5491100000114",
      eventId: EVT_OPEN,
    });
    await db.execute(sql`
      UPDATE participations
      SET metadata = '{"keep":"me","buyerEmailSentSendingFor":"pay-1","hostNotifiedSendingFor":"pay-1"}'::jsonb
      WHERE id = ${lead.participationId}
    `);
    await markHackeaFlag(lead.participationId, "buyerEmailSent", "pay-1");
    await markHackeaFlag(lead.participationId, "hostNotified", "pay-1");
    const row = await participation(lead.participationId);
    expect(row.metadata).toMatchObject({
      keep: "me",
      buyerEmailSent: true,
      hostNotified: true,
    });
  });

  it("doesn't mark a flag whose claim belongs to another payment", async () => {
    const lead = await createHackeaLead({
      name: N("nico otro pago"),
      phone: "+5491100000115",
      eventId: EVT_OPEN,
    });
    await db.execute(sql`
      UPDATE participations
      SET metadata = '{"buyerEmailSent":"sending","buyerEmailSentSendingFor":"pay-new"}'::jsonb
      WHERE id = ${lead.participationId}
    `);
    await markHackeaFlag(lead.participationId, "buyerEmailSent", "pay-old");
    const row = await participation(lead.participationId);
    expect(row.metadata.buyerEmailSent).toBe("sending");
  });
});

// ============================================================
// Phone matching variants
// ============================================================

describe("findPersonIdByPhone variants", () => {
  async function phoneOnly(tag: string, phone: string) {
    const res = await recordParticipation({
      name: N(tag),
      phone,
      eventId: EVT_OPEN,
      participationId: `hackea-test-v-${tag}`,
      role: "attendee",
      status: "pending",
    });
    return res.personId;
  }

  it("matches +54 without the mobile 9", async () => {
    const id = await phoneOnly("v1", "+54 11 0000-0201");
    expect(await findPersonIdByPhone(db, "11 0000-0201")).toBe(id);
    expect(await findPersonIdByPhone(db, "+5491100000201")).toBe(id);
  });

  it("matches the 011 15 form in both directions", async () => {
    const stored15 = await phoneOnly("v2", "011 15 0000-0202");
    expect(await findPersonIdByPhone(db, "+54 9 11 0000-0202")).toBe(stored15);
    const storedIntl = await phoneOnly("v3", "+5491100000203");
    expect(await findPersonIdByPhone(db, "011 15 0000-0203")).toBe(storedIntl);
    expect(await findPersonIdByPhone(db, "011 0000-0203")).toBe(storedIntl);
  });

  it("matches on the raw digits as typed", async () => {
    const id = await phoneOnly("v4", "(11) 0000.0204");
    expect(await findPersonIdByPhone(db, "1100000204")).toBe(id);
  });

  it("does not match a different number", async () => {
    await phoneOnly("v5", "+54 9 11 0000-0205");
    expect(await findPersonIdByPhone(db, "11 0000-0206")).toBeNull();
    expect(await findPersonIdByPhone(db, "011 15 0000-0206")).toBeNull();
    expect(await findPersonIdByPhone(db, "+54 11 0000-0206")).toBeNull();
  });
});

// ============================================================
// Contact snapshot + per-event dedupe
// ============================================================

async function eventLeads(eventId: string) {
  const res = await db.execute<{ id: string; person_id: number }>(sql`
    SELECT id, person_id FROM participations WHERE event_id = ${eventId}
  `);
  return res.rows;
}

async function peopleNamed(prefix: string) {
  const res = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM people WHERE name LIKE ${`${prefix}%`}
  `);
  return Number(res.rows[0].n);
}

describe("createHackeaLead contact snapshot", () => {
  it("delivers to the typed WhatsApp, not a stale stored one, and dedupes on it", async () => {
    // Known by email from another flow, with an older number.
    await recordParticipation({
      email: E("olga"),
      name: N("olga"),
      phone: "+5491100000301",
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p-olga",
      role: "attendee",
      status: "pending",
    });
    const lead = await createHackeaLead({
      name: N("olga"),
      phone: "11 0000-0302",
      email: E("olga"),
      eventId: EVT_OPEN,
    });
    const row = await participation(lead.participationId);
    expect(row.metadata.contact).toEqual({
      name: N("olga"),
      phone: "+5491100000302",
      email: E("olga"),
    });
    // The person row keeps what the other flow stored.
    expect((await personById(Number(row.person_id))).phone).toBe("+5491100000301");

    const paid = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-302",
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(paid.participant?.phone).toBe("+5491100000302");

    // Same WhatsApp alone → the paid lead (caller answers 409), no new person.
    const again = await createHackeaLead({
      name: N("olga"),
      phone: "+54 9 11 0000-0302",
      eventId: EVT_OPEN,
    });
    expect(again.participationId).toBe(lead.participationId);
    expect(again.status).toBe("confirmed");
    expect(again.created).toBe(false);
    expect(await eventLeads(EVT_OPEN)).toHaveLength(1);
    expect(await peopleNamed(N("olga"))).toBe(1);
  });

  it("delivers to a typed email that belongs to another person row", async () => {
    await recordParticipation({
      name: N("pato"),
      phone: "+5491100000303",
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p-pato",
      role: "attendee",
      status: "pending",
    });
    await recordParticipation({
      email: E("pato-mail"),
      name: N("pato-mail"),
      eventId: EVT_CAPPED,
      participationId: "hackea-test-p-pato-mail",
      role: "attendee",
      status: "pending",
    });
    const lead = await createHackeaLead({
      name: N("pato"),
      phone: "+5491100000303",
      email: E("pato-mail"),
      eventId: EVT_OPEN,
    });
    const res = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-303",
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(res.participant).toEqual({
      id: lead.participationId,
      name: N("pato"),
      phone: "+5491100000303",
      email: E("pato-mail"),
    });
  });

  it("refreshes the snapshot when a pending lead is resubmitted", async () => {
    const a = await createHackeaLead({
      name: N("quique"),
      phone: "+5491100000304",
      eventId: EVT_OPEN,
    });
    const b = await createHackeaLead({
      name: N("quique-nuevo"),
      phone: "11 0000-0304",
      email: E("quique"),
      eventId: EVT_OPEN,
    });
    expect(b.participationId).toBe(a.participationId);
    expect((await participation(a.participationId)).metadata.contact).toEqual({
      name: N("quique-nuevo"),
      phone: "+5491100000304",
      email: E("quique"),
    });
  });

  it("dedupes on the email (case-insensitive) when the WhatsApp changed", async () => {
    const a = await createHackeaLead({
      name: N("rita"),
      phone: "+5491100000305",
      email: E("rita"),
      eventId: EVT_OPEN,
    });
    const b = await createHackeaLead({
      name: N("rita"),
      phone: "+5491100000306",
      email: "Hackea-Test-Rita@Example.com",
      eventId: EVT_OPEN,
    });
    expect(b.participationId).toBe(a.participationId);
    expect(await eventLeads(EVT_OPEN)).toHaveLength(1);
  });

  it("prefers the phone match over the email match", async () => {
    const byPhone = await createHackeaLead({
      name: N("sofi"),
      phone: "+5491100000307",
      eventId: EVT_OPEN,
    });
    await createHackeaLead({
      name: N("sofi-mail"),
      phone: "+5491100000308",
      email: E("sofi"),
      eventId: EVT_OPEN,
    });
    const c = await createHackeaLead({
      name: N("sofi"),
      phone: "+5491100000307",
      email: E("sofi"),
      eventId: EVT_OPEN,
    });
    expect(c.participationId).toBe(byPhone.participationId);
  });

  it("serializes concurrent submits for one new number", async () => {
    // Open several pool connections first; otherwise the second call waits
    // on a fresh websocket handshake and the race never actually happens.
    await Promise.all(
      Array.from({ length: 4 }, () =>
        db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_sleep(0.2)`);
        }),
      ),
    );
    const [a, b] = await Promise.all([
      createHackeaLead({
        name: N("tomi"),
        phone: "+5491100000309",
        email: E("tomi"),
        eventId: EVT_OPEN,
      }),
      createHackeaLead({
        name: N("tomi"),
        phone: "11 0000-0309",
        eventId: EVT_OPEN,
      }),
    ]);
    expect(a.participationId).toBe(b.participationId);
    expect(await eventLeads(EVT_OPEN)).toHaveLength(1);
    expect(await peopleNamed(N("tomi"))).toBe(1);
  });
});

describe("confirmHackeaPayment extra payments", () => {
  it("records a second distinct payment once, without overwriting the first", async () => {
    const lead = await createHackeaLead({
      name: N("uma"),
      phone: "+5491100000310",
      eventId: EVT_OPEN,
    });
    const base = {
      participationId: lead.participationId,
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    };
    await confirmHackeaPayment({ ...base, paymentId: "hackea-test-pay-310a" });
    const second = await confirmHackeaPayment({
      ...base,
      paymentId: "hackea-test-pay-310b",
    });
    expect(second.outcome).toBe("already");
    await confirmHackeaPayment({ ...base, paymentId: "hackea-test-pay-310b" });
    const row = await participation(lead.participationId);
    expect(row.external_payment_id).toBe("hackea-test-pay-310a");
    expect(row.metadata.extraPaymentIds).toEqual(["hackea-test-pay-310b"]);
  });

  it("flags an underpaid confirmation", async () => {
    const lead = await createHackeaLead({
      name: N("vale"),
      phone: "+5491100000311",
      eventId: EVT_OPEN,
    });
    const low = await confirmHackeaPayment({
      participationId: lead.participationId,
      paymentId: "hackea-test-pay-311",
      amountCents: 100,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(low.outcome).toBe("confirmed");
    expect(low.underpaid).toBe(true);

    const lead2 = await createHackeaLead({
      name: N("walter"),
      phone: "+5491100000312",
      eventId: EVT_OPEN,
    });
    const full = await confirmHackeaPayment({
      participationId: lead2.participationId,
      paymentId: "hackea-test-pay-312",
      amountCents: hackeaConfig.ticketPriceCents,
      currency: "ARS",
      eventId: EVT_OPEN,
    });
    expect(full.underpaid).toBe(false);
  });
});
