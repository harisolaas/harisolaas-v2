import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { count, eq, sql } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { nanoid } from "nanoid";
import { getRedis } from "@/lib/redis";
import { db, schema } from "@/db";
import {
  addCompanionTickets,
  CapacityReachedError,
  recordParticipation,
} from "@/lib/community";
import {
  companionTicketIds,
  parseTicketQuantity,
} from "@/lib/brote-ticket-ids";
import { resolveBuyerInfo, type CheckoutMetaLike } from "@/lib/mp-buyer-info";
import { notifyAdminOfIncident } from "@/lib/admin-alert";
import {
  markBroteTicketEmailSent,
  sendBroteTicketEmail,
} from "@/lib/brote-ticket-email";
import {
  CONFIRM_TTL,
  checkoutByTokenKey,
  confirmTicketKey,
  pendingContactKey,
  type PendingContact,
} from "@/lib/brote-confirm-token";
import { sendMetaEvent } from "@/lib/meta-capi";
import { getInvitation } from "@/lib/brote-invitations";
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
  /** How many tickets the checkout asked MercadoPago to charge for. */
  qty?: number;
  /** Price of ONE ticket at checkout time — what the amount is checked against. */
  unitPriceCents?: number;
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

/**
 * Participation metadata for a freshly paid ticket.
 *
 * Returns `undefined` rather than `{}` when there is nothing to record, so a
 * ticket with no contact and no invitation keeps the column's default instead
 * of writing an empty object over it.
 */
function buildParticipationMetadata(input: {
  confirmedContact: PendingContact | null;
  mpPayerEmail: string;
  invite?: string;
}): Record<string, unknown> | undefined {
  const { confirmedContact, mpPayerEmail, invite } = input;
  const metadata: Record<string, unknown> = {};

  if (confirmedContact) {
    metadata.contact = {
      name: confirmedContact.name,
      email: confirmedContact.email,
      phone: confirmedContact.phone,
      confirmedAt: confirmedContact.confirmedAt,
    };
    if (
      mpPayerEmail &&
      mpPayerEmail.toLowerCase() !== confirmedContact.email.toLowerCase()
    ) {
      metadata.mpPayer = { email: mpPayerEmail, source: "mercadopago" };
    }
  }

  if (invite) metadata.invite = invite;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/** Same stash, reached by `external_reference` when `preference_id` is absent. */
async function readCheckoutMetaByToken(
  token: string,
): Promise<CheckoutMeta | null> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(checkoutByTokenKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutMeta;
  } catch (err) {
    console.error("brote: failed to read checkout meta by token:", err);
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
  /** Companion ticket ids issued by this payment, beyond the primary. */
  let extraTicketIds: string[] = [];
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

    // Email wasn't sent — fall through to retry it, WITH THE WHOLE GROUP.
    //
    // One payment can own several tickets, and the Redis key points at only
    // the primary. Resending just that one would deliver 1 QR for a 3-ticket
    // purchase and leave the companions `emailSent` falsy for good: this
    // branch exits early next time on the primary's flag, so nothing ever
    // retries them and nothing alerts.
    //
    // Resolved by querying `external_payment_id` rather than by reading a
    // list off metadata: a query cannot drift out of sync with the rows.
    // Ordered so the buyer's own row comes first and the numbering is
    // stable across retries.
    const groupRows = await db
      .select({ id: schema.participations.id })
      .from(schema.participations)
      .where(eq(schema.participations.externalPaymentId, mpPaymentId))
      .orderBy(
        sql`(${schema.participations.role} = 'companion')`,
        schema.participations.createdAt,
        schema.participations.id,
      );

    console.log("Retrying email for existing ticket:", row.id, {
      groupSize: groupRows.length,
    });
    ticketId = row.id;
    extraTicketIds = groupRows.map((r) => r.id).filter((id) => id !== row.id);
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

    // `preference_id` is absent on some MP Payment objects, and the by-email
    // stash that used to cover that is gone. `external_reference` carries the
    // confirmToken on every payment, so it is the anchor that cannot go
    // missing — without this fallback those payments lose their attribution
    // silently while still issuing a perfectly good ticket.
    if (!checkoutMeta && confirmToken) {
      checkoutMeta = await readCheckoutMetaByToken(confirmToken);
    }

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

    // ── How many tickets did this payment buy? ────────────────────────
    //
    // Read from the PAYMENT, in cascade. `metadata.qty` is what our own
    // checkout stamped on the Preference; `additional_info.items[].quantity`
    // is MP's own record of what it charged for; the stash is our server-side
    // copy. All three are server-authored — the buyer never supplies a price
    // or a quantity that isn't echoed back through a Preference we created.
    const requestedQty = parseTicketQuantity(
      payment.metadata?.qty ??
        payment.additional_info?.items?.[0]?.quantity ??
        checkoutMeta?.qty,
    );

    // ...but the tickets follow the MONEY, not the request. If the amount
    // received covers fewer tickets than were asked for, issue what was paid
    // for and let a human sort out the rest. Without the stashed unit price
    // there is nothing to compare against, so the check is skipped rather
    // than guessed at.
    const paidCents = Math.round(Number(payment.transaction_amount ?? 0) * 100);
    const unitPriceCents = Number(checkoutMeta?.unitPriceCents ?? 0);
    let qty = requestedQty;
    if (unitPriceCents > 0) {
      const affordable = Math.max(1, Math.floor(paidCents / unitPriceCents));
      if (affordable < requestedQty) {
        console.error("brote: payment covers fewer tickets than requested", {
          mpPaymentId,
          requestedQty,
          affordable,
          paidCents,
          unitPriceCents,
        });
        await notifyAdminOfIncident({
          subject: "BROTE: el pago no cubre las entradas pedidas",
          lines: [
            `MP payment id: ${mpPaymentId}`,
            `Email: ${buyerEmail}`,
            `Pedidas: ${requestedQty} · pagadas: ${affordable}`,
            `Monto: ${payment.transaction_amount ?? "?"} ${payment.currency_id ?? "ARS"}`,
            "Se emitieron sólo las entradas que cubre el monto. Revisá el pago en MercadoPago.",
          ],
        });
        qty = affordable;
      }
    }

    // Per ticket, never the basket total: `price_cents` is what revenue
    // reporting and the collaborator payout sum over rows.
    const unitCents = Math.round(paidCents / qty);

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
        priceCents: unitCents,
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
        metadata: buildParticipationMetadata({
          confirmedContact,
          mpPayerEmail,
          // Which collaborator's invitation sold this ticket. Read straight
          // off the payment (MP propagates preference metadata), so it
          // survives even when the Redis stash is gone — and it is the belt
          // to `link_slug`'s braces: if the `links` row is ever missing,
          // `sanitizeAttribution` drops the slug and this is what remains.
          //
          // Resolved through the registry rather than coerced with String():
          // whatever MP echoes back lands in `participations.metadata`, and a
          // non-string would be persisted as "[object Object]". Only a real
          // collaborator slug is worth recording.
          invite: getInvitation(
            typeof payment.metadata?.invite === "string"
              ? payment.metadata.invite
              : undefined,
          )?.slug,
        }),
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

    // ── The extra tickets ─────────────────────────────────────────────
    //
    // Everything beyond the buyer's own `attendee` row is a `companion` row
    // on the same person, which is exactly what the partial unique index
    // exempts.
    //
    // `primaryIsNew` is false when this person ALREADY had a ticket — a
    // repeat purchase. That used to mean "alert, issue nothing": money taken
    // and nothing delivered. Now every one of those `qty` tickets is a new
    // companion row, and the earlier purchase is left alone — it belongs to
    // a different payment and was emailed long ago.
    //
    // The ids are DERIVED FROM THE PAYMENT, never minted fresh: companion
    // rows get no uniqueness from the database, and the webhook's own
    // idempotency is a plain `redis.get` with no atomic claim. `ON CONFLICT
    // (id) DO NOTHING` inside the helper is what stops two concurrent MP
    // deliveries double-issuing, and it can only do that if both compute
    // the same ids.
    const primaryIsNew = result.created || result.promoted;
    const companionCount = primaryIsNew ? qty - 1 : qty;

    /** Every ticket THIS payment issued, in order. */
    let issuedIds: string[] = primaryIsNew ? [result.participationId] : [];

    if (companionCount > 0) {
      const companionIds = companionTicketIds(mpPaymentId, companionCount);
      const companions = await addCompanionTickets({
        personId: result.personId,
        eventId: BROTE_EVENT_ID,
        ticketIds: companionIds,
        externalPaymentId: mpPaymentId,
        priceCents: unitCents,
        currency: payment.currency_id ?? "ARS",
        attribution: attribution
          ? { ...attribution, capturedAt: attribution.capturedAt }
          : undefined,
        // Same metadata as the primary. `invite` especially: the payout
        // report selects on `metadata->>'invite'`, so omitting it here pays
        // a collaborator for one ticket out of a three-pack.
        metadata: buildParticipationMetadata({
          confirmedContact,
          mpPayerEmail,
          invite: getInvitation(
            typeof payment.metadata?.invite === "string"
              ? payment.metadata.invite
              : undefined,
          )?.slug,
        }),
      });

      // The rows that ACTUALLY exist, not the ones we asked for. Emailing a
      // QR for a row that was never inserted hands someone a code the gate
      // will reject — the same class of failure as the locally-generated id
      // that once shipped inside a QR.
      //
      // A row that already existed with the same id counts as issued: it is
      // a concurrent delivery, not a shortfall, and treating it as missing
      // would alert on every retry forever.
      const live = new Set([
        ...companions.createdIds,
        ...companions.existingIds,
      ]);
      issuedIds = [...issuedIds, ...companionIds.filter((id) => live.has(id))];
    }

    if (issuedIds.length < qty) {
      console.error("brote: issued fewer tickets than paid for", {
        mpPaymentId,
        qty,
        issued: issuedIds.length,
      });
      await notifyAdminOfIncident({
        subject: "BROTE: se emitieron menos entradas que las pagadas",
        lines: [
          `MP payment id: ${mpPaymentId}`,
          `Email: ${buyerEmail}`,
          `Pagadas: ${qty} · emitidas: ${issuedIds.length}`,
          "Faltan entradas para este pago. Emitilas a mano desde el admin.",
        ],
      });
    }

    if (issuedIds.length === 0) {
      // Money received and nothing issued at all. Needs a human decision
      // (refund vs. issue by hand), so alert rather than swallow it.
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

    // This payment's own tickets, never the earlier purchase's row. On a
    // repeat purchase `result.participationId` is the OLD row: anchoring
    // `brote:payment:*` and `brote:confirm:{ct}` on it would make the retry
    // resend the old set, and the guest names typed on /success would land
    // on the previous purchase's rows.
    ticketId = issuedIds[0];
    extraTicketIds = issuedIds.slice(1);

    await linkConfirmToken(ticketId);
    // Save MP → ticket idempotency mapping for webhook retries.
    await redis.set(`brote:payment:${mpPaymentId}`, ticketId);
  }

  // Tree numbers are display-only: the count AFTER inserting, so this
  // payment's tickets are the last N. Computed here rather than before the
  // insert, or every buyer would see the number of the person before them.
  const treeCountRes = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  const treeTotal = Number(treeCountRes[0]?.n ?? 1);

  const allTicketIds = [ticketId, ...extraTicketIds];
  const treeNumberStart = Math.max(1, treeTotal - allTicketIds.length + 1);
  const emailTickets = allTicketIds.map((id, i) => ({
    ticketId: id,
    treeNumber: treeNumberStart + i,
  }));

  // Send email (runs for both new tickets and retries). ONE message carrying
  // every ticket from this payment. The flag is only stamped after the send
  // resolves, so a failure leaves `emailSent` falsy and the next MP retry
  // tries again — for the whole batch, which is why the flag write takes the
  // same list the email did.
  if (buyerEmail) {
    try {
      await sendBroteTicketEmail({
        tickets: emailTickets,
        to: buyerEmail,
        buyerName,
        paymentId: mpPaymentId,
      });
      await markBroteTicketEmailSent(allTicketIds);

      console.log("Email sent:", { to: buyerEmail, tickets: allTicketIds });
    } catch (err) {
      console.error("Email send failed:", allTicketIds, err);
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
