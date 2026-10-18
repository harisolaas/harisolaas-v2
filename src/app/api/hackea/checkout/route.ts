import { NextResponse } from "next/server";
import { Preference } from "mercadopago";
import { HACKEA_PAYMENT_TYPE, hackeaConfig } from "@/data/hackea";
import { createHackeaLead } from "@/lib/hackea";
import { isHackeaSalesOpen } from "@/lib/hackea-display";
// Same rules the landing runs before POSTing, so the two can't disagree on
// what a valid form is.
import { validateHackeaLead } from "@/lib/hackea-validation";
import { getMp } from "@/lib/mp-server";
import {
  buildAttribution,
  readCookie,
  type AttributionInput,
} from "@/lib/attribution";
import { sendMetaEvent } from "@/lib/meta-capi";
import { getRedis } from "@/lib/redis";

const CHECKOUT_STASH_TTL = 60 * 60 * 24 * 7;

// In-process rate limit. Same envelope the BROTE / Sinergia checkouts use.
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

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/**
 * Only the string fields of the body's attribution: buildAttribution trims
 * them, so a number or object there (a hand-made request) would throw and
 * turn a valid sale into a 500. Anything else counts as absent.
 */
function attributionBody(body: Record<string, unknown>): AttributionInput["body"] {
  const utm =
    body.utm && typeof body.utm === "object" && !Array.isArray(body.utm)
      ? (body.utm as Record<string, unknown>)
      : {};
  return {
    utm: {
      source: str(utm.source),
      medium: str(utm.medium),
      campaign: str(utm.campaign),
      content: str(utm.content),
    },
    linkSlug: str(body.linkSlug),
  };
}

/**
 * Hackeá tu mente — persist the lead, then hand off to MercadoPago.
 *
 * The participation is written as `pending` BEFORE the Preference exists:
 * whoever fills the form is in the CRM even if they never pay. The webhook
 * resolves the payment back to it through `external_reference`. The only
 * Redis stash is the CAPI user_data for the webhook's Purchase event.
 */
export async function POST(req: Request) {
  try {
    // Keep the real header value separate from the rate-limit key: the
    // "unknown" fallback must never be sent to Meta as an IP.
    const ipHeader = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = ipHeader || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // The talk has started: nothing left to sell. The landing swaps the form
    // for a closed card past this point; this covers a tab left open.
    if (!isHackeaSalesOpen()) {
      return NextResponse.json({ error: "closed" }, { status: 410 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const validation = validateHackeaLead(body);
    if (!validation.ok) {
      // One field at a time, in form order — the landing focuses it.
      return NextResponse.json(
        { error: validation.errors[0] },
        { status: 400 },
      );
    }
    const { name, phone, email } = validation.value;
    const locale = body.locale === "en" ? "en" : "es";

    // URL-provided UTMs win over the `haris_link` cookie /go/[slug] sets;
    // undefined when there's nothing to attribute.
    const attribution = buildAttribution({
      req,
      body: attributionBody(body),
    });

    const lead = await createHackeaLead({
      name,
      phone,
      email,
      attribution,
      linkSlug: attribution?.linkSlug,
    });
    // Paid = a payment on the row that wasn't refunded, whatever the admin
    // status (a cancelled entrada keeps its money). A refunded one can buy
    // again; the webhook confirms that payment as a fresh purchase.
    if (lead.paid) {
      return NextResponse.json({ error: "already_paid" }, { status: 409 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
    const preference = await new Preference(getMp()).create({
      body: {
        external_reference: lead.participationId,
        items: [
          {
            id: HACKEA_PAYMENT_TYPE,
            title: "Hackeá tu mente — entrada",
            quantity: 1,
            unit_price: hackeaConfig.ticketPriceCents / 100,
            currency_id: hackeaConfig.currency,
          },
        ],
        back_urls: {
          success: `${baseUrl}/${locale}/hackea-tu-mente/success`,
          failure: `${baseUrl}/${locale}/hackea-tu-mente/failure`,
          // Cash (Rapipago/Pago Fácil) is in progress, not failed.
          pending: `${baseUrl}/${locale}/hackea-tu-mente/success?state=pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/hackea/webhook`,
        // `type` is load-bearing: every MP flow shares one access token, so
        // each webhook refuses payments that aren't its own.
        // `participation_id` backs up `external_reference`.
        metadata: {
          type: HACKEA_PAYMENT_TYPE,
          participation_id: lead.participationId,
        },
        payer: email ? { name, email } : { name },
      },
    });

    const initPoint =
      process.env.NODE_ENV === "development"
        ? (preference.sandbox_init_point ?? preference.init_point)
        : preference.init_point;
    if (!initPoint) {
      // The pending lead stays — it is still a lead.
      console.error("hackea/checkout: preference without init_point", {
        participationId: lead.participationId,
        preferenceId: preference.id,
      });
      return NextResponse.json({ error: "server" }, { status: 500 });
    }

    // Body first (a client that reads them itself), the pixel's cookies
    // otherwise.
    const fbp =
      (typeof body.fbp === "string" && body.fbp) ||
      readCookie(req, "_fbp") ||
      undefined;
    const fbc =
      (typeof body.fbc === "string" && body.fbc) ||
      readCookie(req, "_fbc") ||
      undefined;
    const ua = req.headers.get("user-agent") || undefined;
    // The landing fires no browser pixel today, so there's nothing to dedup
    // against unless the client sends its own event id.
    const metaEventId =
      typeof body.eventId === "string" && body.eventId
        ? body.eventId
        : `hackea-checkout-${lead.participationId}`;

    // The webhook has no browser in front of it: without this stash its
    // CAPI Purchase would go out with empty user_data, which Meta rejects.
    // 7 days so a cash payment that clears late still finds it. Best
    // effort — a Redis failure never blocks the sale.
    try {
      const redis = await getRedis();
      await redis.set(
        `hackea:checkout:${lead.participationId}`,
        JSON.stringify({ ip: ipHeader, ua, fbp, fbc, eventId: metaEventId }),
        { EX: CHECKOUT_STASH_TTL },
      );
    } catch (err) {
      console.error("hackea/checkout: CAPI stash failed:", err);
    }
    sendMetaEvent({
      event_name: "InitiateCheckout",
      event_id: metaEventId,
      event_source_url: `${baseUrl}${hackeaConfig.landingPath}`,
      user_data: {
        client_ip_address: ipHeader,
        client_user_agent: ua,
        fbp,
        fbc,
      },
      custom_data: {
        currency: hackeaConfig.currency,
        value: hackeaConfig.ticketPriceCents / 100,
        num_items: 1,
      },
    }).catch(() => {}); // fire and forget

    return NextResponse.json({
      initPoint,
      participationId: lead.participationId,
    });
  } catch (error) {
    // Includes MP Preference failures after the lead was written: the
    // pending row stays in the CRM, which is the point of writing it first.
    console.error("hackea/checkout error:", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
