import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BROTE_EVENT_ID } from "@/data/brote";
import { getRedis } from "@/lib/redis";
import {
  confirmTicketKey,
  pendingContactKey,
} from "@/lib/brote-confirm-token";

// The ticket email is mocked out: .env.local carries a real RESEND_API_KEY
// and the production sender address, so an unmocked path here mails real
// people. Redis is the in-memory mock (forced in vitest.config.ts).
const sendSpy = vi.fn(async () => ({ resendId: "resend-test" }));
const markSpy = vi.fn(async () => {});
vi.mock("@/lib/brote-ticket-email", () => ({
  sendBroteTicketEmail: (...args: unknown[]) => sendSpy(...(args as [])),
  markBroteTicketEmailSent: (...args: unknown[]) => markSpy(...(args as [])),
}));

const { GET, POST } = await import("./route");

const VALID_TOKEN = "abcdefghijklmnopqrstu"; // nanoid(21) shape

function post(body: unknown, ip = "1.2.3.4") {
  return POST(
    new Request("http://localhost/api/brote/confirm-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const valid = {
  token: VALID_TOKEN,
  name: "Ana",
  email: "confirm-route@example.com",
  phone: "+54 9 11 2255 5110",
};

afterEach(async () => {
  const redis = await getRedis();
  await redis.del(pendingContactKey(VALID_TOKEN));
  await redis.del(confirmTicketKey(VALID_TOKEN));
  sendSpy.mockClear();
});

async function countParticipations(): Promise<number> {
  const res = await db.select({ n: count() }).from(schema.participations);
  return Number(res[0]?.n ?? 0);
}

describe("POST /api/brote/confirm-contact", () => {
  it("parks the contact and issues NO ticket when the webhook hasn't landed", async () => {
    // The load-bearing invariant: a ticket only ever comes from an approved
    // payment in the webhook. This endpoint must never mint one, however
    // valid the contact is — otherwise someone who abandons a cash payment
    // walks in with a QR.
    const before = await countParticipations();
    const res = await post(valid);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.outcome).toBe("pending");
    expect(await countParticipations()).toBe(before);
    expect(sendSpy).not.toHaveBeenCalled();

    const redis = await getRedis();
    const parked = await redis.get(pendingContactKey(VALID_TOKEN));
    expect(JSON.parse(parked!)).toMatchObject({
      email: valid.email,
      phone: valid.phone,
      name: "Ana",
    });
  });

  // The rate limiter is module-level state shared across the whole file, so
  // each case gets its own IP — otherwise a later test reads 429 where it
  // expected a validation code, and the assertion is about the wrong thing.
  it("rejects a malformed token before it reaches Redis", async () => {
    const tokens = ["", "short", "has spaces here!!", "../../etc/passwd"];
    for (const [i, token] of tokens.entries()) {
      const res = await post({ ...valid, token }, `10.0.1.${i}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_token");
    }
  });

  it("rejects invalid contact fields", async () => {
    const cases = [
      { ...valid, name: "" },
      { ...valid, email: "nope" },
      { ...valid, phone: "12" },
    ];
    for (const [i, body] of cases.entries()) {
      const res = await post(body, `10.0.2.${i}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("invalid_fields");
    }
  });

  it("rate limits per IP", async () => {
    const ip = "9.9.9.9";
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await post(valid, ip)).status);
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });
});

// The route's resend sink only runs when `brote:confirm:{ct}` resolves to a
// real participation. Without a case that seeds it, deleting the whole
// `if (result.shouldResend)` block leaves the suite green — and that block
// IS the feature. It needs the real BROTE event row, so this block creates
// and removes it rather than borrowing a synthetic one.
describe("POST with an existing ticket", () => {
  const TICKET = "TEST-CONFIRM-ROUTE-1";
  const MP_EMAIL = "confirm-route-mp@example.com";
  const CONFIRMED = "confirm-route-new@example.com";
  let createdEvent = false;

  async function scrub() {
    await db.execute(sql`DELETE FROM participations WHERE id = ${TICKET}`);
    await db.execute(
      sql`DELETE FROM people WHERE email IN (${MP_EMAIL}, ${CONFIRMED})`,
    );
  }

  beforeAll(async () => {
    await scrub();
    const existing = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.id, BROTE_EVENT_ID));
    if (existing.length === 0) {
      await db.insert(schema.events).values({
        id: BROTE_EVENT_ID,
        type: "brote",
        name: "Test BROTE (confirm-contact)",
        date: new Date("2027-01-01T00:00:00Z"),
        status: "upcoming",
      });
      createdEvent = true;
    }
  });

  afterAll(async () => {
    await scrub();
    if (createdEvent) {
      await db.execute(sql`DELETE FROM events WHERE id = ${BROTE_EVENT_ID}`);
    }
  });

  it("resends the ticket to the confirmed address when the email changes", async () => {
    const [person] = await db
      .insert(schema.people)
      .values({ email: MP_EMAIL, name: "Asistente" })
      .returning();
    await db.insert(schema.participations).values({
      id: TICKET,
      personId: person.id,
      eventId: BROTE_EVENT_ID,
      role: "attendee",
      status: "confirmed",
      externalPaymentId: "MP-CONFIRM-ROUTE",
      metadata: { emailSent: true },
    });
    const redis = await getRedis();
    await redis.set(confirmTicketKey(VALID_TOKEN), TICKET);

    const res = await post(
      { ...valid, email: CONFIRMED, name: "Ana" },
      "10.0.9.1",
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.outcome).toBe("applied");
    expect(data.emailChanged).toBe(true);
    expect(data.resent).toBe(true);

    // The mock really intercepts, and the ticket went to the NEW address.
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0]).toMatchObject({
      ticketId: TICKET,
      to: CONFIRMED,
    });
    expect(markSpy).toHaveBeenCalledWith(TICKET);
  });
});

describe("GET /api/brote/confirm-contact", () => {
  it("reports not-found rather than erroring before the webhook lands", async () => {
    const res = await GET(
      new Request(
        `http://localhost/api/brote/confirm-contact?token=${VALID_TOKEN}`,
      ),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).found).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const res = await GET(
      new Request("http://localhost/api/brote/confirm-contact?token=x"),
    );
    expect(res.status).toBe(400);
  });
});
