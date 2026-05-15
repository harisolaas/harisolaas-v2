import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import { CapacityReachedError, recordParticipation } from "@/lib/community";
import type { AttributionTouch } from "@/lib/community";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";
import {
  buildSinergiaParrafoTicketEmailHtml,
  buildSinergiaParrafoHostNotificationHtml,
  qrDataUrlToBuffer,
} from "@/lib/sinergia-parrafo-email";

const EVENT_ID = sinergiaParrafoConfig.eventId;

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

// HMAC verification — same envelope as BROTE / Sinergia. MP signs
// `id:{dataId};request-id:{xRequestId};ts:{ts};` with the dashboard secret.
function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Dev only: let requests through when the secret is intentionally
    // absent so `next dev` + curl works. In any other env, treat a
    // missing secret as misconfiguration and reject — never let prod or
    // preview silently skip HMAC verification.
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "sinergia-parrafo webhook: signature verification skipped — MP_WEBHOOK_SECRET not set (dev only)",
      );
      return true;
    }
    console.error(
      "sinergia-parrafo webhook rejected: MP_WEBHOOK_SECRET not configured",
    );
    return false;
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v.trim()];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  let dataId: string;
  try {
    const parsed = JSON.parse(body);
    dataId = String(parsed.data?.id ?? "");
  } catch {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  if (hash !== expected) {
    console.warn("sinergia-parrafo webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }
  return true;
}

interface CheckoutMeta {
  name?: string;
  email?: string;
  phone?: string;
  locale?: string;
  attribution?: AttributionTouch | null;
  ip?: string;
  ua?: string;
}

interface TwoForOnePerson {
  name: string;
  email: string;
  phone: string;
}

interface TwoForOneMeta {
  mode: "2x1";
  code: string;
  personOne: TwoForOnePerson;
  personTwo: TwoForOnePerson;
  locale?: string;
  attribution?: AttributionTouch | null;
  ip?: string;
  ua?: string;
}

async function readCheckoutMeta(
  preferenceId: string | undefined,
): Promise<CheckoutMeta | null> {
  if (!preferenceId) return null;
  try {
    const redis = await getRedis();
    const raw = await redis.get(
      `sinergia-parrafo:checkout:${preferenceId}`,
    );
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutMeta;
  } catch (err) {
    console.error("sinergia-parrafo: failed to read checkout meta:", err);
    return null;
  }
}

async function readTwoForOneMeta(
  preferenceId: string | undefined,
): Promise<TwoForOneMeta | null> {
  if (!preferenceId) return null;
  try {
    const redis = await getRedis();
    const raw = await redis.get(`sinergia-parrafo:2x1:checkout:${preferenceId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TwoForOneMeta;
    if (parsed.mode !== "2x1") return null;
    return parsed;
  } catch (err) {
    console.error("sinergia-parrafo: failed to read 2x1 meta:", err);
    return null;
  }
}

async function ensureEvent(): Promise<void> {
  const { eventId, eventName, startIso, capacity } = sinergiaParrafoConfig;
  const eventDate = new Date(startIso);
  const status = eventDate < new Date() ? "past" : "upcoming";
  await db
    .insert(schema.events)
    .values({
      id: eventId,
      type: "sinergia-parrafo",
      series: "sinergia-parrafo",
      name: eventName,
      date: eventDate,
      capacity,
      status,
      landingPath: "/es/sinergia-parrafo",
    })
    .onConflictDoNothing();
}

async function countOccupied(): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, EVENT_ID),
        inArray(schema.participations.status, ["confirmed", "used"]),
      ),
    );
  return Number(res[0]?.n ?? 0);
}

// ─────────── 2x1 helpers ───────────

const TWO_FOR_ONE_PREFIX = "2x1:";

function isTwoForOneIdempotencyValue(v: string): boolean {
  return v.startsWith(TWO_FOR_ONE_PREFIX);
}

function parseTwoForOneIdempotencyValue(
  v: string,
): { primaryId: string; companionId: string } | null {
  if (!isTwoForOneIdempotencyValue(v)) return null;
  const parts = v.slice(TWO_FOR_ONE_PREFIX.length).split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { primaryId: parts[0], companionId: parts[1] };
}

function formatTwoForOneIdempotencyValue(
  primaryId: string,
  companionId: string,
): string {
  return `${TWO_FOR_ONE_PREFIX}${primaryId}:${companionId}`;
}

/** Send one attendee ticket email + flip the `emailSent` flag on the row.
 *  Returns true when the send succeeded; the caller decides what to do on
 *  failure (typically: leave the flag unset and let MP retry the webhook). */
async function sendAttendeeTicketEmail(params: {
  to: string;
  name: string;
  ticketId: string;
  amountCents: number;
  paymentId: string;
  companionName?: string;
  existingMetadata: Record<string, unknown>;
}): Promise<boolean> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
  try {
    const qrDataUrl = await QRCode.toDataURL(params.ticketId, {
      width: 300,
      margin: 2,
      color: { dark: "#0E6BA8", light: "#F1ECDA" },
    });
    await getResend().emails.send({
      from: `Sinergia × Párrafo <${fromEmail}>`,
      to: params.to,
      subject: "Tu lugar para Sinergia × Párrafo (16/05) 📖",
      html: buildSinergiaParrafoTicketEmailHtml({
        name: params.name,
        ticketId: params.ticketId,
        amountCents: params.amountCents,
        paymentId: params.paymentId,
        companionName: params.companionName,
      }),
      attachments: [
        {
          filename: "qr.png",
          content: qrDataUrlToBuffer(qrDataUrl),
          contentType: "image/png",
          contentId: "qr",
        },
      ],
    });
    await db
      .update(schema.participations)
      .set({
        metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
          ...params.existingMetadata,
          emailSent: true,
        })}::jsonb`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.participations.id, params.ticketId));
    return true;
  } catch (err) {
    console.error(
      "sinergia-parrafo: attendee email failed",
      params.ticketId,
      err,
    );
    return false;
  }
}

async function fetchAttendeeRow(participationId: string): Promise<{
  id: string;
  email: string;
  name: string;
  phone: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const rows = await db
    .select({
      id: schema.participations.id,
      email: schema.people.email,
      name: schema.people.name,
      phone: schema.people.phone,
      metadata: schema.participations.metadata,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.id, participationId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email ?? "",
    name: r.name ?? "Asistente",
    phone: r.phone ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}

/** Replay 2x1 webhook: both participations already exist; retry whichever
 *  ticket emails didn't flip `emailSent`. No host notification (already
 *  sent on the original fresh delivery). */
async function handleTwoForOneReplay(
  primaryId: string,
  companionId: string,
  mpPaymentId: string,
  totalAmountCents: number,
): Promise<Response> {
  const primary = await fetchAttendeeRow(primaryId);
  const companion = await fetchAttendeeRow(companionId);
  if (!primary || !companion) {
    console.warn("sinergia-parrafo 2x1: orphaned replay idempotency key", {
      mpPaymentId,
      primaryId,
      companionId,
    });
    return NextResponse.json({ ok: true, replay: "orphaned" });
  }
  if (!primary.metadata.emailSent) {
    await sendAttendeeTicketEmail({
      to: primary.email,
      name: primary.name,
      ticketId: primary.id,
      amountCents: totalAmountCents,
      paymentId: mpPaymentId,
      companionName: companion.name,
      existingMetadata: primary.metadata,
    });
  }
  if (!companion.metadata.emailSent) {
    await sendAttendeeTicketEmail({
      to: companion.email,
      name: companion.name,
      ticketId: companion.id,
      amountCents: totalAmountCents,
      paymentId: mpPaymentId,
      companionName: primary.name,
      existingMetadata: companion.metadata,
    });
  }
  return NextResponse.json({ ok: true, replay: "2x1", primaryId, companionId });
}

export async function POST(req: Request) {
  const body = await req.text();

  if (!verifySignature(req, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: { type?: string; data?: { id?: string } };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (parsed.type !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const mpPaymentId = String(parsed.data?.id ?? "");
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();
  const idempotencyKey = `sinergia-parrafo:payment:${mpPaymentId}`;
  const PROCESSING = "__processing__";

  // Atomic claim: if the key is absent, write the sentinel and get
  // "OK" back; if it already exists, get null. Prevents a race where
  // two concurrent webhook deliveries both read "no existing ticket id"
  // and race through the fresh-payment path, double-creating a
  // participation (or tripping the (person_id, event_id) unique
  // constraint) and double-sending the ticket email.
  const claimed = await redis.set(idempotencyKey, PROCESSING, {
    NX: true,
    EX: 300,
  });

  let existingTicketId: string | null = null;
  if (!claimed) {
    const val = await redis.get(idempotencyKey);
    if (!val || val === PROCESSING) {
      // Another invocation is mid-processing. Bail with 200 so MP
      // doesn't escalate this delivery as failed; the in-flight
      // handler will persist the final ticket id shortly.
      return NextResponse.json({ ok: true, status: "processing" });
    }
    // 2x1 replay: the idempotency value encodes both participation ids.
    // Look up both rows and retry whichever ticket emails didn't send.
    const twoFor = parseTwoForOneIdempotencyValue(val);
    if (twoFor) {
      // Pull payment to recover the total amount for the email body.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payment: any = null;
      try {
        payment = await new Payment(getMp()).get({ id: mpPaymentId });
      } catch {
        // Falling back to config price is fine — the email's amount line
        // is informational; the canonical record is in the DB.
      }
      const amount = payment
        ? Math.round(Number(payment.transaction_amount ?? 0) * 100)
        : sinergiaParrafoConfig.ticketPriceCents;
      return handleTwoForOneReplay(
        twoFor.primaryId,
        twoFor.companionId,
        mpPaymentId,
        amount,
      );
    }
    existingTicketId = val;
  }

  let ticketId: string;
  let buyerEmail: string;
  let buyerName: string;
  let participationMetadata: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  if (existingTicketId) {
    // Participation already exists. Decide whether to retry email.
    const existing = await db
      .select({
        id: schema.participations.id,
        metadata: schema.participations.metadata,
        email: schema.people.email,
        name: schema.people.name,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.id, existingTicketId))
      .limit(1);

    if (existing.length === 0) {
      console.warn("sinergia-parrafo: orphaned MP idempotency key", {
        mpPaymentId,
        existingTicketId,
      });
      return NextResponse.json({ ok: true, ticketId: existingTicketId });
    }

    const row = existing[0];
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    if (meta.emailSent) {
      return NextResponse.json({ ok: true, ticketId: row.id });
    }
    ticketId = row.id;
    buyerEmail = row.email ?? "";
    buyerName = row.name ?? "Asistente";
    participationMetadata = meta;
  } else {
    // New payment — fetch from MP and create participation.
    try {
      payment = await new Payment(getMp()).get({ id: mpPaymentId });
    } catch (err) {
      console.error("sinergia-parrafo: MP payment fetch failed", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // 2x1 dispatch: if the preference was created by the 2x1 checkout, the
    // companion's data lives in a separate Redis stash. Run that path
    // end-to-end and short-circuit the single-ticket flow.
    const twoForOne = await readTwoForOneMeta(
      payment.preference_id as string | undefined,
    );
    if (twoForOne) {
      const totalAmountCents = Math.round(
        Number(payment.transaction_amount ?? 0) * 100,
      );
      const currency = payment.currency_id ?? sinergiaParrafoConfig.currency;

      await ensureEvent();

      const primaryTicketId = `SP-${nanoid(8).toUpperCase()}`;
      const companionTicketId = `SP-${nanoid(8).toUpperCase()}`;

      let primaryResult;
      try {
        primaryResult = await recordParticipation({
          email: twoForOne.personOne.email,
          name: twoForOne.personOne.name,
          phone: twoForOne.personOne.phone || undefined,
          eventId: EVENT_ID,
          participationId: primaryTicketId,
          role: "attendee",
          status: "confirmed",
          externalPaymentId: mpPaymentId,
          priceCents: totalAmountCents,
          currency,
          attribution: twoForOne.attribution ?? undefined,
          bypassLinkSlug: twoForOne.attribution?.linkSlug,
          metadata: {
            twoForOne: {
              code: twoForOne.code,
              role: "primary",
              companionEmail: twoForOne.personTwo.email,
              companionParticipationId: companionTicketId,
            },
          },
        });
      } catch (err) {
        if (err instanceof CapacityReachedError) {
          console.error(
            "sinergia-parrafo 2x1: capacity reached after payment — manual refund needed",
            { mpPaymentId, code: twoForOne.code },
          );
          return NextResponse.json(
            { ok: false, error: "Capacity reached after payment" },
            { status: 200 },
          );
        }
        throw err;
      }

      let companionResult;
      try {
        companionResult = await recordParticipation({
          email: twoForOne.personTwo.email,
          name: twoForOne.personTwo.name,
          phone: twoForOne.personTwo.phone || undefined,
          eventId: EVENT_ID,
          participationId: companionTicketId,
          role: "attendee",
          status: "confirmed",
          // Same external payment id ties both rows to the single MP charge.
          externalPaymentId: mpPaymentId,
          // Companion seat is comped against the primary's full payment.
          priceCents: 0,
          currency,
          attribution: twoForOne.attribution ?? undefined,
          bypassLinkSlug: twoForOne.attribution?.linkSlug,
          metadata: {
            twoForOne: {
              code: twoForOne.code,
              role: "companion",
              primaryEmail: twoForOne.personOne.email,
              primaryParticipationId: primaryResult.participationId,
              comp: true,
            },
          },
        });
      } catch (err) {
        if (err instanceof CapacityReachedError) {
          // Companion failed but primary is seated. Flag for manual recovery
          // — either the host promotes them off the waitlist or refunds.
          console.error(
            "sinergia-parrafo 2x1: companion capacity reached — primary seated, companion needs manual handling",
            {
              mpPaymentId,
              code: twoForOne.code,
              primaryId: primaryResult.participationId,
              companion: twoForOne.personTwo,
            },
          );
          // Still stamp the idempotency key so retries don't re-process.
          // Use the single-ticket value so replays target the primary.
          await redis.set(idempotencyKey, primaryResult.participationId, {
            EX: 60 * 60 * 24 * 90,
          });
          // Mark the 2x1 code used regardless — we don't want a comp'd
          // code reused after a partial seat.
          await redis.set(`sinergia-parrafo:2x1:${twoForOne.code}`, "used");
          return NextResponse.json(
            { ok: false, error: "Companion seat unavailable" },
            { status: 200 },
          );
        }
        throw err;
      }

      // Mark the 2x1 code as used now that both seats landed.
      await redis.set(`sinergia-parrafo:2x1:${twoForOne.code}`, "used");

      // Stamp idempotency: both participation ids encoded so replays send
      // both ticket emails idempotently.
      await redis.set(
        idempotencyKey,
        formatTwoForOneIdempotencyValue(
          primaryResult.participationId,
          companionResult.participationId,
        ),
        { EX: 60 * 60 * 24 * 90 },
      );

      // Send ticket emails to both attendees. Failures here are non-fatal
      // — emailSent stays false and MP's webhook retry replays the path.
      const primaryRow = await fetchAttendeeRow(primaryResult.participationId);
      const companionRow = await fetchAttendeeRow(
        companionResult.participationId,
      );
      if (primaryRow && !primaryRow.metadata.emailSent) {
        await sendAttendeeTicketEmail({
          to: primaryRow.email,
          name: primaryRow.name,
          ticketId: primaryRow.id,
          amountCents: totalAmountCents,
          paymentId: mpPaymentId,
          companionName: twoForOne.personTwo.name,
          existingMetadata: primaryRow.metadata,
        });
      }
      if (companionRow && !companionRow.metadata.emailSent) {
        await sendAttendeeTicketEmail({
          to: companionRow.email,
          name: companionRow.name,
          ticketId: companionRow.id,
          amountCents: totalAmountCents,
          paymentId: mpPaymentId,
          companionName: twoForOne.personOne.name,
          existingMetadata: companionRow.metadata,
        });
      }

      // Host notification — single email summarizing both attendees.
      const notifyList = (
        process.env.SINERGIA_PARRAFO_NOTIFY_EMAILS ||
        process.env.SINERGIA_NOTIFY_EMAILS ||
        ""
      )
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      if (notifyList.length > 0) {
        const occupied = await countOccupied();
        const remaining = Math.max(
          0,
          sinergiaParrafoConfig.capacity - occupied,
        );
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
        try {
          await getResend().emails.send({
            from: `Sinergia × Párrafo <${fromEmail}>`,
            to: notifyList,
            subject: `Nueva entrada 2x1 Sinergia × Párrafo — ${twoForOne.personOne.name} + ${twoForOne.personTwo.name}`,
            html: buildSinergiaParrafoHostNotificationHtml({
              name: `${twoForOne.personOne.name} + ${twoForOne.personTwo.name} (2x1)`,
              email: `${twoForOne.personOne.email}, ${twoForOne.personTwo.email}`,
              phone:
                primaryRow?.phone ??
                companionRow?.phone ??
                twoForOne.personOne.phone,
              ticketId: `${primaryResult.participationId} + ${companionResult.participationId}`,
              amountCents: totalAmountCents,
              totalRegistered: occupied,
              remaining,
              capacity: sinergiaParrafoConfig.capacity,
            }),
          });
        } catch (err) {
          console.error(
            "sinergia-parrafo 2x1: host notification failed",
            err,
          );
        }
      }

      return NextResponse.json({
        ok: true,
        mode: "2x1",
        primaryTicketId: primaryResult.participationId,
        companionTicketId: companionResult.participationId,
      });
    }

    // Buyer info: prefer the Redis stash (captured at checkout from our
    // form). MP's payer object is unreliable for Account Money flows.
    const checkoutMeta = await readCheckoutMeta(
      payment.preference_id as string | undefined,
    );

    buyerEmail =
      checkoutMeta?.email?.trim() ||
      payment.payer?.email ||
      "";
    buyerName =
      checkoutMeta?.name?.trim() ||
      [payment.payer?.first_name, payment.payer?.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Asistente";
    const buyerPhone = checkoutMeta?.phone?.trim() || undefined;

    if (!buyerEmail) {
      console.error(
        "sinergia-parrafo: no buyer email available for payment",
        mpPaymentId,
      );
      return NextResponse.json(
        { error: "No buyer email" },
        { status: 200 },
      );
    }

    const newTicketId = `SP-${nanoid(8).toUpperCase()}`;

    await ensureEvent();

    let result;
    try {
      result = await recordParticipation({
        email: buyerEmail,
        name: buyerName,
        phone: buyerPhone,
        eventId: EVENT_ID,
        participationId: newTicketId,
        role: "attendee",
        status: "confirmed",
        externalPaymentId: mpPaymentId,
        priceCents: Math.round(
          Number(payment.transaction_amount ?? 0) * 100,
        ),
        currency: payment.currency_id ?? sinergiaParrafoConfig.currency,
        attribution: checkoutMeta?.attribution ?? undefined,
        bypassLinkSlug: checkoutMeta?.attribution?.linkSlug,
      });
    } catch (err) {
      if (err instanceof CapacityReachedError) {
        // The event filled between checkout and payment confirmation.
        // The buyer paid and we can't seat them — flag for manual refund.
        // Don't 500 (MP would retry); return 200 with a clear log line.
        console.error(
          "sinergia-parrafo: capacity reached after payment — manual refund needed",
          { mpPaymentId, buyerEmail, buyerName },
        );
        return NextResponse.json(
          { ok: false, error: "Capacity reached after payment" },
          { status: 200 },
        );
      }
      throw err;
    }

    // recordParticipation returns the existing participationId when
    // (personId, eventId) is already taken — same buyer paid twice or
    // their RSVP was created via another flow. Honor that id so Redis,
    // the email, and the metadata flag all point at the real row.
    ticketId = result.participationId;

    if (!result.created) {
      // Pull the row's current metadata so the emailSent merge later
      // doesn't clobber whatever the existing row already had.
      const existing = await db
        .select({ metadata: schema.participations.metadata })
        .from(schema.participations)
        .where(eq(schema.participations.id, ticketId))
        .limit(1);
      participationMetadata =
        (existing[0]?.metadata as Record<string, unknown>) ?? {};
      if (participationMetadata.emailSent) {
        // Existing ticket already mailed. Stamp idempotency and exit.
        await redis.set(idempotencyKey, ticketId, {
          EX: 60 * 60 * 24 * 90,
        });
        return NextResponse.json({ ok: true, ticketId });
      }
    }

    // Stamp the real ticket id with a 90-day TTL — covers MP's retry
    // horizon while keeping the keyspace bounded.
    await redis.set(idempotencyKey, ticketId, { EX: 60 * 60 * 24 * 90 });
  }

  // Send the ticket email. Runs for both fresh tickets and retry replays.
  if (buyerEmail) {
    try {
      // Encode just the ticket id — there's no scanner endpoint yet, so a
      // URL-style QR would 404. The ticket id is what door staff will read
      // anyway; if/when a /sinergia-parrafo/ticket/[id] page exists, swap
      // this back to a URL.
      const qrDataUrl = await QRCode.toDataURL(ticketId, {
        width: 300,
        margin: 2,
        color: { dark: "#0E6BA8", light: "#F1ECDA" },
      });

      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
      const amountCents = payment
        ? Math.round(Number(payment.transaction_amount ?? 0) * 100)
        : sinergiaParrafoConfig.ticketPriceCents;

      await getResend().emails.send({
        from: `Sinergia × Párrafo <${fromEmail}>`,
        to: buyerEmail,
        subject: "Tu lugar para Sinergia × Párrafo (16/05) 📖",
        html: buildSinergiaParrafoTicketEmailHtml({
          name: buyerName,
          ticketId,
          amountCents,
          paymentId: mpPaymentId,
        }),
        attachments: [
          {
            filename: "qr.png",
            content: qrDataUrlToBuffer(qrDataUrl),
            contentType: "image/png",
            contentId: "qr",
          },
        ],
      });

      // Mark email as sent on the participation row so a webhook retry
      // doesn't double-send.
      await db
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
            ...participationMetadata,
            emailSent: true,
          })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, ticketId));

      // Host notification. Only on fresh tickets — retries shouldn't
      // re-spam the host. Recompute occupancy after the insert above.
      if (!existingTicketId) {
        const notifyList = (
          process.env.SINERGIA_PARRAFO_NOTIFY_EMAILS ||
          process.env.SINERGIA_NOTIFY_EMAILS ||
          ""
        )
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

        if (notifyList.length > 0) {
          const occupied = await countOccupied();
          const remaining = Math.max(
            0,
            sinergiaParrafoConfig.capacity - occupied,
          );
          try {
            // Look up the phone we just stored (recordParticipation may
            // have preserved an existing one; this is the source of truth).
            const personRow = await db
              .select({ phone: schema.people.phone })
              .from(schema.participations)
              .innerJoin(
                schema.people,
                eq(schema.people.id, schema.participations.personId),
              )
              .where(eq(schema.participations.id, ticketId))
              .limit(1);
            const phone = personRow[0]?.phone ?? undefined;

            await getResend().emails.send({
              from: `Sinergia × Párrafo <${fromEmail}>`,
              to: notifyList,
              subject: `Nueva entrada Sinergia × Párrafo — ${buyerName}`,
              html: buildSinergiaParrafoHostNotificationHtml({
                name: buyerName,
                email: buyerEmail,
                phone: phone ?? undefined,
                ticketId,
                amountCents,
                totalRegistered: occupied,
                remaining,
                capacity: sinergiaParrafoConfig.capacity,
              }),
            });
          } catch (err) {
            console.error(
              "sinergia-parrafo: host notification failed",
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error("sinergia-parrafo: ticket email failed", ticketId, err);
      // Non-fatal: MP will retry the webhook and we'll try email again.
    }
  }

  return NextResponse.json({ ok: true, ticketId });
}
