import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

/**
 * The Hackeá tu mente webhook. Everything is mocked — no DB, Redis, MP or
 * Resend — and every request is SIGNED with a real HMAC, so these tests
 * don't lean on the dev-only "no secret" bypass.
 */

const SECRET = "test-webhook-secret";
vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
vi.stubEnv("HACKEA_NOTIFY_EMAILS", "hari@example.com, ops@example.com");

// ── Redis fake with NX semantics (the MOCK_REDIS client ignores NX) ────
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
const paymentGet = vi.fn();
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    get = paymentGet;
  },
}));

// ── Resend ───────────────────────────────────────────────────────────
const emailsSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: emailsSend };
  },
}));

// ── DB: only the two reads the route does itself ─────────────────────
let deliveryRow: Record<string, unknown> | null = null;
let confirmedCount = 3;
function sqlText(q: { queryChunks?: unknown[] }): string {
  return (q.queryChunks ?? [])
    .map((c) =>
      c && typeof c === "object" && "value" in c
        ? (c as { value: string[] }).value.join("")
        : "?",
    )
    .join("");
}
const dbExecute = vi.fn(async (q: { queryChunks?: unknown[] }) => {
  const text = sqlText(q);
  if (text.includes("COUNT(*)")) return { rows: [{ n: confirmedCount }] };
  if (text.includes("FROM participations WHERE id")) {
    return { rows: deliveryRow ? [deliveryRow] : [] };
  }
  throw new Error("unexpected query: " + text);
});
vi.mock("@/db", () => ({ db: { execute: (q: never) => dbExecute(q) } }));

// ── The lib boundary ─────────────────────────────────────────────────
const confirmHackeaPayment = vi.fn();
const markHackeaFlag = vi.fn(async () => {});
vi.mock("@/lib/hackea", () => ({
  confirmHackeaPayment: (...a: unknown[]) => confirmHackeaPayment(...a),
  markHackeaFlag: (...a: unknown[]) => markHackeaFlag(...(a as [])),
}));

const notifyAdminOfIncident = vi.fn(async () => ({ notified: true }));
vi.mock("@/lib/admin-alert", () => ({
  notifyAdminOfIncident: (...a: unknown[]) =>
    notifyAdminOfIncident(...(a as [])),
}));
const sendMetaEvent = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/meta-capi", () => ({
  sendMetaEvent: (...a: unknown[]) => sendMetaEvent(...(a as [])),
}));

const { POST } = await import("./route");

// ── Helpers ──────────────────────────────────────────────────────────
const PID = "HTM-ABCD1234";
const PAY = "1324567890";

function signed(paymentId = PAY, opts: { secret?: string } = {}) {
  const body = JSON.stringify({ type: "payment", data: { id: paymentId } });
  const ts = "1700000000";
  const requestId = "req-hackea-1";
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", opts.secret ?? SECRET)
    .update(manifest)
    .digest("hex");
  return new Request("http://localhost/api/hackea/webhook", {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
    body,
  });
}

function payment(over: Record<string, unknown> = {}) {
  return {
    status: "approved",
    transaction_amount: 21300,
    currency_id: "ARS",
    external_reference: PID,
    metadata: { type: "hackea-ticket", participation_id: PID },
    ...over,
  };
}

const participant = {
  id: PID,
  name: "Lucía Fernández",
  phone: "+5491122334455",
  email: "lucia@example.com",
};

function confirmed(over: Record<string, unknown> = {}) {
  return { outcome: "confirmed", participant, underpaid: false, ...over };
}

function subjects(): string[] {
  return emailsSend.mock.calls.map((c) => (c[0] as { subject: string }).subject);
}

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  paymentGet.mockResolvedValue(payment());
  confirmHackeaPayment.mockResolvedValue(confirmed());
  emailsSend.mockResolvedValue({ data: { id: "re_1" }, error: null });
  deliveryRow = { status: "confirmed", external_payment_id: PAY, metadata: {} };
  confirmedCount = 3;
});

describe("POST /api/hackea/webhook", () => {
  it("rejects a bad signature with 401 and touches nothing", async () => {
    const res = await POST(signed(PAY, { secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(paymentGet).not.toHaveBeenCalled();
    expect(redisStore.size).toBe(0);
  });

  it("rejects an unsigned request with 401", async () => {
    const req = new Request("http://localhost/api/hackea/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "payment", data: { id: PAY } }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it("non-approved payment: 200, no confirm, claim released for the later approval", async () => {
    paymentGet.mockResolvedValue(payment({ status: "pending" }));
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(confirmHackeaPayment).not.toHaveBeenCalled();
    expect(redisStore.has(`hackea:payment:${PAY}`)).toBe(false);
  });

  it("ignores a payment whose metadata.type belongs to another flow", async () => {
    paymentGet.mockResolvedValue(payment({ metadata: { type: "ticket" } }));
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(confirmHackeaPayment).not.toHaveBeenCalled();
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("confirmed: confirms with the paid amount, sends both mails, sets both flags", async () => {
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(confirmHackeaPayment).toHaveBeenCalledWith({
      participationId: PID,
      paymentId: PAY,
      amountCents: 2_130_000,
      currency: "ARS",
    });
    expect(emailsSend).toHaveBeenCalledTimes(2);
    const [buyer, host] = emailsSend.mock.calls.map((c) => c[0]);
    expect(buyer.to).toBe("lucia@example.com");
    expect(buyer.html).toContain(PID);
    expect(host.to).toEqual(["hari@example.com", "ops@example.com"]);
    expect(host.html).toContain("https://wa.me/5491122334455?text=");
    expect(host.html).toContain(">3</td>");
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "buyerEmailSent");
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "hostNotified");
    expect(redisStore.get(`hackea:payment:${PAY}`)).toBe(PID);
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();
    expect(sendMetaEvent).toHaveBeenCalledTimes(1);
  });

  it("falls back to metadata.participation_id when external_reference is missing", async () => {
    paymentGet.mockResolvedValue(payment({ external_reference: null }));
    await POST(signed());
    expect(confirmHackeaPayment.mock.calls[0][0]).toMatchObject({
      participationId: PID,
    });
  });

  it("retry with both flags already set sends nothing", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    deliveryRow = {
      status: "confirmed",
      external_payment_id: PAY,
      metadata: { buyerEmailSent: true, hostNotified: true },
    };
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(emailsSend).not.toHaveBeenCalled();
    expect(markHackeaFlag).not.toHaveBeenCalled();
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();
  });

  it("retry after only the buyer mail went out sends only the host mail", async () => {
    redisStore.set(`hackea:payment:${PAY}`, PID);
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    deliveryRow = {
      status: "confirmed",
      external_payment_id: PAY,
      metadata: { buyerEmailSent: true },
    };
    await POST(signed());
    expect(subjects()).toEqual(["Nueva entrada Hackeá tu mente — Lucía Fernández"]);
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "hostNotified");
  });

  it("phone-only buyer: no buyer mail, host mail says 'sin email'", async () => {
    confirmHackeaPayment.mockResolvedValue(
      confirmed({ participant: { ...participant, email: null } }),
    );
    await POST(signed());
    expect(emailsSend).toHaveBeenCalledTimes(1);
    const host = emailsSend.mock.calls[0][0];
    expect(host.html).toContain("sin email");
    expect(markHackeaFlag).toHaveBeenCalledTimes(1);
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "hostNotified");
  });

  it("a failed send leaves its flag unset so the next delivery retries", async () => {
    emailsSend
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } })
      .mockResolvedValueOnce({ data: { id: "re_2" }, error: null });
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(markHackeaFlag).toHaveBeenCalledTimes(1);
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "hostNotified");
  });

  it("capacity: admin alert, no mails", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "capacity" }));
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
    expect(notifyAdminOfIncident.mock.calls[0][0]).toMatchObject({
      subject: expect.stringContaining("sin cupo"),
    });
    expect(emailsSend).not.toHaveBeenCalled();
    expect(sendMetaEvent).not.toHaveBeenCalled();
  });

  it("not_found: admin alert, no mails", async () => {
    confirmHackeaPayment.mockResolvedValue({
      outcome: "not_found",
      underpaid: false,
    });
    const res = await POST(signed());
    expect(res.status).toBe(200);
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
    expect(notifyAdminOfIncident.mock.calls[0][0]).toMatchObject({
      subject: expect.stringContaining("inexistente"),
    });
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("underpaid: admin alert (the entrada still confirms and mails go out)", async () => {
    paymentGet.mockResolvedValue(payment({ transaction_amount: 100 }));
    confirmHackeaPayment.mockResolvedValue(confirmed({ underpaid: true }));
    await POST(signed());
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
    expect(notifyAdminOfIncident.mock.calls[0][0]).toMatchObject({
      subject: expect.stringContaining("debajo del precio"),
    });
    expect(emailsSend).toHaveBeenCalledTimes(2);
  });

  it("second distinct payment for a paid entrada: admin alert, no re-delivery", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    deliveryRow = {
      status: "confirmed",
      external_payment_id: "999-FIRST",
      metadata: { buyerEmailSent: true, hostNotified: true },
    };
    await POST(signed());
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
    const alert = notifyAdminOfIncident.mock.calls[0][0] as {
      subject: string;
      lines: string[];
    };
    expect(alert.subject).toContain("segundo pago");
    expect(alert.lines.join("\n")).toContain("999-FIRST");
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it("a duplicate delivery of an already-processed payment does not re-alert", async () => {
    redisStore.set(`hackea:payment:${PAY}`, PID);
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "capacity" }));
    await POST(signed());
    expect(notifyAdminOfIncident).not.toHaveBeenCalled();
  });

  it("releases the claim when a step throws, so MP's retry gets a clean run", async () => {
    confirmHackeaPayment.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(signed());
    expect(res.status).toBe(500);
    expect(redisStore.has(`hackea:payment:${PAY}`)).toBe(false);

    const retry = await POST(signed());
    expect(retry.status).toBe(200);
    expect(emailsSend).toHaveBeenCalledTimes(2);
  });

  it("releases the claim when the MP fetch throws", async () => {
    paymentGet.mockRejectedValueOnce(new Error("MP 503"));
    const res = await POST(signed());
    expect(res.status).toBe(500);
    expect(redisStore.has(`hackea:payment:${PAY}`)).toBe(false);
  });

  it("two concurrent deliveries of the same payment are processed once", async () => {
    let releaseGet: () => void = () => {};
    paymentGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseGet = () => resolve(payment());
        }),
    );
    const first = POST(signed());
    // Let the first request take the claim and block on Payment.get.
    await new Promise((r) => setTimeout(r, 0));
    const second = await POST(signed());
    expect(await second.json()).toMatchObject({ status: "processing" });
    releaseGet();
    expect((await first).status).toBe(200);

    expect(confirmHackeaPayment).toHaveBeenCalledTimes(1);
    expect(emailsSend).toHaveBeenCalledTimes(2);
  });
});
