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
      phone: "11 6007-0101",
    });
    const r = await row(pid);
    expect(r.status).toBe("pending");
    expect(r.price_cents).toBe(PRICE_CENTS);
    expect(r.currency).toBe("ARS");
    expect(r.external_payment_id).toBeNull();
    expect(r.person_email).toBeNull();
    expect(r.person_phone).toBe("+5491160070101");
    expect(r.metadata.contact).toEqual({
      name: `${NAME_PREFIX} Solo Tel`,
      phone: "+5491160070101",
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
    expect(hostMails()[0].html).toContain("wa.me/5491160070101");
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
        phone: "+54 9 11 6007-0101",
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
      phone: "11 6007-0102",
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
      phone: "11 6007-0103",
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
      phone: "11 6007-0104",
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

describe("admin status wins over webhook redeliveries", () => {
  let pid = "";
  const PAY = "e1flow-pay-105";

  beforeAll(async () => {
    pid = await startCheckout({
      name: `${NAME_PREFIX} Cancelada`,
      phone: "11 6007-0105",
      email: `${EMAIL_PREFIX}cancelada@example.com`,
    });
    mpApproved(PAY, pid);
  });

  it("a retry after the entrada was cancelled mails nothing and claims nothing", async () => {
    // First delivery confirms but Resend is down: flags released, 500.
    sendImpl = async () => ({ error: { message: "resend down" } });
    expect((await webhook(signedWebhook(PAY))).status).toBe(500);
    // Hari marks "No vendrá" before MP retries.
    await db.execute(sql`UPDATE participations SET status = 'cancelled' WHERE id = ${pid}`);

    sendImpl = async () => ({});
    const res = await webhook(signedWebhook(PAY));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
    const r = await row(pid);
    expect(r.status).toBe("cancelled");
    expect(r.metadata).not.toHaveProperty("buyerEmailSent");
    expect(r.metadata).not.toHaveProperty("hostNotified");
  });

  it("the cancelled buyer can't pay again while the payment stands → 409", async () => {
    const res = await checkout(
      checkoutReq({ name: `${NAME_PREFIX} Cancelada`, phone: "11 6007-0105" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_paid" });
    expect(preferenceCreate).not.toHaveBeenCalled();
  });

  it("a row set back to pending stays pending on a redelivery, no mails", async () => {
    await db.execute(sql`UPDATE participations SET status = 'pending' WHERE id = ${pid}`);
    const res = await webhook(signedWebhook(PAY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: "already" });
    expect(sent).toHaveLength(0);
    const r = await row(pid);
    expect(r.status).toBe("pending");
    expect(r.external_payment_id).toBe(PAY);
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();
  });
});

describe("refund, then buying again", () => {
  it("the new payment confirms the row as a fresh purchase and mails again", async () => {
    const email = `${EMAIL_PREFIX}reintegro@example.com`;
    const pid = await startCheckout({
      name: `${NAME_PREFIX} Reintegro`,
      phone: "11 6007-0106",
      email,
    });
    mpApproved("e1flow-pay-106", pid);
    expect((await webhook(signedWebhook("e1flow-pay-106"))).status).toBe(200);
    expect(sent).toHaveLength(2);

    // MP refunds it; Hari cancels the entrada.
    mpPayments.set("e1flow-pay-106", {
      ...mpPayments.get("e1flow-pay-106"),
      status: "refunded",
    });
    expect((await webhook(signedWebhook("e1flow-pay-106"))).status).toBe(200);
    await db.execute(sql`UPDATE participations SET status = 'cancelled' WHERE id = ${pid}`);
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);

    sent.length = 0;
    expect(
      await startCheckout({ name: `${NAME_PREFIX} Reintegro`, phone: "11 6007-0106", email }),
    ).toBe(pid);
    mpApproved("e1flow-pay-107", pid);
    const res = await webhook(signedWebhook("e1flow-pay-107"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: "confirmed" });

    const r = await row(pid);
    expect(r.status).toBe("confirmed");
    expect(r.external_payment_id).toBe("e1flow-pay-107");
    expect(r.metadata.extraPaymentIds).toBeUndefined();
    expect(buyerMails()).toHaveLength(1);
    expect(hostMails()).toHaveLength(1);
    // Only the refund alerted — no "segundo pago".
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
  });
});

describe("resubmit while the payment confirms (#99 fix 1)", () => {
  // Real Postgres interleaving, not a mock: a transaction stands in for the
  // webhook's confirmHackeaPayment — row locked FOR UPDATE, flipped to
  // confirmed, not yet committed — while a resubmit runs the real
  // checkout. The test waits until Postgres reports the checkout blocked
  // on that transaction (pg_blocking_pids), so the checkout has already
  // read the row as pending, and only then commits. Before the fix the
  // checkout's snapshot UPDATE didn't re-check the row, came back with the
  // stale `pending` and opened a second Preference.
  it("sees the payment and answers 409 instead of opening a second checkout", async () => {
    const pid = await startCheckout({
      name: `${NAME_PREFIX} Carrera Pago`,
      phone: "11 6007-0108",
    });
    preferenceCreate.mockClear();

    let commit!: () => void;
    const gate = new Promise<void>((r) => (commit = r));
    let holderPid = 0;
    let locked!: () => void;
    const lockedP = new Promise<void>((r) => (locked = r));
    const holder = db.transaction(async (tx) => {
      const me = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      holderPid = Number(me.rows[0].pid);
      await tx.execute(sql`SELECT id FROM participations WHERE id = ${pid} FOR UPDATE`);
      await tx.execute(sql`
        UPDATE participations
        SET status = 'confirmed', external_payment_id = 'e1flow-pay-108'
        WHERE id = ${pid}
      `);
      locked();
      await gate;
    });
    await lockedP;

    let resubmit: Promise<Response> | undefined;
    let blocked = false;
    try {
      resubmit = checkout(
        checkoutReq({ name: `${NAME_PREFIX} Carrera Pago`, phone: "11 6007-0108" }),
      );
      for (let i = 0; i < 100 && !blocked; i++) {
        const w = await db.execute<{ n: number }>(sql`
          SELECT COUNT(*)::int AS n FROM pg_stat_activity
          WHERE ${holderPid}::int = ANY(pg_blocking_pids(pid))
        `);
        blocked = Number(w.rows[0].n) > 0;
        if (!blocked) await new Promise((r) => setTimeout(r, 100));
      }
    } finally {
      // Even if a poll throws: let the holder commit and the checkout
      // finish, so no row lock outlives the test and wedges afterAll.
      commit();
      await Promise.allSettled([holder, resubmit]);
    }
    await holder;
    const res = await resubmit;

    expect(blocked).toBe(true);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_paid" });
    expect(preferenceCreate).not.toHaveBeenCalled();
    const r = await row(pid);
    expect(r.status).toBe("confirmed");
  });
});

describe("an old payment's send finishing after a repurchase", () => {
  // Real interleaving: the first payment's delivery is parked inside the
  // buyer-mail send (claim taken) while the refund lands and a new payment
  // confirms the row as a fresh purchase. When the old send then finishes,
  // its mark must not count as the new purchase's mail, and the rest of the
  // old delivery must not claim anything.
  it("the new purchase still gets its own buyer and host mails", async () => {
    const { confirmHackeaPayment } = await import("@/lib/hackea");
    const OLD = "e1flow-pay-109";
    const NEW = "e1flow-pay-110";
    const pid = await startCheckout({
      name: `${NAME_PREFIX} Carrera Reintegro`,
      phone: "11 6007-0109",
      email: `${EMAIL_PREFIX}carrera-reintegro@example.com`,
    });
    mpApproved(OLD, pid);

    let entered!: () => void;
    const enteredP = new Promise<void>((r) => (entered = r));
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    let first = true;
    sendImpl = async () => {
      if (first) {
        first = false;
        entered();
        await gate;
      }
      return {};
    };

    const oldDelivery = webhook(signedWebhook(OLD));
    let oldStatus = 0;
    try {
      await enteredP;
      expect((await row(pid)).metadata).toMatchObject({
        buyerEmailSent: "sending",
        buyerEmailSentSendingFor: OLD,
      });
      // Refunded (what handleReversal writes), then bought again.
      await db.execute(sql`
        UPDATE participations SET metadata = metadata || jsonb_build_object(
          'refund', jsonb_build_object('status', 'refunded', 'paymentId', ${OLD}::text))
        WHERE id = ${pid}
      `);
      const fresh = await confirmHackeaPayment({
        participationId: pid,
        paymentId: NEW,
        amountCents: PRICE_CENTS,
        currency: "ARS",
      });
      expect(fresh.outcome).toBe("confirmed");
    } finally {
      finish();
      oldStatus = (await oldDelivery).status;
    }

    // The old delivery mailed the buyer once (it was mid-send) and nothing
    // else; the new purchase's flags are untouched.
    expect(oldStatus).toBe(200);
    expect(buyerMails()).toHaveLength(1);
    expect(hostMails()).toHaveLength(0);
    let r = await row(pid);
    expect(r.metadata).not.toHaveProperty("buyerEmailSent");
    expect(r.metadata).not.toHaveProperty("hostNotified");

    mpApproved(NEW, pid);
    const res = await webhook(signedWebhook(NEW));
    expect(res.status).toBe(200);
    expect(buyerMails()).toHaveLength(2);
    expect(hostMails()).toHaveLength(1);
    r = await row(pid);
    expect(r.external_payment_id).toBe(NEW);
    expect(r.metadata.buyerEmailSent).toBe(true);
    expect(r.metadata.hostNotified).toBe(true);
    expect(r.metadata.refundedPaymentIds).toEqual([OLD]);
  });
});
