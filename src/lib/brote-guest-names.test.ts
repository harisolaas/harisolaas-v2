import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  applyGuestNames,
  MAX_GUEST_NAME,
  normalizeGuestName,
  ticketsForPayment,
} from "./brote-guest-names";

const EVENT = "test-evt-guest-names";
const PAYMENT = "MP-GUEST-1";
const OTHER_PAYMENT = "MP-GUEST-OTHER";
const EMAIL = "test-guest-names@example.com";

async function cleanup() {
  await db.execute(sql`DELETE FROM participations WHERE event_id = ${EVENT}`);
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
  await db.execute(
    sql`DELETE FROM people WHERE email LIKE 'test-guest-names%@example.com'`,
  );
}

let personId = 0;

beforeAll(async () => {
  await cleanup();
  await db.insert(schema.events).values({
    id: EVENT,
    type: "brote",
    name: "Test guest names",
    date: new Date("2027-01-01T00:00:00Z"),
    status: "upcoming",
  });
  const [person] = await db
    .insert(schema.people)
    .values({ email: EMAIL, name: "Ana" })
    .returning();
  personId = person.id;
});

afterAll(cleanup);

beforeEach(async () => {
  await db.execute(sql`DELETE FROM participations WHERE event_id = ${EVENT}`);
  // One purchase of three, plus a ticket from a DIFFERENT payment that must
  // never be reachable from this one.
  await db.insert(schema.participations).values([
    {
      id: "GN-PRIMARY",
      personId,
      eventId: EVENT,
      role: "attendee",
      status: "confirmed",
      externalPaymentId: PAYMENT,
    },
    {
      id: "GN-COMP-A",
      personId,
      eventId: EVENT,
      role: "companion",
      status: "confirmed",
      externalPaymentId: PAYMENT,
    },
    {
      id: "GN-COMP-B",
      personId,
      eventId: EVENT,
      role: "companion",
      status: "confirmed",
      externalPaymentId: PAYMENT,
    },
    {
      id: "GN-OTHER",
      personId,
      eventId: EVENT,
      role: "companion",
      status: "confirmed",
      externalPaymentId: OTHER_PAYMENT,
      metadata: { guestName: "Untouched" },
    },
  ]);
});

async function guestNameOf(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ metadata: schema.participations.metadata })
    .from(schema.participations)
    .where(eq(schema.participations.id, id));
  return (row?.metadata as { guestName?: string })?.guestName;
}

describe("normalizeGuestName", () => {
  it.each([
    ["  Cami Ruiz  ", "Cami Ruiz"],
    ["", ""],
    ["   ", ""],
    [null, ""],
    [undefined, ""],
    [42, ""],
    [{}, ""],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeGuestName(input)).toBe(expected);
  });

  it("caps a very long name instead of letting it reach the column", () => {
    expect(normalizeGuestName("x".repeat(500))).toHaveLength(MAX_GUEST_NAME);
  });
});

describe("ticketsForPayment", () => {
  it("T5.1 — returns the whole purchase, buyer's own ticket first", async () => {
    const tickets = await ticketsForPayment(PAYMENT);
    expect(tickets.map((t) => t.id)).toEqual([
      "GN-PRIMARY",
      "GN-COMP-A",
      "GN-COMP-B",
    ]);
  });

  it("returns nothing for a blank payment id rather than the whole table", async () => {
    expect(await ticketsForPayment("")).toEqual([]);
  });
});

describe("applyGuestNames", () => {
  it("T5.2 — writes each name onto the right ticket, positionally", async () => {
    const written = await applyGuestNames(PAYMENT, ["Ana", "Cami", "Jo"]);
    expect(written).toBe(3);
    expect(await guestNameOf("GN-PRIMARY")).toBe("Ana");
    expect(await guestNameOf("GN-COMP-A")).toBe("Cami");
    expect(await guestNameOf("GN-COMP-B")).toBe("Jo");
  });

  it("T5.3 — cannot reach a ticket belonging to another payment", async () => {
    // The ids are resolved server-side from the payment; nothing in the
    // request body picks a row. This is the whole authorization story for
    // the endpoint, so it gets a test rather than a comment.
    await applyGuestNames(PAYMENT, ["Ana", "Cami", "Jo", "Hacker"]);
    expect(await guestNameOf("GN-OTHER")).toBe("Untouched");
  });

  it("T5.4 — an empty slot leaves that ticket alone instead of clearing it", async () => {
    // The form submits every field every time. Someone who names two of
    // three and comes back to fill the third must not wipe the first two.
    await applyGuestNames(PAYMENT, ["Ana", "Cami", ""]);
    await applyGuestNames(PAYMENT, ["", "", "Jo"]);
    expect(await guestNameOf("GN-PRIMARY")).toBe("Ana");
    expect(await guestNameOf("GN-COMP-A")).toBe("Cami");
    expect(await guestNameOf("GN-COMP-B")).toBe("Jo");
  });

  it("T5.5 — does not clobber sibling metadata", async () => {
    await db
      .update(schema.participations)
      .set({ metadata: { emailSent: true, invite: "pulso" } })
      .where(eq(schema.participations.id, "GN-PRIMARY"));

    await applyGuestNames(PAYMENT, ["Ana"]);

    const [row] = await db
      .select({ metadata: schema.participations.metadata })
      .from(schema.participations)
      .where(eq(schema.participations.id, "GN-PRIMARY"));
    // `invite` especially: losing it stops the collaborator being paid.
    expect(row.metadata).toMatchObject({
      guestName: "Ana",
      emailSent: true,
      invite: "pulso",
    });
  });

  it("T5.6 — more names than tickets writes only what exists", async () => {
    const written = await applyGuestNames(PAYMENT, ["A", "B", "C", "D", "E"]);
    expect(written).toBe(3);
  });
});
