import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";
import { db, schema } from "@/db";
import {
  markBroteTicketEmailSent,
  sendBroteTicketEmail,
  type TicketEmailSender,
} from "./brote-ticket-email";

// The DB-backed half hits the dev Neon branch (serialized by
// vitest.config.ts). The send half never touches the network: the Resend
// client is injected, mirroring `bulk-email.ts`.

const TEST_EVENT = "test-evt-ticket-email";
const TEST_TICKET = "TEST-TICKET-EMAIL-1";
const TEST_EMAIL = "test-ticket-email-1@example.com";

function makeSender(
  impl: (payload: CreateEmailOptions) => CreateEmailResponse,
): TicketEmailSender & { calls: CreateEmailOptions[] } {
  const calls: CreateEmailOptions[] = [];
  return {
    calls,
    emails: {
      async send(payload) {
        calls.push(payload);
        return impl(payload);
      },
    },
  };
}

const ok = (id = "resend-msg-1"): CreateEmailResponse =>
  ({ data: { id }, error: null, headers: null } as unknown as CreateEmailResponse);

const apiError = (): CreateEmailResponse =>
  ({
    data: null,
    error: {
      name: "rate_limit_exceeded",
      message: "Too many requests",
      statusCode: 429,
    },
    headers: null,
  } as unknown as CreateEmailResponse);

const ambiguous = (): CreateEmailResponse =>
  ({ data: null, error: null, headers: null } as unknown as CreateEmailResponse);

const params = {
  ticketId: TEST_TICKET,
  to: "buyer@example.com",
  buyerName: "Ana",
  paymentId: "MP-123",
  treeNumber: 42,
};

describe("sendBroteTicketEmail", () => {
  it("sends to the requested address with the QR attached inline", async () => {
    const sender = makeSender(() => ok());
    const result = await sendBroteTicketEmail(params, sender);

    expect(sender.calls).toHaveLength(1);
    const payload = sender.calls[0];
    expect(payload.to).toBe("buyer@example.com");
    expect(payload.subject).toContain("42");
    expect(payload.from).toContain("BROTE <");

    const attachment = payload.attachments?.[0];
    expect(attachment?.contentId).toBe("qr");
    expect(attachment?.contentType).toBe("image/png");
    expect(result.resendId).toBe("resend-msg-1");
  });

  it("encodes the gate URL for this exact ticket in the QR", async () => {
    // The QR is the only thing standing between a buyer and the door. If the
    // ticket id stops being interpolated correctly the email still looks
    // perfect, so pin the decoded payload rather than 'an attachment exists'.
    const sender = makeSender(() => ok());
    await sendBroteTicketEmail(params, sender);

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
    const expected = await QRCode.toDataURL(
      `${baseUrl}/es/brote/gate?ticket=${TEST_TICKET}`,
      { width: 300, margin: 2, color: { dark: "#2D4A3E", light: "#FAF6F1" } },
    );
    const expectedBuffer = Buffer.from(expected.split(",")[1], "base64");

    const actual = sender.calls[0].attachments?.[0].content;
    expect(Buffer.isBuffer(actual)).toBe(true);
    expect((actual as Buffer).equals(expectedBuffer)).toBe(true);
  });

  it("throws on a non-throwing Resend API error instead of reporting success", async () => {
    // Regression guard for the 2026-04-19 class of incident (see
    // bulk-email.ts): the SDK returns {data:null,error} rather than
    // throwing, so a naive try/catch marks an undelivered ticket as sent.
    const sender = makeSender(() => apiError());
    await expect(sendBroteTicketEmail(params, sender)).rejects.toThrow(
      /rate_limit_exceeded|429/,
    );
  });

  it("throws on an ambiguous {data:null,error:null} response", async () => {
    // The other door into the same failure: no error to inspect, but no
    // message id either. Returning success here lets the caller stamp
    // `emailSent` on a ticket that was never accepted, which in the webhook
    // also kills MP's retry. `bulk-email.ts` already treats this as failure.
    const sender = makeSender(() => ambiguous());
    await expect(sendBroteTicketEmail(params, sender)).rejects.toThrow(
      /neither data nor error/,
    );
  });

  it("propagates a thrown transport error to the caller", async () => {
    const sender: TicketEmailSender = {
      emails: {
        async send() {
          throw new Error("socket hang up");
        },
      },
    };
    await expect(sendBroteTicketEmail(params, sender)).rejects.toThrow(
      "socket hang up",
    );
  });
});

describe("markBroteTicketEmailSent", () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(schema.events).values({
      id: TEST_EVENT,
      type: "brote",
      name: "Test ticket email",
      date: new Date("2027-01-01T00:00:00Z"),
      status: "upcoming",
    });
    const [person] = await db
      .insert(schema.people)
      .values({ email: TEST_EMAIL, name: "Ana" })
      .returning();
    await db.insert(schema.participations).values({
      id: TEST_TICKET,
      personId: person.id,
      eventId: TEST_EVENT,
      role: "attendee",
      status: "confirmed",
      // Pre-existing siblings that the flag write must not clobber.
      metadata: { coffeeRedeemed: true, contact: { phone: "+5491111" } },
    });
  });

  afterAll(cleanup);

  it("merges the flag without dropping sibling metadata keys", async () => {
    // The extraction replaces the webhook's defensive
    // `{...participationMetadata, emailSent:true}` spread with a plain
    // `{emailSent:true}`, betting that the jsonb `||` merge preserves
    // siblings. If that bet is wrong, every ticket loses coffeeRedeemed and
    // (post-U2) its confirmed contact. This is that bet, asserted.
    await markBroteTicketEmailSent(TEST_TICKET);

    const [row] = await db
      .select({ metadata: schema.participations.metadata })
      .from(schema.participations)
      .where(eq(schema.participations.id, TEST_TICKET));

    expect(row.metadata).toMatchObject({
      emailSent: true,
      coffeeRedeemed: true,
      contact: { phone: "+5491111" },
    });
  });
});

async function cleanup() {
  await db.execute(
    sql`DELETE FROM participations WHERE event_id = ${TEST_EVENT}`,
  );
  await db.execute(sql`DELETE FROM events WHERE id = ${TEST_EVENT}`);
  await db.execute(sql`DELETE FROM people WHERE email = ${TEST_EMAIL}`);
}
