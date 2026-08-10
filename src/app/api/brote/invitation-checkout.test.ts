import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { broteConfig } from "@/data/brote";

/**
 * Invited pricing is decided by the server.
 *
 * The slug arriving in the request body is a lookup key, never a price. These
 * tests exist because the failure mode is money: a client that could name its
 * own price, or a brand slug that quietly stops discounting once the preventa
 * ends, is wrong in a way no user would report.
 *
 * The clock is pinned — otherwise every artist assertion here turns into a
 * time bomb that goes off on 14/8, four days before the event.
 */

const DURING_EARLY_BIRD = new Date("2026-08-10T12:00:00-03:00");
const AFTER_EARLY_BIRD = new Date("2026-08-15T12:00:00-03:00");

// ── Redis ────────────────────────────────────────────────────────────
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
const preferenceCreate = vi.fn(async () => ({
  id: "PREF-INV",
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

// ── DB + collaborators of the webhook ────────────────────────────────
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

const recordParticipation = vi.fn(async () => ({
  personId: 1,
  participationId: "BROTE2-INV00001",
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
let ipCounter = 0;

function checkoutRequest(
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/brote/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.1.0.${ipCounter}`,
      ...headers,
    },
    body: JSON.stringify({ locale: "es", ...body }),
  });
}

/** The item MercadoPago was actually told to charge for. */
function chargedItem(): { unit_price: number; title: string } {
  const call = preferenceCreate.mock.calls[0]?.[0] as
    | { body: { items: { unit_price: number; title: string }[] } }
    | undefined;
  if (!call) throw new Error("no MercadoPago preference was created");
  return call.body.items[0];
}

function preferenceMetadata(): Record<string, unknown> {
  const call = preferenceCreate.mock.calls[0]?.[0] as {
    body: { metadata: Record<string, unknown> };
  };
  return call.body.metadata;
}

function stashed(): Record<string, unknown> {
  const raw = redisStore.get("brote:checkout:PREF-INV");
  if (!raw) throw new Error("nothing stashed");
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  dbNext = [];
  ipCounter += 1;
  vi.useFakeTimers();
  vi.setSystemTime(DURING_EARLY_BIRD);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("checkout — the server prices the invitation", () => {
  it("T2.5a — charges a brand 35% off the regular price", async () => {
    const { POST } = await import("./checkout/route");
    const res = await POST(checkoutRequest({ invite: "pulso" }));

    expect(res.status).toBe(200);
    expect(chargedItem().unit_price).toBe(21450);
  });

  it("T2.5b — charges an artist the public preventa price", async () => {
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ invite: "jose" }));

    expect(chargedItem().unit_price).toBe(broteConfig.earlyBirdPriceRaw);
  });

  it("T2.5c — an unknown slug falls back to the public price, no error", async () => {
    const { POST } = await import("./checkout/route");
    const res = await POST(checkoutRequest({ invite: "../../etc/passwd" }));

    expect(res.status).toBe(200);
    expect(chargedItem().unit_price).toBe(broteConfig.earlyBirdPriceRaw);
  });

  it("T2.5d — the brand discount survives the end of the preventa", async () => {
    // Gating invited pricing behind isEarlyBird would raise Pulso's price
    // from 21.450 to 24.750 on 14/8 without anyone touching the code.
    vi.setSystemTime(AFTER_EARLY_BIRD);
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ invite: "pulso" }));

    expect(chargedItem().unit_price).toBe(21450);
  });

  it("T2.6 — a price in the request body is ignored", async () => {
    const { POST } = await import("./checkout/route");
    await POST(
      checkoutRequest({ invite: "pulso", priceRaw: 1, unit_price: 1 }),
    );

    expect(chargedItem().unit_price).toBe(21450);
  });

  it("T2.9 — names the collaborator on the MP item and metadata", async () => {
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({ invite: "matelab" }));

    // Durable: MP propagates preference metadata onto the Payment, so the
    // webhook can recover which collaborator sold this even if Redis expired.
    expect(preferenceMetadata().invite).toBe("matelab");
    // Reconcilable by eye in the MercadoPago dashboard.
    expect(chargedItem().title).toContain("MateLab");
  });

  it("T2.9b — no invite means no invite metadata", async () => {
    const { POST } = await import("./checkout/route");
    await POST(checkoutRequest({}));

    expect(preferenceMetadata().invite).toBeUndefined();
    expect(chargedItem().unit_price).toBe(broteConfig.earlyBirdPriceRaw);
  });
});

describe("checkout — invitation attribution", () => {
  it("T2.10 — attributes to the collaborator's tracked link by default", async () => {
    const { POST } = await import("./checkout/route");
    // The referer is load-bearing, not decoration. A same-origin fetch from
    // the invitation page ALWAYS sends one, and `buildAttribution` returns a
    // touch whenever any field is present — referer included. So in
    // production `attribution` is never undefined here, and a guard written
    // as `!attribution` instead of `!attribution?.linkSlug` would never fire:
    // every invited sale would land with link_slug null, which is the count
    // an artist's fee is paid from. Without this header the test passes on a
    // path production never takes.
    await POST(
      checkoutRequest(
        { invite: "jose" },
        { referer: "https://www.harisolaas.com/es/brote/invitacion/jose" },
      ),
    );

    const stash = stashed();
    expect(stash.linkSlug).toBe("inv-jose");
    expect(stash.source).toBe("partner");
    expect(stash.medium).toBe("referral");
    expect(stash.campaign).toBe("brote-invitacion");
  });

  it("T2.11 — a real tracked link wins over the invitation default", async () => {
    // Someone who reached the invitation through /go/<slug> carries a real
    // link. Overwriting it with the generic partner link would throw away the
    // more specific attribution.
    const { POST } = await import("./checkout/route");
    await POST(
      checkoutRequest({
        invite: "jose",
        utm: { source: "instagram", medium: "story", content: "ig-story-abc" },
      }),
    );

    const stash = stashed();
    expect(stash.linkSlug).toBe("ig-story-abc");
    expect(stash.source).toBe("instagram");

    // …and the collaborator is STILL recorded. This is the one case where
    // `metadata.invite` is the only channel left: the tracked link took the
    // attribution, so without this the sale stops being attributable to Jose
    // by any route. Someone arriving with a 30-day-old `haris_link` cookie
    // from an earlier campaign hits exactly this.
    expect(preferenceMetadata().invite).toBe("jose");
  });
});

describe("webhook — the collaborator survives to the participation", () => {
  it("T2.12 — writes metadata.invite from the payment metadata", async () => {
    const checkout = await import("./checkout/route");
    await checkout.POST(checkoutRequest({ invite: "gian" }));

    paymentGet.mockResolvedValue({
      status: "approved",
      preference_id: "PREF-INV",
      transaction_amount: 24750,
      currency_id: "ARS",
      metadata: { type: "ticket", invite: "gian" },
      payer: { email: "ana@example.com", first_name: "Ana" },
    });
    dbNext = [{ n: 3 }];

    const { POST } = await import("./webhook/route");
    await POST(
      new Request("http://localhost/api/brote/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "payment", data: { id: "MP-INV-1" } }),
      }),
    );

    const params = recordParticipation.mock.calls[0][0] as {
      metadata?: Record<string, unknown>;
      attribution?: Record<string, unknown>;
    };
    expect(params.metadata?.invite).toBe("gian");
    // The link slug is the reporting spine; metadata.invite is the belt.
    expect(params.attribution?.linkSlug).toBe("inv-gian");
  });

  it("T2.13 — records nothing for an invite that is not a real collaborator", async () => {
    // Whatever MP echoes back lands in participations.metadata. A String()
    // coercion would persist "[object Object]" as a collaborator name and
    // quietly pollute the payout report.
    for (const bogus of [{ a: 1 }, 42, "no-existe", ["jose"]]) {
      vi.clearAllMocks();
      paymentGet.mockResolvedValue({
        status: "approved",
        preference_id: "PREF-INV",
        transaction_amount: 24750,
        currency_id: "ARS",
        metadata: { type: "ticket", invite: bogus },
        payer: { email: "ana@example.com", first_name: "Ana" },
      });
      dbNext = [{ n: 3 }];

      const { POST } = await import("./webhook/route");
      await POST(
        new Request("http://localhost/api/brote/webhook", {
          method: "POST",
          body: JSON.stringify({
            type: "payment",
            data: { id: `MP-BOGUS-${JSON.stringify(bogus)}` },
          }),
        }),
      );

      const params = recordParticipation.mock.calls[0][0] as {
        metadata?: Record<string, unknown>;
      };
      expect(params.metadata?.invite, JSON.stringify(bogus)).toBeUndefined();
    }
  });
});
