import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Hackeá tu mente end to end: POST /api/hackea/checkout → signed
 * POST /api/hackea/webhook, against the real Postgres branch (.env.local).
 *
 * Only the edges are mocked: MercadoPago (Preference + Payment), Resend,
 * the admin alert, Meta CAPI and Redis (a fake with NX semantics — the
 * MOCK_REDIS client ignores NX). Everything in between — createHackeaLead,
 * confirmHackeaPayment, the webhook's per-mail claim / release SQL — runs
 * for real. The route unit tests stub that SQL with a JS model; this suite
 * is where the `::bigint` casts and `metadata - a - b` meet Postgres.
 *
 * The event id is mocked to a test-owned key so ensureHackeaEvent() never
 * touches the real row on the shared branch. Fixtures are keyed on the
 * E1FLOW prefix and swept in beforeAll/afterAll (docs/ops/test-database.md).
 */

const EVENT = "test-e1flow-hackea-evt";
const NAME_PREFIX = "E1FLOW Test";
const EMAIL_PREFIX = "e1flow-";
const SECRET = "test-e1flow-webhook-secret";
const PRICE_CENTS = 2_130_000;

vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
vi.stubEnv("HACKEA_NOTIFY_EMAILS", "hari@example.com");
vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://www.harisolaas.test");

vi.mock("@/data/hackea", async (orig) => {
  const actual = await orig<typeof import("@/data/hackea")>();
  return {
    ...actual,
    hackeaConfig: { ...actual.hackeaConfig, eventId: "test-e1flow-hackea-evt" },
  };
});

// ── Redis fake with NX ───────────────────────────────────────────────
const redisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  getRedis: async () => ({
    get: async (k: string) => redisStore.get(k) ?? null,
    set: async (k: string, v: string, opts?: { NX?: boolean }) => {
      if (opts?.NX && redisStore.has(k)) return null;
      redisStore.set(k, v);
      return "OK";
    },
    del: async (k: string) => (redisStore.delete(k) ? 1 : 0),
  }),
}));

// ── MercadoPago ──────────────────────────────────────────────────────
const preferenceCreate = vi.fn<
  (args: { body: Record<string, unknown> }) => Promise<Record<string, string>>
>(async () => ({
  id: "PREF-E1FLOW",
  init_point: "https://mp.test/pay",
  sandbox_init_point: "https://mp.test/sandbox",
}));
// paymentId → what MP's Payment.get returns
const mpPayments = new Map<string, Record<string, unknown>>();
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = (args: { body: Record<string, unknown> }) => preferenceCreate(args);
  },
  Payment: class {
    get = async ({ id }: { id: string }) => {
      const p = mpPayments.get(String(id));
      if (!p) throw new Error(`no MP payment ${id}`);
      return p;
    };
  },
}));

// ── Resend ───────────────────────────────────────────────────────────
type Mail = { to: string | string[]; subject: string; html: string };
const sent: Mail[] = [];
let sendImpl: (m: Mail) => Promise<{ error?: unknown }> = async () => ({});
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (m: Mail) => {
        const res = await sendImpl(m);
        if (!res.error) sent.push(m);
        return res;
      },
    };
  },
}));

const notifyAdminOfIncident = vi.fn<
  (i: { subject: string; lines: string[] }) => Promise<{ notified: boolean }>
>(async () => ({ notified: true }));
vi.mock("@/lib/admin-alert", () => ({
  notifyAdminOfIncident: (i: { subject: string; lines: string[] }) =>
    notifyAdminOfIncident(i),
}));
vi.mock("@/lib/meta-capi", () => ({
  sendMetaEvent: async () => ({ ok: true }),
}));

const { POST: checkout } = await import("./checkout/route");
const { POST: webhook } = await import("./webhook/route");
const { HACKEA_BUYER_SUBJECT } = await import("@/lib/hackea-email");

// ── Fixtures / helpers ───────────────────────────────────────────────
async function sweep() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id = ${EVENT}
       OR person_id IN (
         SELECT id FROM people
         WHERE name LIKE ${NAME_PREFIX + "%"} OR email LIKE ${EMAIL_PREFIX + "%@example.com"}
       )
  `);
  await db.execute(sql`
    DELETE FROM people
    WHERE name LIKE ${NAME_PREFIX + "%"} OR email LIKE ${EMAIL_PREFIX + "%@example.com"}
  `);
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
}
// Sales close at hackeaConfig.startIso: freeze Date (only Date — the DB
// driver's timers stay real) before any setup checkout, nested beforeAll
// included, so the suite doesn't turn into 410s once the talk has passed.
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T12:00:00-03:00"));
  await sweep();
});
afterAll(async () => {
  await sweep();
  vi.useRealTimers();
});

beforeEach(() => {
  sent.length = 0;
  sendImpl = async () => ({});
  notifyAdminOfIncident.mockClear();
  preferenceCreate.mockClear();
});

let ipCounter = 0;
function checkoutReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/hackea/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.77.0.${++ipCounter}`,
      "user-agent": "vitest-e1flow",
    },
    body: JSON.stringify({ locale: "es", ...body }),
  });
}

function signedWebhook(paymentId: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = `req-e1flow-${paymentId}-${Math.random()}`;
  const v1 = createHmac("sha256", SECRET)
    .update(`id:${paymentId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return new Request("http://localhost/api/hackea/webhook", {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
}

function mpApproved(
  paymentId: string,
  participationId: string,
  amountPesos = PRICE_CENTS / 100,
) {
  mpPayments.set(paymentId, {
    id: paymentId,
    status: "approved",
    transaction_amount: amountPesos,
    currency_id: "ARS",
    external_reference: participationId,
    metadata: { type: "hackea-ticket", participation_id: participationId },
  });
}

interface Row {
  id: string;
  status: string;
  price_cents: number | null;
  currency: string | null;
  external_payment_id: string | null;
  metadata: Record<string, unknown>;
  person_email: string | null;
  person_phone: string | null;
}
async function row(id: string): Promise<Row> {
  const res = await db.execute<Row>(sql`
    SELECT pa.id, pa.status, pa.price_cents, pa.currency, pa.external_payment_id,
           pa.metadata, pe.email AS person_email, pe.phone AS person_phone
    FROM participations pa JOIN people pe ON pe.id = pa.person_id
    WHERE pa.id = ${id}
  `);
  return res.rows[0];
}

async function startCheckout(body: Record<string, unknown>): Promise<string> {
  const res = await checkout(checkoutReq(body));
  expect(res.status).toBe(200);
  const json = (await res.json()) as { initPoint: string; participationId: string };
  expect(json.participationId).toMatch(/^HTM-[A-Z0-9]{8}$/);
  return json.participationId;
}

const buyerMails = () => sent.filter((m) => m.subject === HACKEA_BUYER_SUBJECT);
const hostMails = () => sent.filter((m) => m.subject !== HACKEA_BUYER_SUBJECT);

// ── Scenarios ────────────────────────────────────────────────────────
describe("checkout → webhook, phone only", () => {
  let pid = "";

  it("checkout writes a pending lead with metadata.contact before MP", async () => {
    pid = await startCheckout({
      name: `${NAME_PREFIX} Solo Tel`,
      phone: "11 9007-0101",
    });
    const r = await row(pid);
    expect(r.status).toBe("pending");
    expect(r.price_cents).toBe(PRICE_CENTS);
    expect(r.currency).toBe("ARS");
    expect(r.external_payment_id).toBeNull();
    expect(r.person_email).toBeNull();
    expect(r.person_phone).toBe("+5491190070101");
    expect(r.metadata.contact).toEqual({
      name: `${NAME_PREFIX} Solo Tel`,
      phone: "+5491190070101",
      email: null,
    });
    const body = preferenceCreate.mock.calls[0][0].body;
    expect(body.external_reference).toBe(pid);
    expect(body.payer).toEqual({ name: `${NAME_PREFIX} Solo Tel` });
  });

  it("approved webhook confirms the row and notifies only the host", async () => {
    mpApproved("e1flow-pay-101", pid);
    const res = await webhook(signedWebhook("e1flow-pay-101"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: "confirmed" });

    const r = await row(pid);
    expect(r.status).toBe("confirmed");
    expect(r.external_payment_id).toBe("e1flow-pay-101");
    expect(r.price_cents).toBe(PRICE_CENTS);
    expect(r.metadata.hostNotified).toBe(true);
    expect(r.metadata.buyerEmailSent).toBeUndefined();

    expect(buyerMails()).toHaveLength(0);
    expect(hostMails()).toHaveLength(1);
    expect(hostMails()[0].html).toContain("wa.me/5491190070101");
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();
  });

  it("a repeat delivery sends nothing new", async () => {
    const res = await webhook(signedWebhook("e1flow-pay-101"));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("a second checkout for the same WhatsApp after paying → 409", async () => {
    const res = await checkout(
      checkoutReq({
        name: `${NAME_PREFIX} Solo Tel otra vez`,
        // Same number, international form.
        phone: "+54 9 11 9007-0101",
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_paid" });
    expect(preferenceCreate).not.toHaveBeenCalled();
  });
});

describe("checkout → webhook, with email", () => {
  it("sends the buyer mail and the host mail once each", async () => {
    const email = `${EMAIL_PREFIX}mail@example.com`;
    const pid = await startCheckout({
      name: `${NAME_PREFIX} Con Mail`,
      phone: "11 9007-0102",
      email,
    });
    const before = await row(pid);
    expect(before.metadata.contact).toMatchObject({ email });
    expect(preferenceCreate.mock.calls[0][0].body.payer).toEqual({
      name: `${NAME_PREFIX} Con Mail`,
      email,
    });

    mpApproved("e1flow-pay-102", pid);
    const res = await webhook(signedWebhook("e1flow-pay-102"));
    expect(res.status).toBe(200);

    const r = await row(pid);
    expect(r.status).toBe("confirmed");
    expect(r.external_payment_id).toBe("e1flow-pay-102");
    expect(r.metadata.buyerEmailSent).toBe(true);
    expect(r.metadata.hostNotified).toBe(true);
    expect(buyerMails()).toHaveLength(1);
    expect(buyerMails()[0].to).toBe(email);
    expect(hostMails()).toHaveLength(1);
  });
});

describe("per-mail claims against real Postgres", () => {
  let pid = "";
  const PAY = "e1flow-pay-103";

  beforeAll(async () => {
    pid = await startCheckout({
      name: `${NAME_PREFIX} Carrera`,
      phone: "11 9007-0103",
      email: `${EMAIL_PREFIX}carrera@example.com`,
    });
    mpApproved(PAY, pid);
  });

  it("a failed send releases its claim (metadata - flag - atKey)", async () => {
    sendImpl = async () => ({ error: { message: "resend down" } });
    const res = await webhook(signedWebhook(PAY));
    expect(res.status).toBe(500);

    const r = await row(pid);
    // Payment is recorded even though delivery failed.
    expect(r.status).toBe("confirmed");
    for (const k of [
      "buyerEmailSent",
      "buyerEmailSentSendingAt",
      "hostNotified",
      "hostNotifiedSendingAt",
    ]) {
      expect(r.metadata).not.toHaveProperty(k);
    }
    // The failed fresh delivery released the idempotency key for MP's retry.
    expect(redisStore.has(`hackea:payment:${PAY}`)).toBe(false);
  });

  it("two concurrent deliveries send each mail exactly once", async () => {
    // Both deliveries must get past the Redis claim to race on the mail
    // claims: that's the state once the key holds the participationId
    // (MP's payment.updated or a retry landing after a confirm).
    redisStore.set(`hackea:payment:${PAY}`, pid);
    // Slow sends, so both requests are inside the claim window together.
    sendImpl = () => new Promise((r) => setTimeout(() => r({}), 300));

    const [a, b] = await Promise.all([
      webhook(signedWebhook(PAY)),
      webhook(signedWebhook(PAY)),
    ]);
    // A request that loses a claim answers 500 so MP comes back. Usually
    // that's one 200 + one 500, but the two can split the mails (each wins
    // one, loses the other), so only "nothing went out twice" is invariant.
    for (const r of [a, b]) expect([200, 500]).toContain(r.status);

    expect(buyerMails()).toHaveLength(1);
    expect(hostMails()).toHaveLength(1);

    const r = await row(pid);
    expect(r.metadata.buyerEmailSent).toBe(true);
    expect(r.metadata.hostNotified).toBe(true);

    // MP's follow-up retry finds both done.
    sendImpl = async () => ({});
    const again = await webhook(signedWebhook(PAY));
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  it("a stale 'sending' claim is reclaimed (::bigint against a stored number)", async () => {
    await db.execute(sql`
      UPDATE participations SET metadata = metadata
        - 'hostNotified'
        || jsonb_build_object(
             'hostNotified', 'sending',
             'hostNotifiedSendingAt', ${Date.now() - 10 * 60 * 1000}::bigint)
      WHERE id = ${pid}
    `);
    const res = await webhook(signedWebhook(PAY));
    expect(res.status).toBe(200);
    expect(hostMails()).toHaveLength(1);
    expect(buyerMails()).toHaveLength(0);
    expect((await row(pid)).metadata.hostNotified).toBe(true);
  });

  it("a fresh 'sending' claim is left alone and the delivery asks for a retry", async () => {
    await db.execute(sql`
      UPDATE participations SET metadata = metadata
        || jsonb_build_object(
             'hostNotified', 'sending',
             'hostNotifiedSendingAt', ${Date.now()}::bigint)
      WHERE id = ${pid}
    `);
    const res = await webhook(signedWebhook(PAY));
    expect(res.status).toBe(500);
    expect(sent).toHaveLength(0);
    expect((await row(pid)).metadata.hostNotified).toBe("sending");
  });
});

describe("underpaid approval", () => {
  it("confirms, alerts the admin once, and the host mail shows the real amount", async () => {
    const pid = await startCheckout({
      name: `${NAME_PREFIX} Pago Corto`,
      phone: "11 9007-0104",
    });
    mpApproved("e1flow-pay-104", pid, 10_000);
    const res = await webhook(signedWebhook("e1flow-pay-104"));
    expect(res.status).toBe(200);

    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
    expect(notifyAdminOfIncident.mock.calls[0][0].subject).toMatch(
      /por debajo del precio/,
    );
    const r = await row(pid);
    expect(r.status).toBe("confirmed");
    expect(r.external_payment_id).toBe("e1flow-pay-104");
    expect(hostMails()).toHaveLength(1);
    // What MP charged, not the list price.
    expect(hostMails()[0].html).toContain("$10.000");
    expect(hostMails()[0].html).not.toContain("$21.300");

    // Retry: the Redis marker keeps the alert from repeating.
    await webhook(signedWebhook("e1flow-pay-104"));
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
  });
});
