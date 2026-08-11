import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { BROTE_EVENT_ID } from "@/data/brote";
import { POST } from "./route";

/**
 * The door.
 *
 * This route had no test file at all, which meant the guest-name change
 * could be reverted wholesale without anything going red. It hits the real
 * dev Neon branch and needs the real BROTE event id, since the route
 * refuses tickets from other editions.
 */

const PAYER = "test-validate-payer@example.com";
const TICKET_NAMED = "TEST-VALIDATE-NAMED";
const TICKET_UNNAMED = "TEST-VALIDATE-UNNAMED";
let createdEvent = false;

async function scrub() {
  await db.execute(
    sql`DELETE FROM participations WHERE id IN (${TICKET_NAMED}, ${TICKET_UNNAMED})`,
  );
  await db.execute(sql`DELETE FROM people WHERE email = ${PAYER}`);
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
      name: "Test BROTE (validate)",
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

beforeEach(async () => {
  await db.execute(
    sql`DELETE FROM participations WHERE id IN (${TICKET_NAMED}, ${TICKET_UNNAMED})`,
  );
  await db.execute(sql`DELETE FROM people WHERE email = ${PAYER}`);
  const [person] = await db
    .insert(schema.people)
    .values({ email: PAYER, name: "Tina Ferrari" })
    .returning();
  await db.insert(schema.participations).values([
    {
      id: TICKET_NAMED,
      personId: person.id,
      eventId: BROTE_EVENT_ID,
      role: "companion",
      status: "confirmed",
      metadata: { guestName: "Marce Quiroga", seq: 0 },
    },
    {
      id: TICKET_UNNAMED,
      personId: person.id,
      eventId: BROTE_EVENT_ID,
      role: "companion",
      status: "confirmed",
      metadata: { seq: 1 },
    },
  ]);
});

function check(ticketId: string, action = "check") {
  return POST(
    new Request("http://localhost/api/brote/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, action }),
    }),
  );
}

describe("POST /api/brote/validate — whose ticket is this", () => {
  it("T5.9 — shows the GUEST's name when the ticket has one", async () => {
    // One buyer can hold several tickets. Showing the payer on every scan
    // means three people arrive and the door reads the same name three
    // times, which is exactly what naming them was for.
    const res = await check(TICKET_NAMED);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.ticket.buyerName).toBe("Marce Quiroga");
  });

  it("T5.10 — falls back to the buyer's name when there is none", async () => {
    const res = await check(TICKET_UNNAMED);
    const data = await res.json();
    expect(data.ticket.buyerName).toBe("Tina Ferrari");
  });

  it("T5.11 — the name survives into the `use` response too", async () => {
    // Three response shapes carry `buyerName`; the door renders whichever
    // comes back from the action it just performed.
    const res = await check(TICKET_NAMED, "use");
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.ticket.buyerName).toBe("Marce Quiroga");
  });

  it("still answers not_found for an unknown ticket (pin)", async () => {
    const res = await check("TEST-VALIDATE-NOPE");
    expect((await res.json()).error).toBe("not_found");
  });
});
