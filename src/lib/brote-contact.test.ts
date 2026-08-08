import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  applyBroteContactConfirmation,
  isUniqueViolation,
} from "./brote-contact";

// DB-backed against the dev Neon branch (serialized by vitest.config.ts).
// A synthetic event is used rather than BROTE_EVENT_ID: the real event row
// doesn't exist on the dev branch, and inserting it into a shared DB is not
// something a test file gets to do.
const EVENT = "test-evt-contact";
const OTHER_EVENT = "test-evt-contact-other";
const PREFIX = "test-contact-";

const TICKET = "TEST-CONTACT-1";
const MP_EMAIL = `${PREFIX}mp@example.com`;
const NEW_EMAIL = `${PREFIX}confirmed@example.com`;

async function cleanup() {
  await db.execute(
    sql`DELETE FROM participations WHERE event_id IN (${EVENT}, ${OTHER_EVENT})`,
  );
  await db.execute(
    sql`DELETE FROM events WHERE id IN (${EVENT}, ${OTHER_EVENT})`,
  );
  await db.execute(
    sql`DELETE FROM people WHERE email LIKE ${PREFIX + "%@example.com"}`,
  );
}

/** Seed one BROTE-like ticket bought with `mpEmail`, as the webhook leaves it. */
async function seedTicket(opts: {
  ticketId?: string;
  mpEmail?: string;
  name?: string;
  phone?: string | null;
  eventId?: string;
  metadata?: Record<string, unknown>;
}) {
  const [person] = await db
    .insert(schema.people)
    .values({
      email: opts.mpEmail ?? MP_EMAIL,
      name: opts.name ?? "Asistente",
      phone: opts.phone ?? null,
    })
    .returning();
  await db.insert(schema.participations).values({
    id: opts.ticketId ?? TICKET,
    personId: person.id,
    eventId: opts.eventId ?? EVENT,
    role: "attendee",
    status: "confirmed",
    externalPaymentId: "MP-TEST-1",
    metadata: opts.metadata ?? { emailSent: true },
  });
  return person;
}

async function loadTicket(ticketId = TICKET) {
  const [row] = await db
    .select({
      personId: schema.participations.personId,
      metadata: schema.participations.metadata,
      email: schema.people.email,
      name: schema.people.name,
      phone: schema.people.phone,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.id, ticketId));
  return row;
}

const confirm = {
  name: "Ana Pérez",
  email: NEW_EMAIL,
  phone: "+54 9 11 5555 1234",
};

beforeAll(async () => {
  await cleanup();
  await db.insert(schema.events).values([
    {
      id: EVENT,
      type: "brote",
      name: "Test contact",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    },
    {
      id: OTHER_EVENT,
      type: "brote",
      name: "Test contact other",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    },
  ]);
});

afterAll(cleanup);

beforeEach(async () => {
  await db.execute(
    sql`DELETE FROM participations WHERE event_id IN (${EVENT}, ${OTHER_EVENT})`,
  );
  await db.execute(
    sql`DELETE FROM people WHERE email LIKE ${PREFIX + "%@example.com"}`,
  );
});

describe("isUniqueViolation", () => {
  it("sees through drizzle's error wrapper", async () => {
    // Staged against the real driver rather than a hand-built object,
    // because the wrapping is exactly what fooled the first implementation:
    // DrizzleQueryError's own `code` is undefined and the pg code lives on
    // `cause`. If a driver upgrade moves it again, this fails here instead
    // of silently turning the race handler back into dead code.
    let caught: unknown;
    const dupe = `${PREFIX}dupe@example.com`;
    try {
      await db.execute(
        sql`INSERT INTO people (email, name) VALUES (${dupe},'a'),(${dupe},'b')`,
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string }).code).toBeUndefined();
    expect(isUniqueViolation(caught)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("applyBroteContactConfirmation", () => {
  it("returns not_found for an unknown participation", async () => {
    const res = await applyBroteContactConfirmation({
      participationId: "NOPE",
      eventId: EVENT,
      ...confirm,
    });
    expect(res.outcome).toBe("not_found");
  });

  it("keeps the same person when the confirmed email matches MP's", async () => {
    await seedTicket({ mpEmail: NEW_EMAIL });
    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    if (res.outcome !== "applied") return;
    expect(res.emailChanged).toBe(false);
    // Already emailed and nothing changed — no reason to send again.
    expect(res.shouldResend).toBe(false);

    const row = await loadTicket();
    expect(row.email).toBe(NEW_EMAIL);
    // Confirmation overwrites the phone: the person just typed it. This
    // deliberately diverges from recordParticipation's sticky COALESCE.
    expect(row.phone).toBe(confirm.phone);
    // "Asistente" is the documented placeholder, so a real name replaces it.
    expect(row.name).toBe("Ana Pérez");
  });

  it("overwrites an existing phone rather than keeping the stored one", async () => {
    // The divergence from recordParticipation's sticky
    // `COALESCE(people.phone, EXCLUDED.phone)` is deliberate: the person
    // just typed this number on the confirmation form, so it wins. Every
    // other fixture seeds phone=null, where sticky and overwrite look
    // identical — this is the case that tells them apart.
    await seedTicket({ mpEmail: NEW_EMAIL, phone: "+5491100000000" });
    await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });
    expect((await loadTicket()).phone).toBe(confirm.phone);
  });

  it("does not clobber a real name that MercadoPago already gave us", async () => {
    // Only the "Asistente" placeholder is overwritable. A real name is
    // sticky, same rule as the upserts in community.ts — otherwise a typo
    // in the confirmation form destroys the name on the door list.
    await seedTicket({ mpEmail: NEW_EMAIL, name: "María González" });
    await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
      name: "asdf",
    });
    expect((await loadTicket()).name).toBe("María González");
  });

  it("moves the canonical email to the confirmed one and flags MP's", async () => {
    await seedTicket({});
    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    if (res.outcome !== "applied") return;
    expect(res.emailChanged).toBe(true);
    expect(res.shouldResend).toBe(true);
    expect(res.to).toBe(NEW_EMAIL);

    const row = await loadTicket();
    expect(row.email).toBe(NEW_EMAIL);
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.contact).toMatchObject({
      email: NEW_EMAIL,
      phone: confirm.phone,
      name: "Ana Pérez",
    });
    // The owner's rule: keep both, and mark which one came from MercadoPago.
    expect(meta.mpPayer).toMatchObject({
      email: MP_EMAIL,
      source: "mercadopago",
    });
    // Sibling metadata survives the jsonb merge.
    expect(meta.emailSent).toBe(true);
  });

  it("re-points the ticket when the confirmed email already has a person", async () => {
    await seedTicket({});
    // Same human, already in the DB from some other touchpoint.
    const [existing] = await db
      .insert(schema.people)
      .values({ email: NEW_EMAIL, name: "Ana", phone: null })
      .returning();

    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    const row = await loadTicket();
    expect(row.personId).toBe(existing.id);
    expect(row.email).toBe(NEW_EMAIL);
    expect(row.phone).toBe(confirm.phone);

    // The MP-email person stays as a lead — nothing is destroyed.
    const [leftBehind] = await db
      .select({ id: schema.people.id })
      .from(schema.people)
      .where(sql`${schema.people.email} = ${MP_EMAIL}`);
    expect(leftBehind).toBeDefined();
  });

  it("normalizes the confirmed email before looking anyone up", async () => {
    // `isValidEmail` trims before testing but passes the raw string
    // through, so " Ana@X.com " reaches this function verbatim. If the
    // lookup uses the raw value while the write uses the normalized one,
    // they disagree: the existing person isn't found, the rename fires,
    // and it dies on the unique index instead of re-pointing.
    await seedTicket({});
    const [existing] = await db
      .insert(schema.people)
      .values({ email: NEW_EMAIL, name: "Ana", phone: null })
      .returning();

    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
      email: `  ${NEW_EMAIL.toUpperCase()}  `,
    });

    expect(res.outcome).toBe("applied");
    const row = await loadTicket();
    expect(row.personId).toBe(existing.id);
    expect(row.email).toBe(NEW_EMAIL);
  });

  it("re-points across events without tripping the person/event unique", async () => {
    // The target person has a participation, but in a DIFFERENT event —
    // that must not read as a collision.
    await seedTicket({});
    const [existing] = await db
      .insert(schema.people)
      .values({ email: NEW_EMAIL, name: "Ana", phone: null })
      .returning();
    await db.insert(schema.participations).values({
      id: "TEST-CONTACT-OTHER-EVT",
      personId: existing.id,
      eventId: OTHER_EVENT,
      role: "attendee",
      status: "confirmed",
    });

    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    expect((await loadTicket()).personId).toBe(existing.id);
  });

  it("refuses when the confirmed email already holds a ticket for this event", async () => {
    await seedTicket({});
    const [existing] = await db
      .insert(schema.people)
      .values({ email: NEW_EMAIL, name: "Otra", phone: "+5491199999999" })
      .returning();
    await db.insert(schema.participations).values({
      id: "TEST-CONTACT-2",
      personId: existing.id,
      eventId: EVENT,
      role: "attendee",
      status: "confirmed",
    });

    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("email_taken");

    // Nothing may have been mutated on the way to the refusal.
    const row = await loadTicket();
    expect(row.email).toBe(MP_EMAIL);
    expect(row.phone).toBeNull();
    expect((row.metadata as Record<string, unknown>).contact).toBeUndefined();
    const [other] = await db
      .select({ phone: schema.people.phone, name: schema.people.name })
      .from(schema.people)
      .where(eq(schema.people.id, existing.id));
    expect(other.phone).toBe("+5491199999999");
    expect(other.name).toBe("Otra");
  });

  it("survives a resubmit without corrupting the MP-payer record", async () => {
    // Double submit is the realistic version of the concurrency hazard: on
    // the second pass the person already carries the confirmed email, so
    // `emailChanged` is false. mpPayer must keep MercadoPago's address —
    // if the second pass rewrote it, the only record of what MP gave us
    // would be destroyed, and it would claim MP sent the confirmed one.
    await seedTicket({});
    const first = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });
    const second = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("applied");
    if (second.outcome !== "applied") return;
    expect(second.emailChanged).toBe(false);

    const meta = (await loadTicket()).metadata as Record<string, unknown>;
    expect(meta.mpPayer).toMatchObject({ email: MP_EMAIL });
    // One send, not two: nothing changed on the second pass.
    expect(meta.contactResendCount).toBe(1);
  });

  it("stops resending after the cap, but still records the contact", async () => {
    await seedTicket({ metadata: { emailSent: true, contactResendCount: 3 } });
    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    if (res.outcome !== "applied") return;
    expect(res.shouldResend).toBe(false);

    // The data is still saved — the cap only throttles mail.
    const row = await loadTicket();
    expect(row.email).toBe(NEW_EMAIL);
    expect((row.metadata as Record<string, unknown>).contact).toMatchObject({
      email: NEW_EMAIL,
    });
  });

  it("sends when the ticket exists but was never emailed, even unchanged", async () => {
    await seedTicket({ mpEmail: NEW_EMAIL, metadata: {} });
    const res = await applyBroteContactConfirmation({
      participationId: TICKET,
      eventId: EVENT,
      ...confirm,
    });

    expect(res.outcome).toBe("applied");
    if (res.outcome !== "applied") return;
    expect(res.emailChanged).toBe(false);
    expect(res.shouldResend).toBe(true);
  });
});
