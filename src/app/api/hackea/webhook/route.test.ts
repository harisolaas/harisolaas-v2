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

// ── DB: the route's reads + its per-mail claim/release/refund writes,
// applied to deliveryRow.metadata so the claim semantics are real ──────
let deliveryRow: {
  status: string;
  external_payment_id: string | null;
  metadata: Record<string, unknown>;
} | null = null;
let confirmedCount = 3;
function isText(c: unknown): c is { value: string[] } {
  return Boolean(c && typeof c === "object" && "value" in c);
}
function sqlText(q: { queryChunks?: unknown[] }): string {
  return (q.queryChunks ?? [])
    .map((c) => (isText(c) ? c.value.join("") : "?"))
    .join("");
}
function sqlParams(q: { queryChunks?: unknown[] }): unknown[] {
  return (q.queryChunks ?? []).filter((c) => !isText(c));
}
const dbExecute = vi.fn(async (q: { queryChunks?: unknown[] }) => {
  const text = sqlText(q);
  const params = sqlParams(q);
  const meta = deliveryRow?.metadata;
  if (text.includes("COUNT(*)")) return { rows: [{ n: confirmedCount }] };
  if (text.includes("RETURNING id")) {
    // claimMail: flag, "sending", atKey, now, id, flag, flag, "sending", atKey, staleBefore
    const [flag, sending, atKey, now] = params as [string, string, string, number];
    const staleBefore = params[params.length - 1] as number;
    if (!meta) return { rows: [] };
    const cur = meta[flag];
    const claimable =
      cur == null || (cur === sending && Number(meta[atKey] ?? 0) < staleBefore);
    if (!claimable) return { rows: [] };
    meta[flag] = sending;
    meta[atKey] = now;
    return { rows: [{ id: "claimed" }] };
  }
  if (text.includes("AS v FROM participations")) {
    const v = meta?.[params[0] as string];
    return { rows: deliveryRow ? [{ v: v == null ? null : String(v) }] : [] };
  }
  if (text.includes("metadata = metadata -")) {
    const [flag, atKey] = params as [string, string];
    if (meta && meta[flag] === "sending") {
      delete meta[flag];
      delete meta[atKey];
    }
    return { rows: [] };
  }
  if (text.includes("'refund'")) {
    const [status, paymentId, at] = params as [string, string, string];
    // Honour the route's guard: only while the row still holds the payment.
    const guarded = text.includes("AND external_payment_id =");
    const heldNow = deliveryRow?.external_payment_id === params[params.length - 1];
    if (meta && (!guarded || heldNow)) meta.refund = { status, paymentId, at };
    return { rows: [] };
  }
  if (text.includes("FROM participations WHERE id")) {
    return { rows: deliveryRow ? [deliveryRow] : [] };
  }
  throw new Error("unexpected query: " + text);
});
vi.mock("@/db", () => ({ db: { execute: (q: never) => dbExecute(q) } }));

// ── The lib boundary ─────────────────────────────────────────────────
const confirmHackeaPayment = vi.fn();
const markHackeaFlag = vi.fn(async (_id: string, flag: string) => {
  if (deliveryRow) deliveryRow.metadata[flag] = true;
});
vi.mock("@/lib/hackea", () => ({
  confirmHackeaPayment: (...a: unknown[]) => confirmHackeaPayment(...a),
  markHackeaFlag: (...a: unknown[]) =>
    markHackeaFlag(...(a as [string, string])),
}));

const notifyAdminOfIncident = vi.fn<
  (i: unknown) => Promise<{ notified: boolean; reason?: string }>
>(async () => ({ notified: true }));
vi.mock("@/lib/admin-alert", () => ({
  notifyAdminOfIncident: (...a: unknown[]) =>
    notifyAdminOfIncident(...(a as [])),
}));
const sendMetaEvent = vi.fn<(e: unknown) => Promise<{ ok: boolean }>>(
  async () => ({ ok: true }),
);
vi.mock("@/lib/meta-capi", () => ({
  sendMetaEvent: (...a: unknown[]) => sendMetaEvent(...(a as [])),
}));

const { POST } = await import("./route");
const { HACKEA_BUYER_SUBJECT: BUYER_SUBJECT } = await import("@/lib/hackea-email");

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

/** What the checkout route stashes for CAPI. */
function stash() {
  redisStore.set(
    `hackea:checkout:${PID}`,
    JSON.stringify({
      ip: "190.0.0.1",
      ua: "Mozilla/5.0",
      fbp: "fb.1.1.abc",
      fbc: "fb.1.1.click",
      eventId: `hackea-checkout-${PID}`,
    }),
  );
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
    stash();
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
    expect(sendMetaEvent.mock.calls[0][0]).toMatchObject({
      event_name: "Purchase",
      user_data: {
        client_ip_address: "190.0.0.1",
        client_user_agent: "Mozilla/5.0",
        fbp: "fb.1.1.abc",
        fbc: "fb.1.1.click",
      },
      custom_data: { value: 21300, currency: "ARS" },
    });
  });

  it("CAPI Purchase: not sent without a checkout stash (Meta rejects empty user_data)", async () => {
    await POST(signed());
    expect(sendMetaEvent).not.toHaveBeenCalled();
  });

  it("CAPI Purchase goes out on a retry after a crash, and only once per payment", async () => {
    stash();
    // Crash after confirm, before anything else: MP retries.
    dbExecute.mockRejectedValueOnce(new Error("db blip"));
    expect((await POST(signed())).status).toBe(500);
    expect(sendMetaEvent).not.toHaveBeenCalled();

    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    expect((await POST(signed())).status).toBe(200);
    expect(sendMetaEvent).toHaveBeenCalledTimes(1);

    await POST(signed());
    expect(sendMetaEvent).toHaveBeenCalledTimes(1);
  });

  it("CAPI Purchase event_id is per payment, so a repurchase on the same row isn't deduped", async () => {
    stash();
    await POST(signed());
    expect(sendMetaEvent).toHaveBeenCalledTimes(1);
    expect(sendMetaEvent.mock.calls[0][0]).toMatchObject({
      event_name: "Purchase",
      event_id: `hackea-purchase-${PID}-${PAY}`,
    });
  });

  it("host mail shows what MP charged, not the list price", async () => {
    paymentGet.mockResolvedValue(payment({ transaction_amount: 18000 }));
    await POST(signed());
    const host = emailsSend.mock.calls[1][0];
    expect(host.html).toContain("$18.000");
    expect(host.html).not.toContain("$21.300");
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

  it("a failed send releases its claim and answers 500 so MP retries just that mail", async () => {
    emailsSend
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } })
      .mockResolvedValueOnce({ data: { id: "re_2" }, error: null });
    const res = await POST(signed());
    expect(res.status).toBe(500);
    expect(markHackeaFlag).toHaveBeenCalledTimes(1);
    expect(markHackeaFlag).toHaveBeenCalledWith(PID, "hostNotified");
    expect(deliveryRow?.metadata.buyerEmailSent).toBeUndefined();

    emailsSend.mockClear();
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    expect((await POST(signed())).status).toBe(200);
    expect(subjects()).toEqual([BUYER_SUBJECT]);
    expect(deliveryRow?.metadata.buyerEmailSent).toBe(true);
  });

  it("a delivery arriving mid-send (Redis key already final) doesn't resend the same mails", async () => {
    // payment.created + payment.updated: the first delivery is inside
    // Resend when the second one lands.
    let releaseSend: () => void = () => {};
    emailsSend.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSend = () => resolve({ data: { id: "re_1" }, error: null });
        }),
    );
    const first = POST(signed());
    await vi.waitFor(() => expect(emailsSend).toHaveBeenCalledTimes(1));
    expect(redisStore.get(`hackea:payment:${PAY}`)).toBe(PID);

    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    const second = await POST(signed());
    // The buyer mail is claimed by the first delivery: the second asks MP
    // to come back instead of sending it again.
    expect(second.status).toBe(500);
    releaseSend();
    expect((await first).status).toBe(200);

    const sent = subjects();
    expect(sent).toHaveLength(2);
    expect(new Set(sent).size).toBe(2);
  });

  it("a stale 'sending' claim (process died mid-send) is reclaimed", async () => {
    deliveryRow!.metadata = {
      buyerEmailSent: "sending",
      buyerEmailSentSendingAt: Date.now() - 10 * 60 * 1000,
      hostNotified: true,
    };
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    expect((await POST(signed())).status).toBe(200);
    expect(subjects()).toEqual([BUYER_SUBJECT]);
  });

  it("a fresh 'sending' claim held elsewhere is left alone (500, MP retries)", async () => {
    deliveryRow!.metadata = {
      buyerEmailSent: "sending",
      buyerEmailSentSendingAt: Date.now(),
      hostNotified: true,
    };
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    expect((await POST(signed())).status).toBe(500);
    expect(emailsSend).not.toHaveBeenCalled();
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
      // Flags unset on purpose: only the second-payment guard keeps the
      // buyer from getting a second confirmation for the same entrada.
      metadata: {},
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

  it("a duplicate delivery of an already-alerted payment does not re-alert", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "capacity" }));
    await POST(signed());
    await POST(signed());
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
  });

  it("an alert that didn't go out answers 500 and MP's retry alerts again", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "capacity" }));
    notifyAdminOfIncident.mockResolvedValueOnce({
      notified: false,
      reason: "RESEND_API_KEY missing",
    });
    expect((await POST(signed())).status).toBe(500);

    // The retry may find the Redis key final (non-fresh path) — it must
    // still alert.
    redisStore.set(`hackea:payment:${PAY}`, PID);
    expect((await POST(signed())).status).toBe(200);
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(2);

    await POST(signed());
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(2);
  });

  it("second-payment alert is retried too when it fails", async () => {
    confirmHackeaPayment.mockResolvedValue(confirmed({ outcome: "already" }));
    deliveryRow = {
      status: "confirmed",
      external_payment_id: "999-FIRST",
      metadata: { buyerEmailSent: true, hostNotified: true },
    };
    notifyAdminOfIncident.mockRejectedValueOnce(new Error("resend down"));
    expect((await POST(signed())).status).toBe(500);
    expect((await POST(signed())).status).toBe(200);
    expect(notifyAdminOfIncident).toHaveBeenCalledTimes(2);
  });

  describe("refunds / chargebacks", () => {
    beforeEach(() => {
      // The approval was processed earlier: the key holds the participation.
      redisStore.set(`hackea:payment:${PAY}`, PID);
    });

    it.each(["refunded", "charged_back"])(
      "%s on the entrada's payment: records metadata.refund and alerts once, no cancel",
      async (status) => {
        paymentGet.mockResolvedValue(payment({ status }));
        const res = await POST(signed());
        expect(res.status).toBe(200);
        expect(confirmHackeaPayment).not.toHaveBeenCalled();
        expect(deliveryRow?.metadata.refund).toMatchObject({
          status,
          paymentId: PAY,
        });
        expect(deliveryRow?.status).toBe("confirmed");
        expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
        expect(
          (notifyAdminOfIncident.mock.calls[0][0] as { subject: string }).subject,
        ).toContain(status);

        await POST(signed());
        expect(notifyAdminOfIncident).toHaveBeenCalledTimes(1);
        expect(emailsSend).not.toHaveBeenCalled();
      },
    );

    it("a late refund of an old payment doesn't overwrite a newer purchase's refund", async () => {
      // The row was repurchased with a newer payment, itself refunded. The
      // read snapshot is stale (taken before the repurchase landed), so the
      // old payment still looks primary: only the UPDATE's guard stops it.
      const newerRefund = { status: "refunded", paymentId: "999", at: "x" };
      deliveryRow = {
        status: "confirmed",
        external_payment_id: "999",
        metadata: { refund: { ...newerRefund } },
      };
      const stale = { status: "confirmed", external_payment_id: PAY, metadata: {} };
      dbExecute.mockImplementationOnce(async () => ({ rows: [stale] }));
      paymentGet.mockResolvedValue(payment({ status: "refunded" }));
      expect((await POST(signed())).status).toBe(200);
      expect(deliveryRow.metadata.refund).toEqual(newerRefund);
    });

    it("refund alert that fails answers 500 so MP retries it", async () => {
      paymentGet.mockResolvedValue(payment({ status: "refunded" }));
      notifyAdminOfIncident.mockResolvedValueOnce({ notified: false });
      expect((await POST(signed())).status).toBe(500);
      expect((await POST(signed())).status).toBe(200);
      expect(notifyAdminOfIncident).toHaveBeenCalledTimes(2);
    });

    it("a cancelled payment that never paid the entrada is ignored", async () => {
      redisStore.clear();
      deliveryRow = { status: "pending", external_payment_id: null, metadata: {} };
      paymentGet.mockResolvedValue(payment({ status: "cancelled" }));
      expect((await POST(signed())).status).toBe(200);
      expect(notifyAdminOfIncident).not.toHaveBeenCalled();
      expect(deliveryRow.metadata.refund).toBeUndefined();
    });

    it("refund of another flow's payment is ignored", async () => {
      paymentGet.mockResolvedValue(
        payment({ status: "refunded", metadata: { type: "ticket" } }),
      );
      await POST(signed());
      expect(notifyAdminOfIncident).not.toHaveBeenCalled();
    });
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
