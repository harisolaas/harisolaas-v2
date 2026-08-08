import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { nanoid } from "nanoid";
// `currentTicketPrice()` comes from the landing redesign (#54): the landing
// and this route price from one helper, so what's shown and what's charged
// cannot drift. The identity imports are gone — no name/email/phone is
// collected before payment any more.
import { broteConfig, currentTicketPrice } from "@/data/brote";
import { getRedis } from "@/lib/redis";
import { CONFIRM_TTL } from "@/lib/brote-confirm-token";
import { sendMetaEvent } from "@/lib/meta-capi";

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

    // No identity is collected here on purpose: the CTA goes straight to
    // MercadoPago. Whatever we need to reach this person is asked for after
    // paying, on /brote/success, where it's optional. The ticket goes to
    // MP's payer email until they say otherwise.
    //
    // The one-ticket-per-email pre-check went with it — there is no email
    // to check. The webhook still catches it after the fact: a payment that
    // produces no new participation alerts the admin for a refund decision.

    // Same helper the landing renders from, so the price shown and the price
    // charged cannot drift apart.
    const { raw: price, isEarlyBird } = currentTicketPrice();
    const title = `BROTE — Entrada${isEarlyBird ? " (Preventa)" : ""}`;
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
            quantity: 1,
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
      });
      await redis.set(`brote:checkout:${preferenceId}`, stash, {
        EX: CONFIRM_TTL,
      });
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
        custom_data: { currency: "ARS", value: price },
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
