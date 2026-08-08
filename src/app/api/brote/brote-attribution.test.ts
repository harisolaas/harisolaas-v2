import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Attribution on the BROTE ticket path.
 *
 * The load-bearing test is T1.4: it feeds the webhook the *actual* stash
 * string the checkout route wrote, rather than a hand-built fixture. A
 * hand-built fixture cannot catch the failure this pair is most likely to
 * have — the checkout nesting attribution under `attribution:` (the shape
 * `sinergia-parrafo/checkout` uses) while the webhook reads the four fields
 * flat off the stash root.
 *
 * Everything is mocked: no DATABASE_URL, no Redis, no MercadoPago.
 */

// ── Redis fake, shared by both routes ────────────────────────────────
const redisStore = new Map<string, string>();
const redisSet = vi.fn(async (key: string, value: string) => {
  redisStore.set(key, value);
  return "OK";
});
const redisGet = vi.fn(async (key: string) => redisStore.get(key) ?? null);
const redisDel = vi.fn(async (key: string) => {
  redisStore.delete(key);
  return 1;
});

vi.mock("@/lib/redis", () => ({
  getRedis: async () => ({ get: redisGet, set: redisSet, del: redisDel }),
}));

// ── MercadoPago ──────────────────────────────────────────────────────
const preferenceCreate = vi.fn(async () => ({
  id: "PREF-1",
  init_point: "https://mp.test/pay",
  sandbox_init_point: "https://mp.test/sandbox",
}));
const paymentGet = vi.fn();

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = preferenceCreate;
  },
  Payment: class {
    get = paymentGet;
  },
}));

// ── Drizzle: fake client, real schema ────────────────────────────────
// The schema module has no env dependency, so drizzle's `eq`/`sql` helpers
// keep receiving real column objects while `db` itself is inert.
let dbNext: unknown[] = [];
function makeChain() {
  const c: Record<string, unknown> = {};
  for (const m of [
    "select",
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "limit",
    "orderBy",
    "groupBy",
    "update",
    "set",
    "insert",
    "values",
    "returning",
  ]) {
    c[m] = () => c;
  }
  c.then = (
    resolve: (v: unknown[]) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(dbNext).then(resolve, reject);
  return c;
}

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  return { db: makeChain(), schema };
});

// ── Everything else the two routes reach for ─────────────────────────
const recordParticipation = vi.fn(async () => ({
  personId: 1,
  participationId: "BROTE2-TEST0001",
  created: true,
  promoted: false,
  personCreated: true,
}));

vi.mock("@/lib/community", () => ({
  recordParticipation,
  CapacityReachedError: class extends Error {},
}));

vi.mock("@/lib/meta-capi", () => ({ sendMetaEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/admin-alert", () => ({
  notifyAdminOfIncident: vi.fn(async () => {}),
}));

vi.mock("@/lib/brote-ticket-email", () => ({
  sendBroteTicketEmail: vi.fn(async () => {}),
  markBroteTicketEmailSent: vi.fn(async () => {}),
}));

// ── Helpers ──────────────────────────────────────────────────────────
function checkoutRequest(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/brote/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ locale: "es", ...body }),
  });
}

/** The JSON the checkout route stashed under `brote:checkout:{preferenceId}`. */
function stashedPayload(): Record<string, unknown> {
  const raw = redisStore.get("brote:checkout:PREF-1");
  if (!raw) throw new Error("checkout did not stash under the preference id");
  return JSON.parse(raw) as Record<string, unknown>;
}

function webhookRequest(paymentId: string) {
  return new Request("http://localhost/api/brote/webhook", {
    method: "POST",
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
}

const UTM = {
  source: "instagram",
  medium: "story",
  campaign: "brote",
  content: "ig-story-x",
};

let ipCounter = 0;
const ip = () => `10.0.0.${ipCounter}`;

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  dbNext = [];
  // Distinct IPs per test: the checkout route rate-limits 5/IP/60s in a
  // module-level Map that survives between tests in the same file.
  ipCounter += 1;
});

describe("BROTE checkout — attribution reaches the Redis stash", () => {
  it("T1.1 — stashes source/medium/campaign/linkSlug flat when the body carries UTMs", async () => {
    const { POST } = await import("./checkout/route");

    const res = await POST(
      checkoutRequest({ utm: UTM }, { "x-forwarded-for": ip() }),
    );
    expect(res.status).toBe(200);

    const stash = stashedPayload();
    expect(stash.source).toBe("instagram");
    expect(stash.medium).toBe("story");
    expect(stash.campaign).toBe("brote");
    expect(stash.linkSlug).toBe("ig-story-x");
  });

  it("T1.2 — falls back to the haris_link cookie when there are no UTMs", async () => {
    const { POST } = await import("./checkout/route");

    const res = await POST(
      checkoutRequest(
        {},
        { "x-forwarded-for": ip(), cookie: "haris_link=abc123" },
      ),
    );
    expect(res.status).toBe(200);

    expect(stashedPayload().linkSlug).toBe("abc123");
  });

  it("T1.2b — a UTM in the body wins over the cookie", async () => {
    const { POST } = await import("./checkout/route");

    await POST(
      checkoutRequest(
        { utm: { source: "instagram", content: "from-url" } },
        { "x-forwarded-for": ip(), cookie: "haris_link=from-cookie" },
      ),
    );

    expect(stashedPayload().linkSlug).toBe("from-url");
  });

  it("T1.3 — adds no attribution keys when there is nothing to attribute (non-regression pin)", async () => {
    const { POST } = await import("./checkout/route");

    const res = await POST(checkoutRequest({}, { "x-forwarded-for": ip() }));
    expect(res.status).toBe(200);

    const stash = stashedPayload();
    expect(stash.source).toBeUndefined();
    expect(stash.medium).toBeUndefined();
    expect(stash.campaign).toBeUndefined();
    expect(stash.linkSlug).toBeUndefined();
  });

  it("T1.3b — keeps the fields the contact flow depends on (non-regression pin)", async () => {
    const { POST } = await import("./checkout/route");

    await POST(checkoutRequest({ eventId: "evt-1" }, { "x-forwarded-for": ip() }));

    const stash = stashedPayload();
    expect(stash.confirmToken).toEqual(expect.any(String));
    expect(stash.locale).toBe("es");
    expect(stash.eventId).toBe("evt-1");
  });
});

describe("BROTE webhook — the stash the checkout actually wrote", () => {
  it("T1.4 — carries linkSlug into both attribution and bypassLinkSlug", async () => {
    // 1. Real checkout run — produces the real stash string.
    const checkout = await import("./checkout/route");
    await checkout.POST(
      checkoutRequest({ utm: UTM }, { "x-forwarded-for": ip() }),
    );
    expect(redisStore.has("brote:checkout:PREF-1")).toBe(true);

    // 2. MP calls the webhook about the payment for that preference.
    paymentGet.mockResolvedValue({
      status: "approved",
      preference_id: "PREF-1",
      transaction_amount: 24750,
      currency_id: "ARS",
      metadata: { type: "ticket" },
      payer: { email: "ana@example.com", first_name: "Ana" },
    });
    dbNext = [{ n: 7 }];

    const { POST } = await import("./webhook/route");
    const res = await POST(webhookRequest("MP-9001"));
    expect(res.status).toBe(200);

    expect(recordParticipation).toHaveBeenCalledTimes(1);
    const params = recordParticipation.mock.calls[0][0] as {
      attribution?: Record<string, unknown>;
      bypassLinkSlug?: string;
    };

    expect(params.attribution?.linkSlug).toBe("ig-story-x");
    expect(params.attribution?.source).toBe("instagram");
    expect(params.attribution?.medium).toBe("story");
    expect(params.attribution?.campaign).toBe("brote");

    // referred_by_person_id is written ONLY from bypassLinkSlug — passing
    // attribution alone yields click credit with a null referrer.
    expect(params.bypassLinkSlug).toBe("ig-story-x");
  });

  it("T1.4b — passes no bypassLinkSlug when the purchase has no attribution", async () => {
    const checkout = await import("./checkout/route");
    await checkout.POST(checkoutRequest({}, { "x-forwarded-for": ip() }));

    paymentGet.mockResolvedValue({
      status: "approved",
      preference_id: "PREF-1",
      transaction_amount: 24750,
      currency_id: "ARS",
      metadata: { type: "ticket" },
      payer: { email: "ana@example.com", first_name: "Ana" },
    });
    dbNext = [{ n: 7 }];

    const { POST } = await import("./webhook/route");
    await POST(webhookRequest("MP-9002"));

    const params = recordParticipation.mock.calls[0][0] as {
      attribution?: unknown;
      bypassLinkSlug?: string;
    };
    expect(params.bypassLinkSlug).toBeUndefined();
    expect(params.attribution).toBeUndefined();
  });
});
