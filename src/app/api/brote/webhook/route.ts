import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { count, eq } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import { CapacityReachedError, recordParticipation } from "@/lib/community";
import { resolveBuyerInfo, type CheckoutMetaLike } from "@/lib/mp-buyer-info";
import { notifyAdminOfIncident } from "@/lib/admin-alert";
import {
  markBroteTicketEmailSent,
  sendBroteTicketEmail,
} from "@/lib/brote-ticket-email";
import {
  CONFIRM_TTL,
  confirmTicketKey,
  pendingContactKey,
  type PendingContact,
} from "@/lib/brote-confirm-token";
import { sendMetaEvent } from "@/lib/meta-capi";
import { BROTE_EVENT_ID } from "@/data/brote";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

// Shape of the checkout stash. Pre-verified-checkout stashes (in flight
// across the deploy) only carry the Meta tracking fields — every identity
// field must stay optional and be read defensively.
interface CheckoutMeta extends CheckoutMetaLike {
  locale?: string;
  eventId?: string;
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  linkSlug?: string;
}

async function readCheckoutMeta(
  preferenceId: string,
): Promise<CheckoutMeta | null> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(`brote:checkout:${preferenceId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutMeta;
  } catch (err) {
    console.error("brote: failed to read checkout meta:", err);
    return null;
  }
}

async function readPendingContact(
  token: string,
): Promise<PendingContact | null> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(pendingContactKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as PendingContact;
  } catch (err) {
    console.error("brote: failed to read pending contact:", err);
    return null;
  }
}

function verifySignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not set

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) {
    console.warn("Webhook missing signature headers:", {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
      headers: Object.fromEntries(
        [...new Headers(req.headers)].filter(([k]) => !k.includes("auth")),
      ),
    });
    return false;
  }

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
    console.warn("Webhook signature mismatch:", { dataId, xRequestId, ts, manifest });
    return false;
  }

  return true;
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

  const mpPaymentId = String(parsed.data?.id);
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  const redis = await getRedis();

  // Idempotency: Redis maps MP payment id → ticket id. Fast path for retries.
  const existingTicketId = await redis.get(`brote:payment:${mpPaymentId}`);

  let ticketId: string;
  let buyerEmail: string;
  let buyerName: string;
  let checkoutMeta: CheckoutMeta | null = null;
  let confirmToken = "";
  let confirmedContact: PendingContact | null = null;
  /** MP's payer email, kept when a confirmed contact overrides it. */
  let mpPayerEmail = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any = null;

  /**
   * Point the capability token at the ticket, on EVERY path that knows a
   * ticket id — including the retry fast-path and the duplicate-payment
   * exit. `/api/brote/confirm-contact` resolves the ticket through this
   * key, so skipping a path leaves that buyer unable to fix their address.
   */
  const linkConfirmToken = async (ticket: string) => {
    if (!confirmToken) return;
    try {
      await redis.set(confirmTicketKey(confirmToken), ticket, {
        EX: CONFIRM_TTL,
      });
    } catch (err) {
      console.error("brote: failed to link confirm token:", err);
    }
  };

  if (existingTicketId) {
    // Participation already exists. Load it to decide whether to retry email.
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
      // Redis mapping exists but DB row doesn't — orphaned state.
      // Log and treat as success to avoid a webhook retry loop.
      console.warn("Orphaned MP idempotency key:", {
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

    // Email wasn't sent — fall through to retry it.
    console.log("Retrying email for existing ticket:", row.id);
    ticketId = row.id;
    buyerEmail = row.email ?? "";
    buyerName = row.name ?? "Asistente";
  } else {
    // New payment — fetch from MP and create participation.
    try {
      payment = await new Payment(mp).get({ id: mpPaymentId });
    } catch (err) {
      console.error("MP payment fetch failed:", mpPaymentId, err);
      return NextResponse.json({ error: "Payment not found" }, { status: 200 });
    }

    // No ticket is ever issued for a payment that isn't approved — a cash
    // payment sits `pending` for days and only becomes a ticket here.
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // BROTE, Sinergia and Sinergia-Párrafo all share one MP access token
    // and one signing secret, and CLAUDE.md has you register several
    // webhook URLs. If MercadoPago is ever configured to fan out at the
    // account level, a Sinergia donation lands here too — and without this
    // guard it would mint a free BROTE ticket. Every flow stamps its own
    // `type`, so refuse anything that isn't ours.
    const paymentType = String(payment.metadata?.type ?? "").trim();
    if (paymentType && paymentType !== "ticket") {
      console.log("brote: ignoring non-ticket payment", {
        mpPaymentId,
        paymentType,
      });
      return NextResponse.json({ ok: true, ignored: paymentType });
    }

    confirmToken = String(payment.external_reference ?? "").trim();

    // The checkout no longer collects identity, so the stash carries only
    // locale and Meta tracking. Buyer identity comes from MP's payer object
    // until the person confirms something better on /brote/success.
    // Held in an object so the assignment inside the callback survives
    // TypeScript's control-flow narrowing (a bare `let` gets narrowed to
    // `never` because closure writes aren't tracked).
    const stashHolder: { value: CheckoutMeta | null } = { value: null };
    const buyerInfo = await resolveBuyerInfo(payment, {
      readStashByPreferenceId: async (preferenceId) => {
        const stash = await readCheckoutMeta(preferenceId);
        if (stash) stashHolder.value = stash;
        return stash;
      },
    });
    checkoutMeta = stashHolder.value;

    buyerEmail = buyerInfo.email;
    buyerName = buyerInfo.name;
    let buyerPhone = buyerInfo.phone;


    // A contact confirmed on /brote/success outranks everything above.
    // The person read that address off their own screen and typed it;
    // MP's payer object is whatever their account happens to carry. This
    // is the normal ordering, not a rare one — the redirect is instant and
    // this webhook is not, so most people confirm before the ticket exists.
    if (confirmToken) {
      const pending = await readPendingContact(confirmToken);
      if (pending) {
        mpPayerEmail = buyerEmail;
        // Normalize here too, not just at the parking point: a contact
        // parked by an older deploy may not be lowercased, and this value
        // becomes the canonical `people.email` (recordParticipation only
        // trims).
        buyerEmail = pending.email.trim().toLowerCase();
        buyerName = pending.name || buyerName;
        buyerPhone = pending.phone || buyerPhone;
        confirmedContact = { ...pending, email: buyerEmail };
        console.log("brote: using contact confirmed on /success", {
          mpPaymentId,
        });
        // Consumed — drop it rather than sit on someone's phone number for
        // the rest of the 7-day TTL.
        try {
          await redis.del(pendingContactKey(confirmToken));
        } catch (err) {
          console.error("brote: failed to clear pending contact:", err);
        }
      }
    }

    if (buyerInfo.nameSource === "fallback") {
      console.warn("brote: buyer name fell back to default", {
        mpPaymentId,
        preferenceId: payment.preference_id ?? null,
        payerEmail: payment.payer?.email ?? null,
      });
    }

    console.log("Webhook processing:", {
      mpPaymentId,
      status: payment.status,
      buyerEmail,
      buyerName,
      nameSource: buyerInfo.nameSource,
    });

    if (!buyerEmail) {
      // No identity at all (no stash, no metadata, empty payer). A 500
      // would make MP retry forever; alert the admin and exit 200. Money
      // was received with no way to deliver a ticket — human follow-up.
      console.error("brote: no buyer email available for payment", mpPaymentId);
      await notifyAdminOfIncident({
        subject: "BROTE: pago sin email de comprador",
        lines: [
          `MP payment id: ${mpPaymentId}`,
          `Monto: ${payment.transaction_amount ?? "?"} ${payment.currency_id ?? "ARS"}`,
          "Llegó un pago aprobado pero no se pudo resolver ningún email (sin stash, sin metadata, payer vacío). Buscá el pago en MercadoPago y emití la entrada a mano.",
        ],
      });
      return NextResponse.json({ error: "No buyer email" }, { status: 200 });
    }

    const newTicketId = `BROTE2-${nanoid(8).toUpperCase()}`;

    // Attribution from the checkout stash (populated when the buyer arrived
    // via a tracked link; absent otherwise).
    let attribution: Record<string, string> | undefined;
    if (
      checkoutMeta &&
      (checkoutMeta.source ||
        checkoutMeta.medium ||
        checkoutMeta.campaign ||
        checkoutMeta.linkSlug)
    ) {
      attribution = {
        ...(checkoutMeta.source && { source: checkoutMeta.source }),
        ...(checkoutMeta.medium && { medium: checkoutMeta.medium }),
        ...(checkoutMeta.campaign && { campaign: checkoutMeta.campaign }),
        ...(checkoutMeta.linkSlug && { linkSlug: checkoutMeta.linkSlug }),
        capturedAt: new Date().toISOString(),
      };
    }

    let result;
    try {
      result = await recordParticipation({
        email: buyerEmail,
        name: buyerName,
        phone: buyerPhone,
        eventId: BROTE_EVENT_ID,
        participationId: newTicketId,
        role: "attendee",
        status: "confirmed",
        externalPaymentId: mpPaymentId,
        priceCents: Math.round(Number(payment.transaction_amount ?? 0) * 100),
        currency: payment.currency_id ?? "ARS",
        attribution: attribution
          ? { ...attribution, capturedAt: attribution.capturedAt }
          : undefined,
        // `referred_by_person_id` is written ONLY from bypassLinkSlug —
        // passing attribution alone gives click credit with a null referrer,
        // which is exactly the field a partner payout would be counted on.
        bypassLinkSlug: attribution?.linkSlug,
        // Same metadata shape `applyBroteContactConfirmation` writes, so a
        // ticket born from a pre-confirmed contact is indistinguishable
        // from one corrected afterwards — the admin export and the confirm
        // endpoint both read one shape, not two.
        metadata: confirmedContact
          ? {
              contact: {
                name: confirmedContact.name,
                email: confirmedContact.email,
                phone: confirmedContact.phone,
                confirmedAt: confirmedContact.confirmedAt,
              },
              ...(mpPayerEmail &&
                mpPayerEmail.toLowerCase() !==
                  confirmedContact.email.toLowerCase() && {
                  mpPayer: { email: mpPayerEmail, source: "mercadopago" },
                }),
            }
          : undefined,
      });
    } catch (err) {
      if (err instanceof CapacityReachedError) {
        // The BROTE event has no capacity in prod, but if one is ever
        // set, this error is deterministic — a 500 would loop MP retries
        // forever with money taken and no ticket. Alert and exit 200.
        console.error("brote: capacity reached after payment", {
          mpPaymentId,
          buyerEmail,
        });
        await notifyAdminOfIncident({
          subject: "BROTE: pago recibido con evento lleno",
          lines: [
            `MP payment id: ${mpPaymentId}`,
            `Email: ${buyerEmail}`,
            `Nombre: ${buyerName}`,
            "El evento alcanzó su capacidad entre el checkout y la confirmación del pago. Revisá si corresponde reembolso o sumar el lugar a mano.",
          ],
        });
        return NextResponse.json(
          { ok: false, error: "Capacity reached after payment" },
          { status: 200 },
        );
      }
      throw err;
    }

    // recordParticipation returns the existing participation id when
    // (personId, eventId) is already taken. Honor it so Redis, the email,
    // and the metadata flag all point at the real row — previously the
    // locally generated (never-inserted) id was used, and the QR email
    // went out with a ticket id that didn't exist.
    ticketId = result.participationId;

    if (!result.created && !result.promoted) {
      // Money received but no new ticket was created — the buyer already
      // had one (double payment, or the checkout pre-check raced). Needs a
      // human decision (refund vs. keep), so alert the admin.
      console.error("brote: payment with no new ticket", {
        mpPaymentId,
        buyerEmail,
        ticketId,
      });
      await notifyAdminOfIncident({
        subject: "BROTE: pago recibido sin entrada nueva",
        lines: [
          `MP payment id: ${mpPaymentId}`,
          `Email: ${buyerEmail}`,
          `Nombre: ${buyerName}`,
          `Participación existente: ${ticketId}`,
          `Monto: ${payment.transaction_amount ?? "?"} ${payment.currency_id ?? "ARS"}`,
          "El pago quedó registrado pero la persona ya tenía entrada para BROTE. Revisá si corresponde reembolso.",
        ],
      });

      // Link the token BEFORE stamping idempotency. A crash between the
      // two writes must not leave a ticket that the buyer can never
      // re-address: the retry takes the `existingTicketId` fast path, which
      // never fetches the payment and so never learns the token. In this
      // order the worst case is a re-processed payment (already handled,
      // it alerts the admin); in the other order it's a buyer permanently
      // locked out of fixing their email.
      await linkConfirmToken(ticketId);
      // Don't re-send the existing ticket's email off the back of a
      // duplicate payment. Stamp idempotency and exit.
      await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
      return NextResponse.json({ ok: true, ticketId, duplicate: true });
    }

    await linkConfirmToken(ticketId);
    // Save MP → ticket idempotency mapping for webhook retries.
    await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
  }

  // Tree number for the email = ticket count for this event (display-only).
  const treeCountRes = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  const treeNumber = Number(treeCountRes[0]?.n ?? 1);

  // Send email (runs for both new tickets and retries). The flag is only
  // stamped after the send resolves, so a failure leaves `emailSent` falsy
  // and the next MP retry tries again.
  if (buyerEmail) {
    try {
      await sendBroteTicketEmail({
        ticketId,
        to: buyerEmail,
        buyerName,
        paymentId: mpPaymentId,
        treeNumber,
      });
      await markBroteTicketEmailSent(ticketId);

      console.log("Email sent:", { to: buyerEmail, ticketId });
    } catch (err) {
      console.error("Email send failed:", ticketId, err);
      // Don't fail the webhook — MP will retry and we'll try email again.
    }
  }

  // Fire Meta CAPI Purchase event — production only, new tickets only.
  if (
    !existingTicketId &&
    payment &&
    process.env.VERCEL_ENV === "production"
  ) {
    try {
      const paymentAmount = payment.transaction_amount ?? 0;

      const ip =
        checkoutMeta?.ip ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const ua = checkoutMeta?.ua || req.headers.get("user-agent");

      if (ip || ua) {
        sendMetaEvent({
          event_name: "Purchase",
          event_id: `brote-purchase-${ticketId}`,
          event_source_url: "https://www.harisolaas.com/es/brote",
          user_data: {
            client_ip_address: ip || undefined,
            client_user_agent: ua || undefined,
            fbp: checkoutMeta?.fbp || undefined,
            fbc: checkoutMeta?.fbc || undefined,
          },
          custom_data: { currency: "ARS", value: paymentAmount },
        }).catch(() => {}); // fire and forget
      } else {
        console.warn(
          "Meta CAPI: skipping Purchase event — no user_data available for ticket:",
          ticketId,
        );
      }
    } catch (err) {
      console.error("Meta CAPI Purchase error (non-fatal):", err);
    }
  }

  return NextResponse.json({ ok: true, ticketId });
}
