import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { nanoid } from "nanoid";
// `resolveInvitationPrice()` wraps `currentTicketPrice()` from the landing
// redesign (#54): the landing, the invitation pages and this route all price
// from one helper, so what's shown and what's charged cannot drift. The
// identity imports are gone — no name/email/phone is collected before payment.
import { broteConfig } from "@/data/brote";
import {
  getInvitation,
  resolveInvitationPrice,
} from "@/lib/brote-invitations";
import { getRedis } from "@/lib/redis";
import { CONFIRM_TTL, checkoutByTokenKey } from "@/lib/brote-confirm-token";
// The SAME clamp the webhook uses, deliberately: two different notions of
// "how many is allowed" is how a checkout charges for 12 and a webhook
// issues 10.
import { parseTicketQuantity } from "@/lib/brote-ticket-ids";
import { sendMetaEvent } from "@/lib/meta-capi";
import { buildAttribution } from "@/lib/attribution";

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

// Simple in-memory rate limit: max 5 requests per IP per 60s
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(req: Request) {
  try {
    // Keep the real header value separate from the rate-limit key: the
    // "unknown" fallback must never be stashed or sent to Meta as an IP.
    const ipHeader = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = ipHeader || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    const body = await req.json();
    const eventId = body.eventId as string | undefined;
    const fbp = body.fbp as string | undefined;
    const fbc = body.fbc as string | undefined;
    const locale = body.locale === "en" ? "en" : "es";

    // The collaborator whose invitation this buyer arrived through. Looked up
    // server-side: the body carries a slug, never a price. An unknown slug is
    // not an error — it just prices like any other visitor.
    const invitation = getInvitation(body.invite as string | undefined);

    // Where the buyer came from. URL-provided UTMs win over the `haris_link`
    // cookie /go/[slug] sets; undefined when there's nothing to attribute.
    let attribution = buildAttribution({ req, body });

    // An invited buyer with no tracked link of their own is attributed to the
    // collaborator's link. A real /go/ link wins — it is the more specific
    // fact, and overwriting it would throw away which story sold the ticket.
    if (invitation && !attribution?.linkSlug) {
      attribution = {
        ...attribution,
        linkSlug: invitation.linkSlug,
        source: attribution?.source ?? "partner",
        medium: attribution?.medium ?? "referral",
        campaign: attribution?.campaign ?? "brote-invitacion",
        capturedAt: attribution?.capturedAt ?? new Date().toISOString(),
      };
    }

    // No identity is collected here on purpose: the CTA goes straight to
    // MercadoPago. Whatever we need to reach this person is asked for after
    // paying, on /brote/success, where it's optional. The ticket goes to
    // MP's payer email until they say otherwise.
    //
    // The one-ticket-per-email pre-check went with it — there is no email
    // to check. The webhook still catches it after the fact: a payment that
    // produces no new participation alerts the admin for a refund decision.

    // Same helper the landing and the invitation pages render from, so the
    // price shown and the price charged cannot drift apart. For an invited
    // buyer this is the ONLY authority — the client never sends a number.
    const { priceRaw: price, badge } = resolveInvitationPrice(invitation);

    // How many tickets. The client picks it in the modal, so it is clamped
    // with the SAME helper the webhook uses — whole number, 1..10, anything
    // else falls to 1. It is a count, never a price: `unit_price` below stays
    // server-decided, so the worst a tampered value can do is ask MercadoPago
    // to charge MORE, and the webhook issues against what was actually paid.
    const quantity = parseTicketQuantity(body.quantity);
    const title = invitation
      ? `BROTE — Entrada (Invitación ${invitation.name})`
      : `BROTE — Entrada${badge === "earlybird" ? " (Preventa)" : ""}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

    // Capability token for the post-payment contact step on /brote/success.
    // Rides on `external_reference`, which MP echoes back on the Payment
    // object — the same channel Sinergia already relies on. The client also
    // stashes it in localStorage before leaving, which is what /success
    // actually reads: whether MP appends it to the back_url query string is
    // undocumented here and nothing should depend on it.
    const confirmToken = nanoid(21);

    const preference = await new Preference(getMp()).create({
      body: {
        external_reference: confirmToken,
        items: [
          {
            id: "brote-ticket",
            title,
            // MercadoPago multiplies. Multiplying `unit_price` instead would
            // charge the same total while showing "1 × $74.250" at checkout
            // and telling the webhook nothing about how many tickets to issue.
            quantity,
            unit_price: price,
            currency_id: broteConfig.currency,
          },
        ],
        back_urls: {
          success: `${baseUrl}/${locale}/brote/success`,
          failure: `${baseUrl}/${locale}/brote/failure`,
          // Cash (Rapipago/Pago Fácil) lands here, and it is NOT a failure —
          // the payment is in progress. Sending it to /failure told people
          // their purchase died and threw away the one chance to capture
          // their contact. The success page renders a pending variant and
          // still offers the contact step, which is parked until the
          // webhook sees the payment clear.
          pending: `${baseUrl}/${locale}/brote/success?state=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/brote/webhook`,
        // `type` is load-bearing, not decorative: all three MP flows share
        // one access token, so the webhook uses it to refuse anything that
        // isn't a BROTE ticket. No buyer_* — there is no pre-payment
        // identity to stamp any more.
        metadata: {
          type: "ticket",
          // Same durable channel as `invite`: MP propagates preference
          // metadata onto the Payment, so the webhook learns the count even
          // when the Redis stash is gone. It cross-checks against the amount
          // regardless.
          qty: quantity,
          // Durable channel: MP propagates preference metadata onto the
          // Payment, so the webhook still knows which collaborator sold this
          // even if the Redis stash is gone.
          ...(invitation && { invite: invitation.slug }),
        },
      },
    });

    const preferenceId = preference.id;
    if (!preferenceId) {
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 502 },
      );
    }

    // Meta tracking only now — no identity to stash. The by-email key is
    // gone with it: it was keyed on the buyer's address, which we no longer
    // have, and it was always the riskier of the two (an MP account buying
    // for a friend the next day would hit the wrong checkout's stash).
    //
    // 7 days, not 24h: a cash payment (Rapipago/Pago Fácil) can take days
    // to clear, and the stash has to outlive it.
    try {
      const redis = await getRedis();
      const stash = JSON.stringify({
        locale,
        eventId,
        confirmToken,
        fbp,
        fbc,
        ip: ipHeader,
        ua: req.headers.get("user-agent") || "",
        // The webhook needs both to decide how many tickets to issue: `qty`
        // as a fallback when MP doesn't echo the preference metadata, and
        // `unitPriceCents` as the yardstick it checks the amount against.
        // Without the unit price there is nothing to compare, and a quantity
        // would have to be taken on trust.
        qty: quantity,
        unitPriceCents: price * 100,
        // Attribution goes FLAT on the stash root, not nested under an
        // `attribution` key the way sinergia-parrafo's checkout does it —
        // the webhook reads `source`/`medium`/`campaign`/`linkSlug` off the
        // root. Nesting them is silent: everything stays green and every
        // ticket lands with a null link_slug.
        ...(attribution?.source && { source: attribution.source }),
        ...(attribution?.medium && { medium: attribution.medium }),
        ...(attribution?.campaign && { campaign: attribution.campaign }),
        ...(attribution?.linkSlug && { linkSlug: attribution.linkSlug }),
      });
      // Two anchors, same payload. `preference_id` is absent on some MP
      // Payment objects and the by-email key that used to cover that is
      // gone, so the confirmToken mirror is what keeps attribution from
      // silently vanishing on those payments.
      await Promise.all([
        redis.set(`brote:checkout:${preferenceId}`, stash, {
          EX: CONFIRM_TTL,
        }),
        redis.set(checkoutByTokenKey(confirmToken), stash, {
          EX: CONFIRM_TTL,
        }),
      ]);
    } catch (err) {
      console.error("Failed to store checkout meta:", err);
    }

    // Fire Meta CAPI InitiateCheckout (server-side, dedup with browser event)
    if (eventId) {
      sendMetaEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        // The CTA lives on the landing now — /brote/checkout is gone.
        event_source_url: `${baseUrl}/${locale}/brote`,
        user_data: {
          client_ip_address: ipHeader,
          client_user_agent: req.headers.get("user-agent") || undefined,
          fbp: fbp || undefined,
          fbc: fbc || undefined,
        },
        // The value is the BASKET, not the unit price. The browser-side
        // `fbq('track','InitiateCheckout')` fires under the same event_id for
        // deduplication, so it multiplies too — a deduped pair reporting two
        // different values is worse than either alone.
        custom_data: { currency: "ARS", value: price * quantity },
      }).catch(() => {}); // fire and forget
    }

    const url = process.env.NODE_ENV === "development"
      ? preference.sandbox_init_point
      : preference.init_point;

    return NextResponse.json({ init_point: url, confirmToken });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}
