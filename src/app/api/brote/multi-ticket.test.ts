import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const preferenceCreate = vi.fn(async () => ({
  id: "PREF-1",
  init_point: "https://mp.test/pay",
  sandbox_init_point: "https://mp.test/sandbox",
}));
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = preferenceCreate;
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
const sendMetaEvent = vi.fn(async () => {});
vi.mock("@/lib/meta-capi", () => ({
  sendMetaEvent: (...a: unknown[]) => sendMetaEvent(...(a as [])),
}));

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
  // Pinned before the party: past `eventEndTime` the checkout 410s and
  // none of this is reachable.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-10T12:00:00-03:00"));
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

afterAll(() => {
  vi.useRealTimers();
});

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

  it("T4.6 — a repeat purchase now issues a NEW ticket instead of alerting", async () => {
    // This replaces U3's inertness pin, deliberately: turning repurchase on
    // IS the observable change U4 ships. Until this commit, someone who
    // already had a ticket and paid again got an admin alert and no
    // ticket — money taken, nothing delivered.
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-FROM-EARLIER-PURCHASE",
      created: false,
      promoted: false,
      personCreated: false,
    });
    // The row `recordParticipation` found EXISTS — it always does when
    // `created` is false — and it belongs to a DIFFERENT payment. Modelling
    // it as absent would make the discriminator look like an existence
    // check, and a mutation that only tests existence would survive.
    dbNext = [{ paymentId: "MP-AN-EARLIER-PAYMENT" }];
    await post("MP-1", payment());

    expect(addCompanionTickets).toHaveBeenCalledTimes(1);
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toHaveLength(1);
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();

    // ...and it is the NEW ticket that gets emailed and anchored, never the
    // row from the earlier payment.
    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets).toHaveLength(1);
    expect(sent.tickets[0].ticketId).not.toBe("BROTE2-FROM-EARLIER-PURCHASE");
    expect(markBroteTicketEmailSent.mock.calls[0][0]).not.toContain(
      "BROTE2-FROM-EARLIER-PURCHASE",
    );
  });

  it("T4.8 — a racing second delivery of ONE payment issues nothing extra", async () => {
    // The regression this replaces: `created` alone decided how many
    // companions the payment still owed, so two concurrent deliveries
    // computed id sequences of DIFFERENT LENGTHS — A asked for
    // C0…C(qty-2), B (seeing A's fresh row) asked for C0…C(qty-1).
    // ON CONFLICT dedups the shared prefix, but that last id nobody else
    // claimed inserts. At qty=1 — the ordinary purchase — that is two
    // tickets for one payment, two emails, and silence: the shortfall
    // alert only fires on issuing too FEW.
    //
    // The discriminator is whether the existing row belongs to THIS
    // payment. Here it does: the twin created it moments ago.
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-PRIMARY",
      created: false, // the twin got there first
      promoted: false,
      personCreated: false,
    });
    // ...and the row it found carries THIS payment's id.
    dbNext = [{ paymentId: "MP-1" }];

    await post("MP-1", payment());

    // qty is 1 and the primary already exists, so this delivery owes zero
    // companions. Asking for even one would mint a second valid ticket.
    expect(addCompanionTickets).not.toHaveBeenCalled();
    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets.map((t) => t.ticketId)).toEqual(["BROTE2-PRIMARY"]);
  });

  it("T4.8b — a racing delivery of a 3-pack converges on the SAME three ids", async () => {
    // Both deliveries must compute one identical id set, or ON CONFLICT
    // cannot dedup them.
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-PRIMARY",
      created: false,
      promoted: false,
      personCreated: false,
    });
    dbNext = [{ paymentId: "MP-1" }];

    await post("MP-1", paymentFor(3));

    // qty-1 companions, exactly as the delivery that created the primary
    // would have asked for — not qty.
    expect(addCompanionTickets.mock.calls[0][0].ticketIds).toHaveLength(2);
    const sent = sendBroteTicketEmail.mock.calls[0][0] as {
      tickets: { ticketId: string }[];
    };
    expect(sent.tickets).toHaveLength(3);
  });

  it("T4.6b — the repeat purchase anchors Redis on the new ticket, not the old one", async () => {
    // `brote:payment:{id}` and `brote:confirm:{ct}` both key the retry path
    // and the /success contact step. Anchored on the earlier purchase's row,
    // a retry resends the OLD ticket set and the guest names typed on
    // /success land on the previous purchase's rows.
    stash();
    recordParticipation.mockResolvedValue({
      personId: 7,
      participationId: "BROTE2-FROM-EARLIER-PURCHASE",
      created: false,
      promoted: false,
      personCreated: false,
    });
    dbNext = [{ paymentId: "MP-AN-EARLIER-PAYMENT" }];
    await post("MP-1", payment());

    expect(redisStore.get("brote:payment:MP-1")).not.toBe(
      "BROTE2-FROM-EARLIER-PURCHASE",
    );
    expect(
      redisStore.get("brote:confirm:ct-token-aaaaaaaaaaa"),
    ).not.toBe("BROTE2-FROM-EARLIER-PURCHASE");
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


// ── The checkout side: what the buyer's chosen quantity does ─────────

let ipCounter = 100;
function checkoutRequest(body: Record<string, unknown> = {}) {
  ipCounter += 1;
  return new Request("http://localhost/api/brote/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Distinct IP per case: the route rate-limits 5/IP/60s in a
      // module-level Map that survives between tests in this file.
      "x-forwarded-for": `10.9.0.${ipCounter}`,
    },
    body: JSON.stringify({ locale: "es", ...body }),
  });
}

function preferenceBody() {
  return preferenceCreate.mock.calls[0][0].body as {
    items: { quantity: number; unit_price: number }[];
    metadata: Record<string, unknown>;
  };
}

describe("BROTE checkout — quantity", () => {
  it("T4.1 — asks MercadoPago for N units and stamps qty on the preference", async () => {
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ quantity: 3 }));

    const body = preferenceBody();
    expect(body.items[0].quantity).toBe(3);
    expect(body.metadata.qty).toBe(3);
  });

  it("T4.4 — multiplies the QUANTITY, never the unit price", async () => {
    // Multiplying unit_price charges the same total but shows
    // "1 × $74.250" at MercadoPago and tells the webhook nothing about how
    // many tickets to issue. The amount cross-check would pass either way,
    // so only this assertion catches it.
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ quantity: 3 }));

    const one = preferenceBody().items[0];
    expect(one.unit_price).toBeLessThan(40_000);
  });

  it("T4.3 — the stash carries qty and the unit price, under BOTH anchors", async () => {
    // The webhook needs unitPriceCents to check the amount, and reaches the
    // stash by preferenceId OR by confirmToken depending on what MP returns.
    const { POST } = await import("./checkout/route");
    const res = await POST(checkoutRequest({ quantity: 2 }));
    const { confirmToken } = await res.json();

    for (const key of [
      "brote:checkout:PREF-1",
      `brote:checkout-ct:${confirmToken}`,
    ]) {
      const stashed = JSON.parse(redisStore.get(key)!);
      expect(stashed.qty).toBe(2);
      // The UNIT matters, not just "is set". `unitPriceCents: price` instead
      // of `price * 100` is a silent, permanent disabling of the money
      // guard: `affordable` comes out ~100× the request, so
      // `affordable < requestedQty` never fires again. Pinned against the
      // preference's own unit_price so the two cannot drift.
      expect(stashed.unitPriceCents).toBe(
        preferenceBody().items[0].unit_price * 100,
      );
    }
  });

  it("T4.7 — the CAPI event reports the BASKET, matching its browser twin", async () => {
    // The browser fires `fbq('track','InitiateCheckout', {value, num_items})`
    // under the SAME event_id so Meta deduplicates the pair. If only one
    // half multiplies, the surviving event is whichever arrived first —
    // reporting either 1 ticket or N at random.
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ quantity: 3, eventId: "evt-capi-1" }));

    const call = sendMetaEvent.mock.calls[0][0] as {
      custom_data: { value: number; num_items?: number };
    };
    const unit = preferenceBody().items[0].unit_price;
    expect(call.custom_data.value).toBe(unit * 3);
    expect(call.custom_data.num_items).toBe(3);
  });

  it.each([
    ["3", 3],
    [0, 1],
    [-1, 1],
    [2.7, 2],
    [999, 10],
    [undefined, 1],
    [null, 1],
    ["abc", 1],
  ])("T4.2 — clamps a quantity of %p to %p", async (input, expected) => {
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ quantity: input }));
    expect(preferenceBody().items[0].quantity).toBe(expected);
  });
});
