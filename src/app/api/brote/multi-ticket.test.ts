import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

/**
 * The webhook issuing N tickets for one payment.
 *
 * Everything is mocked: no DB, no Redis, no MercadoPago, no Resend.
 *
 * These requests are SIGNED, unlike the older webhook tests. Those pass only
 * because CI never sets `MP_WEBHOOK_SECRET`, so `verifySignature` returns
 * true on the `if (!secret)` branch — i.e. the repo's webhook coverage
 * currently depends on a fail-open bug that is on the backlog to fix. Fixing
 * it would red those tests; it will not red these.
 */

const SECRET = "test-webhook-secret";
vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);

// ── Redis fake ───────────────────────────────────────────────────────
const redisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  getRedis: async () => ({
    get: async (k: string) => redisStore.get(k) ?? null,
    set: async (k: string, v: string) => {
      redisStore.set(k, v);
      return "OK";
    },
    del: async (k: string) => {
      redisStore.delete(k);
      return 1;
    },
  }),
}));

// ── MercadoPago ──────────────────────────────────────────────────────
const paymentGet = vi.fn();
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = vi.fn();
  },
  Payment: class {
    get = paymentGet;
  },
}));

// ── Drizzle ──────────────────────────────────────────────────────────
let dbNext: unknown[] = [];
function makeChain() {
  const c: Record<string, unknown> = {};
  for (const m of [
    "select", "from", "innerJoin", "leftJoin", "where", "limit",
    "orderBy", "groupBy", "update", "set", "insert", "values", "returning",
  ]) {
    c[m] = () => c;
  }
  c.then = (res: (v: unknown[]) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(dbNext).then(res, rej);
  return c;
}
vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return { db: makeChain(), schema };
});

// ── The community layer: the boundary this unit changes ──────────────
const recordParticipation = vi.fn();
const addCompanionTickets = vi.fn();
vi.mock("@/lib/community", () => ({
  recordParticipation: (...a: unknown[]) => recordParticipation(...(a as [])),
  addCompanionTickets: (...a: unknown[]) => addCompanionTickets(...(a as [])),
  CapacityReachedError: class extends Error {},
}));

const sendBroteTicketEmail = vi.fn(async () => ({ resendId: "r-1" }));
const markBroteTicketEmailSent = vi.fn(async () => {});
vi.mock("@/lib/brote-ticket-email", () => ({
  sendBroteTicketEmail: (...a: unknown[]) => sendBroteTicketEmail(...(a as [])),
  markBroteTicketEmailSent: (...a: unknown[]) =>
    markBroteTicketEmailSent(...(a as [])),
}));

const notifyAdminOfIncident = vi.fn(async () => {});
vi.mock("@/lib/admin-alert", () => ({ notifyAdminOfIncident }));
vi.mock("@/lib/meta-capi", () => ({ sendMetaEvent: vi.fn(async () => {}) }));

// ── Helpers ──────────────────────────────────────────────────────────
function signedWebhook(paymentId: string) {
  const body = JSON.stringify({ type: "payment", data: { id: paymentId } });
  const ts = "1700000000";
  const requestId = "req-multi-1";
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return new Request("http://localhost/api/brote/webhook", {
    method: "POST",
    headers: {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    },
    body,
  });
}

const UNIT = 24750;

/**
 * A payment for `qty` tickets, with the amount MercadoPago would actually
 * have charged. Keeping those two consistent matters: the webhook issues
 * against the MONEY, so a fixture that asks for 3 while paying for 1 is
 * testing the clamp, not the happy path.
 */
function paymentFor(qty: number, over: Record<string, unknown> = {}) {
  return payment({
    transaction_amount: UNIT * qty,
    metadata: { type: "ticket", qty },
    ...over,
  });
}

function payment(over: Record<string, unknown> = {}) {
  return {
    status: "approved",
    transaction_amount: UNIT,
    currency_id: "ARS",
    external_reference: "ct-token-aaaaaaaaaaa",
    preference_id: "PREF-1",
    metadata: { type: "ticket" },
    payer: { email: "buyer@example.com", first_name: "Ana" },
    ...over,
  };
}

/** What the checkout route stashes; U4 adds qty + unitPriceCents. */
function stash(over: Record<string, unknown> = {}) {
  redisStore.set(
    "brote:checkout:PREF-1",
    JSON.stringify({ locale: "es", unitPriceCents: 2_475_000, ...over }),
  );
}

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  dbNext = [];
  recordParticipation.mockResolvedValue({
    personId: 7,
    participationId: "BROTE2-PRIMARY",
    created: true,
    promoted: false,
    personCreated: true,
  });
  addCompanionTickets.mockImplementation(
    async (p: { ticketIds: string[] }) => ({
      createdIds: p.ticketIds,
      existingIds: [],
    }),
  );
});

async function post(paymentId: string, p: Record<string, unknown>) {
  paymentGet.mockResolvedValue(p);
  const { POST } = await import("./webhook/route");
  return POST(signedWebhook(paymentId));
}

describe("BROTE webhook — N tickets per payment", () => {
  it("T3.1 — qty 3 issues one primary plus two companions, all in one email", async () => {
    stash();
    const res = await post("MP-1", paymentFor(3));
    expect(res.status).toBe(200);

    expect(recordParticipation).toHaveBeenCalledTimes(1);
    expect(addCompanionTickets).toHaveBeenCalledTimes(1);
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toHaveLength(2);

    // One message, three QRs — not three messages.
    expect(sendBroteTicketEmail).toHaveBeenCalledTimes(1);
    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets).toHaveLength(3);
    expect(sent.tickets[0].ticketId).toBe("BROTE2-PRIMARY");
    expect(markBroteTicketEmailSent.mock.calls[0][0]).toHaveLength(3);
  });

  it("T3.1b — the price recorded is PER TICKET, not the basket total", async () => {
    stash();
    await post("MP-1", paymentFor(3));
    expect(recordParticipation.mock.calls[0][0].priceCents).toBe(2_475_000);
    expect(addCompanionTickets.mock.calls[0][0].priceCents).toBe(2_475_000);
  });

  it("T3.2 — reads qty from additional_info when metadata has none, as a STRING", async () => {
    // MP's REST response types quantity as a string even though the SDK
    // declares a number.
    stash();
    await post("MP-1", payment({
      transaction_amount: UNIT * 2,
      metadata: { type: "ticket" },
      additional_info: { items: [{ quantity: "2" }] },
    }));
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toHaveLength(1);
  });

  it("T3.7 — companions carry metadata.invite, so payouts count them", async () => {
    // brote-collaborator-payout.ts selects on metadata->>'invite'. Threading
    // it only through recordParticipation pays a collaborator for 1 of 3.
    stash();
    await post("MP-1", paymentFor(3, { metadata: { type: "ticket", qty: 3, invite: "pulso" } }));
    expect(addCompanionTickets.mock.calls[0][0].metadata).toMatchObject({
      invite: "pulso",
    });
  });

  it("T3.4 — issues only what the money covers, and alerts", async () => {
    // qty says 3, the amount covers 2. The ticket count follows the money.
    stash();
    await post("MP-1", payment({
      transaction_amount: UNIT * 2, // asked for 3, paid for 2
      metadata: { type: "ticket", qty: 3 },
    }));
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toHaveLength(1);
    expect(notifyAdminOfIncident).toHaveBeenCalled();
  });

  it("T3.9 — companion ids are derived from the payment, not minted fresh", async () => {
    // Two concurrent deliveries must compute the same ids; that is the only
    // thing deduping companion rows now that the unique index exempts them.
    stash();
    await post("MP-1", paymentFor(3));
    const first = addCompanionTickets.mock.calls[0][0].ticketIds;

    vi.clearAllMocks();
    redisStore.clear();
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-PRIMARY",
      created: true,
      promoted: false,
      personCreated: true,
    });
    addCompanionTickets.mockImplementation(
      async (p: { ticketIds: string[] }) => ({
        createdIds: p.ticketIds,
        existingIds: [],
      }),
    );
    await post("MP-1", paymentFor(3));
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toEqual(first);
  });

  it("T3.10 — the batch gets the LAST N tree numbers, in order", async () => {
    // "Cada entrada planta un árbol" is the premise of the event, and the
    // number is printed on the ticket. With the count taken after the
    // insert, a 3-pack that lands at total 20 owns trees 18, 19 and 20 —
    // not 20, 20, 20, and not 21, 22, 23.
    stash();
    dbNext = [{ n: 20 }];
    await post("MP-1", paymentFor(3));

    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { treeNumber: number }[];
    };
    expect(sent.tickets.map((t) => t.treeNumber)).toEqual([18, 19, 20]);
  });

  it("T3.6 — a payment with no qty still issues exactly one ticket (pin)", async () => {
    stash();
    await post("MP-1", payment());
    expect(addCompanionTickets).not.toHaveBeenCalled();
    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: unknown[];
    };
    expect(sent.tickets).toHaveLength(1);
  });

  it("T3.8 — a repeat single-ticket purchase still alerts and issues nothing (pin)", async () => {
    // U3 deliberately does NOT turn repurchase on. That is an observable
    // production change and it belongs with the switch in U4, on one revert
    // boundary. Until then this branch behaves exactly as it does today.
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-EXISTING",
      created: false,
      promoted: false,
      personCreated: false,
    });
    await post("MP-1", payment());

    expect(addCompanionTickets).not.toHaveBeenCalled();
    expect(sendBroteTicketEmail).not.toHaveBeenCalled();
    expect(notifyAdminOfIncident).toHaveBeenCalled();
  });

  it("rejects an unsigned request", async () => {
    // Proves the signing helper above is real: these tests are not passing
    // through the fail-open branch.
    const { POST } = await import("./webhook/route");
    const res = await POST(
      new Request("http://localhost/api/brote/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "payment", data: { id: "MP-1" } }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("T3.11 — never emails a QR for a row that was not inserted", async () => {
    // `addCompanionTickets` reports what it ACTUALLY wrote. Emailing the ids
    // we asked for instead hands someone a code the gate rejects — the same
    // class of failure as the locally-generated id that once shipped inside
    // a QR for a row that was never inserted.
    stash();
    addCompanionTickets.mockResolvedValue({ createdIds: [], existingIds: [] });
    await post("MP-1", paymentFor(3));

    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets).toHaveLength(1);
    expect(sent.tickets[0].ticketId).toBe("BROTE2-PRIMARY");
    // A shortfall is exactly what the admin alert exists for.
    expect(notifyAdminOfIncident).toHaveBeenCalled();
  });
});

describe("BROTE webhook — retrying a multi-ticket payment", () => {
  it("T3.5 — resends the WHOLE group, not just the primary", async () => {
    // The Redis idempotency key points at the primary only. Resending just
    // that one delivers 1 QR for a 3-ticket purchase, and the companions stay
    // `emailSent` falsy for good: the next retry exits early on the primary's
    // flag, so nothing ever retries them and nothing alerts. The buyer is
    // simply short two tickets, silently.
    redisStore.set("brote:payment:MP-RETRY", "BROTE2-PRIMARY");
    // The primary lookup and the group query share this fake, which resolves
    // whatever `dbNext` holds; the route reads [0] for the primary and maps
    // the rest as the group.
    dbNext = [
      {
        id: "BROTE2-PRIMARY",
        metadata: {},
        email: "buyer@example.com",
        name: "Ana",
      },
      { id: "BROTE2-COMP-A" },
      { id: "BROTE2-COMP-B" },
    ];

    const { POST } = await import("./webhook/route");
    await POST(signedWebhook("MP-RETRY"));

    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets.map((t) => t.ticketId)).toEqual([
      "BROTE2-PRIMARY",
      "BROTE2-COMP-A",
      "BROTE2-COMP-B",
    ]);
    // ...and every one gets flagged, or the next retry repeats the whole thing.
    expect(markBroteTicketEmailSent.mock.calls[0][0]).toHaveLength(3);
  });
});
