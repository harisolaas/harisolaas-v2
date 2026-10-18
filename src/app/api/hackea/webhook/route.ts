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
// Delivery (buyer mail, host mail) is guarded by flags on
// participations.metadata, not by the Redis key: a retry after a partial
// failure sends exactly what's still missing.

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
    // Don't fail the webhook: the flag is only set after a successful
    // send, so the next delivery of this notification tries again.
    console.error("Hackea email failed:", params.subject, err);
    return false;
  }
}

async function deliver(
  participant: HackeaParticipant,
  row: DeliveryRow,
): Promise<void> {
  if (participant.email && !row.metadata.buyerEmailSent) {
    const sent = await sendMail({
      to: participant.email,
      subject: HACKEA_BUYER_SUBJECT,
      html: buildHackeaBuyerConfirmationHtml({
        name: participant.name,
        participationId: participant.id,
      }),
    });
    if (sent) await markHackeaFlag(participant.id, "buyerEmailSent");
  }

  if (!row.metadata.hostNotified) {
    const to = notifyList();
    if (to.length === 0) {
      console.warn("Hackea: no HACKEA_NOTIFY_EMAILS, host not notified");
      return;
    }
    const sent = await sendMail({
      to,
      subject: hackeaHostSubject(participant.name),
      html: buildHackeaHostNotificationHtml({
        name: participant.name,
        phone: participant.phone,
        email: participant.email,
        participationId: participant.id,
        amountCents: hackeaConfig.ticketPriceCents,
        totalConfirmed: await countConfirmed(),
      }),
    });
    if (sent) await markHackeaFlag(participant.id, "hostNotified");
  }
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
  // can't both confirm + mail. A later delivery that finds the final
  // participationId re-runs the (idempotent) confirm and only sends what
  // the flags say is missing — no admin alerts on that path.
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

    if (payment.status !== "approved") {
      // MP notifies again with the same id when the status changes
      // (pending → approved): don't let the claim swallow that one.
      await release();
      return NextResponse.json({ ok: true, status: payment.status });
    }

    if (payment.metadata?.type !== HACKEA_PAYMENT_TYPE) {
      await release();
      return NextResponse.json({ ok: true, ignored: true });
    }

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
    const alertLines = [
      `Pago MP: ${mpPaymentId}`,
      `Participación: ${participationId || "(sin referencia)"}`,
      `Monto: ${amountCents / 100} ${payment.currency_id ?? "ARS"}`,
    ];

    if (!participationId) {
      await redis.set(key, "__no_reference__", { EX: KEY_TTL_SECONDS });
      if (fresh) {
        await notifyAdminOfIncident({
          subject: "Hackeá tu mente: pago aprobado sin referencia",
          lines: alertLines,
        });
      }
      return NextResponse.json({ ok: true, status: "no_reference" });
    }

    const result = await confirmHackeaPayment({
      participationId,
      paymentId: mpPaymentId,
      amountCents,
      currency: payment.currency_id ?? "ARS",
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

    if (fresh) {
      if (result.outcome === "capacity") {
        await notifyAdminOfIncident({
          subject: "Hackeá tu mente: pago aprobado sin cupo",
          lines: [
            ...alertLines,
            "La participación quedó pending con metadata.overflowPaymentId. Reintegrar o hacer lugar a mano.",
          ],
        });
      }
      if (result.outcome === "not_found") {
        await notifyAdminOfIncident({
          subject: "Hackeá tu mente: pago aprobado de una participación inexistente",
          lines: alertLines,
        });
      }
      if (result.underpaid) {
        await notifyAdminOfIncident({
          subject: "Hackeá tu mente: pago por debajo del precio",
          lines: [
            ...alertLines,
            `Precio esperado: ${hackeaConfig.ticketPriceCents / 100} ARS`,
          ],
        });
      }
      if (secondPayment) {
        await notifyAdminOfIncident({
          subject: "Hackeá tu mente: segundo pago para una entrada ya pagada",
          lines: [
            ...alertLines,
            `Pago original: ${row?.externalPaymentId ?? "(desconocido)"}`,
            "Quedó en metadata.extraPaymentIds. Reintegrar a mano.",
          ],
        });
      }
    }

    if (row && result.participant && !secondPayment) {
      await deliver(result.participant, row);
    }

    if (fresh && result.outcome === "confirmed") {
      sendMetaEvent({
        event_name: "Purchase",
        event_id: `hackea-purchase-${participationId}`,
        event_source_url: `https://www.harisolaas.com${hackeaConfig.landingPath}`,
        custom_data: {
          currency: payment.currency_id ?? "ARS",
          value: amountCents / 100,
          content_name: "Hackeá tu mente",
          num_items: 1,
        },
      }).catch(() => {}); // fire and forget
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
