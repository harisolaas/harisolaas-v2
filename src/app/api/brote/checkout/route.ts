import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db, schema } from "@/db";
import { broteConfig, BROTE_EVENT_ID, currentTicketPrice } from "@/data/brote";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { consumeEmailVerification } from "@/lib/email-verification-server";
import { getRedis } from "@/lib/redis";
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
    const name = ((body.name as string) || "").trim();
    const email = ((body.email as string) || "").trim();
    const phone = ((body.phone as string) || "").trim();
    const verificationToken = ((body.verificationToken as string) || "").trim();
    const locale = body.locale === "en" ? "en" : "es";

    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json(
        { error: "Name, valid email, and valid WhatsApp required" },
        { status: 400 },
      );
    }

    // One ticket per email: block before burning the verification token so
    // the buyer can fix the email and retry without re-verifying. The
    // webhook double-checks as a safety net (concurrent checkouts can both
    // pass this pre-check).
    const existing = await db
      .select({ id: schema.participations.id })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(
        and(
          eq(schema.participations.eventId, BROTE_EVENT_ID),
          inArray(schema.participations.status, ["confirmed", "used"]),
          sql`${schema.people.email} = ${email.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "duplicate_ticket" },
        { status: 409 },
      );
    }

    // Proof the buyer owns the inbox. Single-use: consuming here means an
    // MP failure after this point sends the buyer through verify again —
    // safe (the reverse order would leak unconsumed tokens).
    const consumed = await consumeEmailVerification(verificationToken, email);
    if (!consumed) {
      return NextResponse.json(
        { error: "verification_required" },
        { status: 403 },
      );
    }

    // Same helper the landing renders from, so the price shown and the price
    // charged cannot drift apart.
    const { raw: price, isEarlyBird } = currentTicketPrice();
    const title = `BROTE — Entrada${isEarlyBird ? " (Preventa)" : ""}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

    const preference = await new Preference(getMp()).create({
      body: {
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
          pending: `${baseUrl}/${locale}/brote/failure`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/brote/webhook`,
        // buyer_* in metadata is the durable fallback: MP propagates
        // preference metadata onto the Payment, so the webhook can recover
        // the verified identity even if the Redis stash expired.
        metadata: {
          type: "ticket",
          buyer_email: email,
          buyer_name: name,
        },
        payer: {
          name,
          email,
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

    // Stash verified buyer info + Meta tracking under two keys so the
    // webhook can recover it: `preference_id` may be absent on the Payment
    // object, but `payer.email` is reliable.
    try {
      const redis = await getRedis();
      const stash = JSON.stringify({
        name,
        email,
        phone,
        locale,
        eventId,
        fbp,
        fbc,
        ip: ipHeader,
        ua: req.headers.get("user-agent") || "",
      });
      const emailKey = email.toLowerCase();
      await Promise.all([
        redis.set(`brote:checkout:${preferenceId}`, stash, { EX: 86400 }),
        redis.set(`brote:checkout-by-email:${emailKey}`, stash, {
          EX: 86400,
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
        event_source_url: `${baseUrl}/${locale}/brote/checkout`,
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

    return NextResponse.json({ init_point: url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}
