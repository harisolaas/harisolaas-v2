import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/hackea/checkout. Everything is mocked: no DB, no MercadoPago,
 * no Meta. The lead writer is the boundary — its own DB behaviour is covered
 * in src/lib/hackea.test.ts.
 */

const BASE = "https://www.harisolaas.test";
vi.stubEnv("NEXT_PUBLIC_BASE_URL", BASE);

// ── MercadoPago ──────────────────────────────────────────────────────
type PrefResult = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};
const preferenceCreate = vi.fn<
  (args: { body: Record<string, unknown> }) => Promise<PrefResult>
>(async () => ({
  id: "PREF-1",
  init_point: "https://mp.test/pay",
  sandbox_init_point: "https://mp.test/sandbox",
}));
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = preferenceCreate;
  },
}));

// ── Lead writer ──────────────────────────────────────────────────────
const createHackeaLead = vi.fn<
  (p: Record<string, unknown>) => Promise<{
    participationId: string;
    status: string;
    created: boolean;
  }>
>(async () => ({
  participationId: "HTM-ABCD1234",
  status: "pending",
  created: true,
}));
vi.mock("@/lib/hackea", () => ({
  createHackeaLead: (p: Record<string, unknown>) => createHackeaLead(p),
}));

const sendMetaEvent = vi.fn<
  (e: Record<string, unknown>) => Promise<{ ok: boolean }>
>(async () => ({ ok: true }));
vi.mock("@/lib/meta-capi", () => ({
  sendMetaEvent: (e: Record<string, unknown>) => sendMetaEvent(e),
}));

// ── Redis (CAPI stash for the webhook's Purchase) ────────────────────
const redisSet = vi.fn<
  (k: string, v: string, o?: { EX?: number }) => Promise<string | null>
>(async () => "OK");
vi.mock("@/lib/redis", () => ({
  getRedis: async () => ({
    set: (k: string, v: string, o?: { EX?: number }) => redisSet(k, v, o),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────
let ipCounter = 0;
/** A fresh IP per request unless given: the rate limiter is module state. */
function request(
  body: unknown,
  opts: { ip?: string; raw?: string; headers?: Record<string, string> } = {},
) {
  return new Request("http://localhost/api/hackea/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? `10.0.0.${++ipCounter}`,
      "user-agent": "vitest",
      ...opts.headers,
    },
    body: opts.raw ?? JSON.stringify(body),
  });
}

const VALID = {
  name: "Lucía Fernández",
  phone: "11 2345-6789",
  email: "lucia@example.com",
  locale: "es",
};

async function post(body: unknown, opts?: Parameters<typeof request>[1]) {
  const { POST } = await import("./route");
  const res = await POST(request(body, opts));
  return { status: res.status, json: await res.json() };
}

function prefBody() {
  expect(preferenceCreate).toHaveBeenCalledTimes(1);
  return preferenceCreate.mock.calls[0][0].body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeEach(() => {
  // Sales close at hackeaConfig.startIso: without a frozen clock every case
  // below would start answering 410 once the real date passes the talk.
  // Boundary tests re-set it; afterEach restores real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T12:00:00-03:00"));
  preferenceCreate.mockClear();
  createHackeaLead.mockClear();
  sendMetaEvent.mockClear();
  redisSet.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/hackea/checkout", () => {
  it("200 — writes the lead, then returns initPoint + participationId", async () => {
    const { status, json } = await post(VALID);
    expect(status).toBe(200);
    expect(json).toEqual({
      initPoint: "https://mp.test/pay",
      participationId: "HTM-ABCD1234",
    });
    expect(createHackeaLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lucía Fernández",
        phone: "11 2345-6789",
        email: "lucia@example.com",
      }),
    );
    // Lead before Preference: the CRM row exists even if MP fails.
    expect(createHackeaLead.mock.invocationCallOrder[0]).toBeLessThan(
      preferenceCreate.mock.invocationCallOrder[0],
    );
  });

  it("builds the Preference from config and the lead id", async () => {
    await post(VALID);
    const body = prefBody();
    expect(body.external_reference).toBe("HTM-ABCD1234");
    expect(body.metadata).toEqual({
      type: "hackea-ticket",
      participation_id: "HTM-ABCD1234",
    });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      title: "Hackeá tu mente — entrada",
      quantity: 1,
      unit_price: 21300,
      currency_id: "ARS",
    });
    expect(body.back_urls).toEqual({
      success: `${BASE}/es/hackea-tu-mente/success`,
      failure: `${BASE}/es/hackea-tu-mente/failure`,
      pending: `${BASE}/es/hackea-tu-mente/success?state=pending`,
    });
    expect(body.auto_return).toBe("approved");
    expect(body.notification_url).toBe(`${BASE}/api/hackea/webhook`);
    expect(body.payer).toEqual({
      name: "Lucía Fernández",
      email: "lucia@example.com",
    });
  });

  it("uses the requested locale in back_urls", async () => {
    await post({ ...VALID, locale: "en" });
    expect(prefBody().back_urls.success).toBe(
      `${BASE}/en/hackea-tu-mente/success`,
    );
  });

  it("falls back to es for an unknown locale", async () => {
    await post({ ...VALID, locale: "fr" });
    expect(prefBody().back_urls.failure).toBe(
      `${BASE}/es/hackea-tu-mente/failure`,
    );
  });

  it("omits payer email when none was given (phone-only buyer)", async () => {
    const { status } = await post({ ...VALID, email: "" });
    expect(status).toBe(200);
    expect(prefBody().payer).toEqual({ name: "Lucía Fernández" });
    expect(createHackeaLead.mock.calls[0][0].email).toBeUndefined();
  });

  it("passes cookie attribution and its link slug to the lead", async () => {
    await post(VALID, { headers: { cookie: "haris_link=ig-story-htm" } });
    const params = createHackeaLead.mock.calls[0][0] as {
      attribution?: { linkSlug?: string };
      linkSlug?: string;
    };
    expect(params.attribution?.linkSlug).toBe("ig-story-htm");
    expect(params.linkSlug).toBe("ig-story-htm");
  });

  it("fires Meta InitiateCheckout with the ticket value", async () => {
    await post(VALID, { ip: "203.0.113.9" });
    expect(sendMetaEvent).toHaveBeenCalledTimes(1);
    expect(sendMetaEvent.mock.calls[0][0]).toMatchObject({
      event_name: "InitiateCheckout",
      event_source_url: `${BASE}/es/hackea-tu-mente`,
      user_data: { client_ip_address: "203.0.113.9" },
      custom_data: { currency: "ARS", value: 21300, num_items: 1 },
    });
  });

  it("stashes ip/ua/fbp/fbc for the webhook's Purchase, 7 days, keyed by participation", async () => {
    await post(VALID, {
      ip: "203.0.113.9",
      headers: { cookie: "_fbp=fb.1.111.abc; _fbc=fb.1.222.click" },
    });
    expect(redisSet).toHaveBeenCalledTimes(1);
    const [key, value, opts] = redisSet.mock.calls[0];
    expect(key).toBe("hackea:checkout:HTM-ABCD1234");
    expect(opts).toEqual({ EX: 60 * 60 * 24 * 7 });
    expect(JSON.parse(value)).toEqual({
      ip: "203.0.113.9",
      ua: "vitest",
      fbp: "fb.1.111.abc",
      fbc: "fb.1.222.click",
      eventId: "hackea-checkout-HTM-ABCD1234",
    });
    // The cookies feed InitiateCheckout too.
    expect(sendMetaEvent.mock.calls[0][0]).toMatchObject({
      user_data: { fbp: "fb.1.111.abc", fbc: "fb.1.222.click" },
    });
  });

  it("body fbp/fbc win over the cookies", async () => {
    await post(
      { ...VALID, fbp: "fb.body", fbc: "fbc.body" },
      { headers: { cookie: "_fbp=fb.cookie" } },
    );
    expect(JSON.parse(redisSet.mock.calls[0][1])).toMatchObject({
      fbp: "fb.body",
      fbc: "fbc.body",
    });
  });

  it("still answers 200 when the stash write fails", async () => {
    redisSet.mockRejectedValueOnce(new Error("redis down"));
    const { status } = await post(VALID);
    expect(status).toBe(200);
  });

  it("still answers 200 when Meta CAPI rejects", async () => {
    sendMetaEvent.mockRejectedValueOnce(new Error("meta down"));
    const { status } = await post(VALID);
    expect(status).toBe(200);
  });

  it("returns sandbox_init_point under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    try {
      const { json } = await post(VALID);
      expect(json.initPoint).toBe("https://mp.test/sandbox");
    } finally {
      vi.unstubAllEnvs();
      vi.stubEnv("NEXT_PUBLIC_BASE_URL", BASE);
    }
  });

  it.each([
    ["name", { ...VALID, name: "   " }],
    ["phone", { ...VALID, phone: "123" }],
    ["email", { ...VALID, email: "not-an-email" }],
  ])("400 { error: %s } and writes nothing", async (field, body) => {
    const { status, json } = await post(body);
    expect(status).toBe(400);
    expect(json).toEqual({ error: field });
    expect(createHackeaLead).not.toHaveBeenCalled();
    expect(preferenceCreate).not.toHaveBeenCalled();
  });

  it("400 on an over-long name, and writes nothing", async () => {
    const { status, json } = await post({ ...VALID, name: "a".repeat(121) });
    expect(status).toBe(400);
    expect(json).toEqual({ error: "name" });
    expect(createHackeaLead).not.toHaveBeenCalled();
    expect(preferenceCreate).not.toHaveBeenCalled();
  });

  it("400 reports the first invalid field in form order", async () => {
    const { json } = await post({ name: "", phone: "", email: "x" });
    expect(json).toEqual({ error: "name" });
  });

  it("400 on invalid JSON", async () => {
    const { status } = await post(null, { raw: "{not json" });
    expect(status).toBe(400);
    expect(createHackeaLead).not.toHaveBeenCalled();
  });

  it("400 on a JSON body that isn't an object", async () => {
    const { status } = await post(["Lucía"]);
    expect(status).toBe(400);
    expect(createHackeaLead).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "used"])(
    "409 already_paid when the lead is %s — no Preference",
    async (leadStatus) => {
      createHackeaLead.mockResolvedValueOnce({
        participationId: "HTM-PAID0001",
        status: leadStatus,
        created: false,
      });
      const { status, json } = await post(VALID);
      expect(status).toBe(409);
      expect(json).toEqual({ error: "already_paid" });
      expect(preferenceCreate).not.toHaveBeenCalled();
    },
  );

  it("an existing pending lead gets a fresh Preference on its own id", async () => {
    createHackeaLead.mockResolvedValueOnce({
      participationId: "HTM-OLDLEAD1",
      status: "pending",
      created: false,
    });
    const { status, json } = await post(VALID);
    expect(status).toBe(200);
    expect(json.participationId).toBe("HTM-OLDLEAD1");
    expect(prefBody().external_reference).toBe("HTM-OLDLEAD1");
  });

  it("410 closed once the talk has started — writes nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T19:00:01-03:00"));
    const { status, json } = await post(VALID);
    expect(status).toBe(410);
    expect(json).toEqual({ error: "closed" });
    expect(createHackeaLead).not.toHaveBeenCalled();
    expect(preferenceCreate).not.toHaveBeenCalled();
  });

  it("still sells at the exact start instant", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T19:00:00-03:00"));
    const { status } = await post(VALID);
    expect(status).toBe(200);
  });

  it("429 after 5 requests from one IP within 60s", async () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < 5; i++) {
      expect((await post(VALID, { ip })).status).toBe(200);
    }
    const sixth = await post(VALID, { ip });
    expect(sixth.status).toBe(429);
    expect(createHackeaLead).toHaveBeenCalledTimes(5);
    // Another IP is unaffected.
    expect((await post(VALID)).status).toBe(200);
  });

  it("500 server when the lead write throws", async () => {
    createHackeaLead.mockRejectedValueOnce(new Error("db down"));
    const { status, json } = await post(VALID);
    expect(status).toBe(500);
    expect(json).toEqual({ error: "server" });
    expect(preferenceCreate).not.toHaveBeenCalled();
  });

  it("500 server when MP Preference creation fails after the lead", async () => {
    preferenceCreate.mockRejectedValueOnce(new Error("mp down"));
    const { status, json } = await post(VALID);
    expect(status).toBe(500);
    expect(json).toEqual({ error: "server" });
    expect(createHackeaLead).toHaveBeenCalledTimes(1);
    expect(sendMetaEvent).not.toHaveBeenCalled();
  });

  it("500 server when MP returns no init_point", async () => {
    preferenceCreate.mockResolvedValueOnce({ id: "PREF-2" });
    const { status, json } = await post(VALID);
    expect(status).toBe(500);
    expect(json).toEqual({ error: "server" });
  });
});
