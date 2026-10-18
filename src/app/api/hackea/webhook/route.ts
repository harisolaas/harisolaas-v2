import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { Payment } from "mercadopago";
import { Resend } from "resend";
import { db } from "@/db";
import { getRedis } from "@/lib/redis";
import { getMp, verifyMpSignature } from "@/lib/mp-server";
import {
  confirmHackeaPayment,
  markHackeaFlag,
  type HackeaParticipant,
} from "@/lib/hackea";
import {
  HACKEA_BUYER_SUBJECT,
  buildHackeaBuyerConfirmationHtml,
  buildHackeaHostNotificationHtml,
  hackeaHostSubject,
} from "@/lib/hackea-email";
import { notifyAdminOfIncident } from "@/lib/admin-alert";
import { sendMetaEvent } from "@/lib/meta-capi";
import { HACKEA_PAYMENT_TYPE, hackeaConfig } from "@/data/hackea";

// MercadoPago webhook target for Hackeá tu mente entradas. Shares
// MP_ACCESS_TOKEN and MP_WEBHOOK_SECRET with every other MP flow, so
// payments whose metadata.type isn't ours are acknowledged and ignored.
//
// Delivery (buyer mail, host mail) is guarded by per-mail claims on
// participations.metadata, not by the Redis key: a retry after a partial
// failure sends exactly what's still missing, and two concurrent deliveries
// can't both send the same mail. Admin alerts and the CAPI Purchase are
// guarded by per-payment Redis markers.

const PROCESSING = "__processing__";
const KEY_TTL_SECONDS = 60 * 60 * 24 * 90;

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

function notifyList(): string[] {
  return (
    process.env.HACKEA_NOTIFY_EMAILS ||
    process.env.SINERGIA_NOTIFY_EMAILS ||
    ""
  )
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

interface DeliveryRow {
  status: string;
  externalPaymentId: string | null;
  metadata: Record<string, unknown>;
}

async function loadDeliveryRow(
  participationId: string,
): Promise<DeliveryRow | null> {
  const res = await db.execute<{
    status: string;
    external_payment_id: string | null;
    metadata: Record<string, unknown> | null;
  }>(sql`
    SELECT status, external_payment_id, metadata
    FROM participations WHERE id = ${participationId}
  `);
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    status: row.status,
    externalPaymentId: row.external_payment_id,
    metadata: row.metadata ?? {},
  };
}

async function countConfirmed(): Promise<number> {
  const res = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM participations
    WHERE event_id = ${hackeaConfig.eventId} AND status IN ('confirmed', 'used')
  `);
  return Number(res.rows?.[0]?.n ?? 0);
}

async function sendMail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
  try {
    const res = await getResend().emails.send({
      from: `Hackeá tu mente <${fromEmail}>`,
      ...params,
    });
    if (res?.error) {
      console.error("Hackea email rejected:", params.subject, res.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Hackea email failed:", params.subject, err);
    return false;
  }
}

// ── Per-mail claims ──────────────────────────────────────────────────
// MP sends payment.created and payment.updated within milliseconds, and a
// retry can land while the first delivery is still mid-send. Each mail is
// claimed in the participation row before it goes out: the flag moves
// NULL → "sending" atomically, then → true once Resend accepts it. Only the
// request that wins the UPDATE sends.
//
// A "sending" older than STALE_SENDING_MS is reclaimable: it means the
// process died between the claim and the flag (crash, timeout). The cost is
// a possible duplicate if it died AFTER Resend accepted the mail; the
// alternative — never reclaiming — loses the mail for good.

type MailFlag = "buyerEmailSent" | "hostNotified";
const SENDING = "sending";
const STALE_SENDING_MS = 5 * 60 * 1000;

type ClaimResult = "claimed" | "done" | "busy";

async function claimMail(
  participationId: string,
  flag: MailFlag,
): Promise<ClaimResult> {
  const atKey = `${flag}SendingAt`;
  const now = Date.now();
  const res = await db.execute<{ id: string }>(sql`
    UPDATE participations SET
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object(${flag}::text, ${SENDING}::text, ${atKey}::text, ${now}::bigint),
      updated_at = NOW()
    WHERE id = ${participationId}
      AND (
        metadata->>${flag} IS NULL
        OR (
          metadata->>${flag} = ${SENDING}
          AND COALESCE((metadata->>${atKey})::bigint, 0) < ${now - STALE_SENDING_MS}
        )
      )
    RETURNING id
  `);
  if (res.rows?.length) return "claimed";
  const cur = await db.execute<{ v: string | null }>(sql`
    SELECT metadata->>${flag} AS v FROM participations WHERE id = ${participationId}
  `);
  return cur.rows?.[0]?.v === SENDING ? "busy" : "done";
}

/** Undo a claim whose send failed, so the next delivery can take it. */
async function releaseMail(
  participationId: string,
  flag: MailFlag,
): Promise<void> {
  const atKey = `${flag}SendingAt`;
  await db.execute(sql`
    UPDATE participations SET
      metadata = metadata - ${flag}::text - ${atKey}::text,
      updated_at = NOW()
    WHERE id = ${participationId} AND metadata->>${flag} = ${SENDING}
  `);
}

/** "retry" when the mail is still unsent (failed, or claimed elsewhere). */
async function sendClaimed(
  participationId: string,
  flag: MailFlag,
  mail: () => Promise<{ to: string | string[]; subject: string; html: string }>,
): Promise<"ok" | "retry"> {
  const claim = await claimMail(participationId, flag);
  if (claim === "done") return "ok";
  // Another delivery holds it. Answer non-2xx so MP comes back: if that
  // delivery dies, its claim goes stale and a later retry picks it up.
  if (claim === "busy") return "retry";
  const sent = await sendMail(await mail());
  if (!sent) {
    await releaseMail(participationId, flag);
    return "retry";
  }
  await markHackeaFlag(participationId, flag);
  return "ok";
}

async function deliver(
  participant: HackeaParticipant,
  amountCents: number,
): Promise<"ok" | "retry"> {
  let outcome: "ok" | "retry" = "ok";

  if (participant.email) {
    const email = participant.email;
    const r = await sendClaimed(participant.id, "buyerEmailSent", async () => ({
      to: email,
      subject: HACKEA_BUYER_SUBJECT,
      html: buildHackeaBuyerConfirmationHtml({
        name: participant.name,
        participationId: participant.id,
      }),
    }));
    if (r === "retry") outcome = "retry";
  }

  const to = notifyList();
  if (to.length === 0) {
    console.warn("Hackea: no HACKEA_NOTIFY_EMAILS, host not notified");
    return outcome;
  }
  const r = await sendClaimed(participant.id, "hostNotified", async () => ({
    to,
    subject: hackeaHostSubject(participant.name),
    html: buildHackeaHostNotificationHtml({
      name: participant.name,
      phone: participant.phone,
      email: participant.email,
      participationId: participant.id,
      // What MP actually charged, not the list price: an underpaid payment
      // must look like one in the host's inbox.
      amountCents,
      totalConfirmed: await countConfirmed(),
    }),
  }));
  return r === "retry" ? "retry" : outcome;
}

type RedisClient = Awaited<ReturnType<typeof getRedis>>;

class AlertNotDelivered extends Error {}

/**
 * Admin alert, at most once per marker — and at least once: the marker is
 * only kept once the alert is out. When it doesn't go out, the marker is
 * dropped and this throws, so the route answers 500 and MP's retry alerts
 * again (confirmHackeaPayment is idempotent, so re-running it is safe).
 */
async function alertOnce(
  redis: RedisClient,
  markerKey: string,
  input: { subject: string; lines: string[] },
): Promise<void> {
  const claimed = await redis.set(markerKey, PROCESSING, { NX: true, EX: 300 });
  if (!claimed) return; // sent already, or in flight in another delivery
  let res: { notified: boolean; reason?: string };
  try {
    res = await notifyAdminOfIncident(input);
  } catch (err) {
    await redis.del(markerKey);
    throw err;
  }
  if (!res.notified) {
    await redis.del(markerKey);
    throw new AlertNotDelivered(`admin alert not sent: ${res.reason ?? "?"}`);
  }
  await redis.set(markerKey, "sent", { EX: KEY_TTL_SECONDS });
}

// Statuses that take money back after approval. MP also uses "cancelled"
// for never-approved payments (expired cash vouchers) — those don't match
// the entrada's payment ids and are ignored by handleReversal.
const REVERSED_STATUSES = new Set(["refunded", "charged_back", "cancelled"]);

/**
 * A refund/chargeback of a payment we recorded. Writes `metadata.refund`
 * (primary payment only) and alerts once per payment+status. The
 * participation is NOT cancelled: Hari decides what happens to the entrada.
 * Returns false when the payment isn't one this participation holds.
 */
async function handleReversal(
  redis: RedisClient,
  params: {
    participationId: string;
    mpPaymentId: string;
    status: string;
    alertLines: string[];
  },
): Promise<boolean> {
  const row = await loadDeliveryRow(params.participationId);
  if (!row) return false;
  const extra = Array.isArray(row.metadata.extraPaymentIds)
    ? (row.metadata.extraPaymentIds as unknown[]).map(String)
    : [];
  const isPrimary = row.externalPaymentId === params.mpPaymentId;
  const linked =
    isPrimary ||
    extra.includes(params.mpPaymentId) ||
    row.metadata.overflowPaymentId === params.mpPaymentId;
  if (!linked) return false;

  if (isPrimary) {
    await db.execute(sql`
      UPDATE participations SET
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'refund', jsonb_build_object(
            'status', ${params.status}::text,
            'paymentId', ${params.mpPaymentId}::text,
            'at', ${new Date().toISOString()}::text
          )
        ),
        updated_at = NOW()
      WHERE id = ${params.participationId}
    `);
  }

  await alertOnce(
    redis,
    `hackea:refund:${params.mpPaymentId}:${params.status}`,
    {
      subject: `Hackeá tu mente: pago ${params.status}`,
      lines: [
        ...params.alertLines,
        `Estado de la participación: ${row.status}`,
        isPrimary
          ? "Es el pago de la entrada. Quedó en metadata.refund; la participación NO se canceló, decidí a mano."
          : "Era un pago extra o sin cupo, no el de la entrada.",
      ],
    },
  );
  return true;
}

/**
 * Meta CAPI Purchase, once per payment. user_data comes from what the
 * checkout stashed (ip, ua, fbp, fbc): Meta rejects a `website` event with
 * empty user_data, so no stash means no event.
 */
async function sendPurchaseOnce(
  redis: RedisClient,
  params: {
    participationId: string;
    mpPaymentId: string;
    amountCents: number;
    currency: string;
  },
): Promise<void> {
  let stash: { ip?: string; ua?: string; fbp?: string; fbc?: string } | null =
    null;
  try {
    const raw = await redis.get(`hackea:checkout:${params.participationId}`);
    stash = raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("hackea: failed to read checkout stash:", err);
  }
  if (!stash || (!stash.ip && !stash.ua)) {
    console.warn("hackea: no checkout stash, Purchase not sent", params);
    return;
  }
  const claimed = await redis.set(`hackea:capi:${params.mpPaymentId}`, "1", {
    NX: true,
    EX: KEY_TTL_SECONDS,
  });
  if (!claimed) return;
  sendMetaEvent({
    event_name: "Purchase",
    event_id: `hackea-purchase-${params.participationId}`,
    event_source_url: `https://www.harisolaas.com${hackeaConfig.landingPath}`,
    user_data: {
      client_ip_address: stash.ip || undefined,
      client_user_agent: stash.ua || undefined,
      fbp: stash.fbp || undefined,
      fbc: stash.fbc || undefined,
    },
    custom_data: {
      currency: params.currency,
      value: params.amountCents / 100,
      content_name: "Hackeá tu mente",
      num_items: 1,
    },
  }).catch(() => {}); // fire and forget
}

export async function POST(req: Request) {
  const body = await req.text();

  let parsed: { type?: string; data?: { id?: string | number } };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const mpPaymentId = String(parsed.data?.id ?? "");

  if (!verifyMpSignature(req, mpPaymentId)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (parsed.type !== "payment") {
    return NextResponse.json({ ok: true });
  }
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();
  const key = `hackea:payment:${mpPaymentId}`;

  // Atomic claim so two concurrent deliveries of the same notification
  // don't both run. A later delivery that finds the final participationId
  // re-runs the (idempotent) confirm; mails, alerts and CAPI have their own
  // once-only guards, so it only does what's still missing.
  const claimed = await redis.set(key, PROCESSING, { NX: true, EX: 300 });
  if (!claimed) {
    const val = await redis.get(key);
    if (!val || val === PROCESSING) {
      return NextResponse.json({ ok: true, status: "processing" });
    }
  }
  const fresh = Boolean(claimed);
  const release = async () => {
    if (fresh) await redis.del(key);
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment: any = await new Payment(getMp()).get({ id: mpPaymentId });
    const ours = payment.metadata?.type === HACKEA_PAYMENT_TYPE;

    const fromExternal =
      typeof payment.external_reference === "string"
        ? payment.external_reference
        : "";
    const fromMetadata =
      typeof payment.metadata?.participation_id === "string"
        ? payment.metadata.participation_id
        : "";
    const participationId = fromExternal || fromMetadata;

    const amountCents = Math.round(
      Number(payment.transaction_amount ?? 0) * 100,
    );
    const currency: string = payment.currency_id ?? "ARS";
    const alertLines = [
      `Pago MP: ${mpPaymentId}`,
      `Participación: ${participationId || "(sin referencia)"}`,
      `Monto: ${amountCents / 100} ${currency}`,
    ];

    if (payment.status !== "approved") {
      if (ours && participationId && REVERSED_STATUSES.has(payment.status)) {
        await handleReversal(redis, {
          participationId,
          mpPaymentId,
          status: payment.status,
          alertLines,
        });
      }
      // MP notifies again with the same id when the status changes
      // (pending → approved): don't let the claim swallow that one.
      await release();
      return NextResponse.json({ ok: true, status: payment.status });
    }

    if (!ours) {
      await release();
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!participationId) {
      await alertOnce(redis, `hackea:alert:${mpPaymentId}:no_reference`, {
        subject: "Hackeá tu mente: pago aprobado sin referencia",
        lines: alertLines,
      });
      await redis.set(key, "__no_reference__", { EX: KEY_TTL_SECONDS });
      return NextResponse.json({ ok: true, status: "no_reference" });
    }

    const result = await confirmHackeaPayment({
      participationId,
      paymentId: mpPaymentId,
      amountCents,
      currency,
    });
    await redis.set(key, participationId, { EX: KEY_TTL_SECONDS });

    const row =
      result.outcome === "confirmed" || result.outcome === "already"
        ? await loadDeliveryRow(participationId)
        : null;
    const secondPayment =
      result.outcome === "already" &&
      row != null &&
      row.externalPaymentId !== mpPaymentId;

    // Money alerts are keyed per payment in Redis, not on `fresh`: a retry
    // after a failed alert must alert again, a retry after a sent one must
    // not. alertOnce throws when the alert didn't go out → 500 → MP retries.
    const alertKey = (kind: string) => `hackea:alert:${mpPaymentId}:${kind}`;
    if (result.outcome === "capacity") {
      await alertOnce(redis, alertKey("capacity"), {
        subject: "Hackeá tu mente: pago aprobado sin cupo",
        lines: [
          ...alertLines,
          "La participación quedó pending con metadata.overflowPaymentId. Reintegrar o hacer lugar a mano.",
        ],
      });
    }
    if (result.outcome === "not_found") {
      await alertOnce(redis, alertKey("not_found"), {
        subject: "Hackeá tu mente: pago aprobado de una participación inexistente",
        lines: alertLines,
      });
    }
    if (result.underpaid) {
      await alertOnce(redis, alertKey("underpaid"), {
        subject: "Hackeá tu mente: pago por debajo del precio",
        lines: [
          ...alertLines,
          `Precio esperado: ${hackeaConfig.ticketPriceCents / 100} ARS`,
        ],
      });
    }
    if (secondPayment) {
      await alertOnce(redis, alertKey("second_payment"), {
        subject: "Hackeá tu mente: segundo pago para una entrada ya pagada",
        lines: [
          ...alertLines,
          `Pago original: ${row?.externalPaymentId ?? "(desconocido)"}`,
          "Quedó en metadata.extraPaymentIds. Reintegrar a mano.",
        ],
      });
    }

    if (row && result.participant && !secondPayment) {
      await sendPurchaseOnce(redis, {
        participationId,
        mpPaymentId,
        amountCents,
        currency,
      });
      // Admin status wins: an entrada cancelled or set back to `pending`
      // by hand gets no "confirmada" mail from a redelivery, and no claim.
      const active = row.status === "confirmed" || row.status === "used";
      if (
        active &&
        (await deliver(result.participant, amountCents)) === "retry"
      ) {
        // A mail is still unsent: non-2xx so MP delivers again. Everything
        // above is idempotent or marker-guarded on that retry.
        await release();
        return NextResponse.json({ error: "delivery" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      participationId,
    });
  } catch (err) {
    console.error("Hackea webhook failed:", mpPaymentId, err);
    // Release the claim so MP's retry gets a clean run instead of being
    // told "processing" for five minutes.
    await release().catch(() => {});
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
