import { NextResponse } from "next/server";

// BROTE event ended March 28, 2026. Checkout disabled.
// Original code preserved below for reference.

export async function POST() {
  return NextResponse.json(
    { error: "BROTE event has ended. Registration for tree planting is open at /brote" },
    { status: 410 },
  );
}

/* --- Original checkout code (preserved for future events) ---

import { MercadoPagoConfig, Preference } from "mercadopago";
import { broteConfig } from "@/data/brote";
import { getRedis } from "@/lib/redis";
import { sendMetaEvent } from "@/lib/meta-capi";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

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
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    const { eventId, fbp, fbc } = (await req.json()) as {
      eventId?: string;
      fbp?: string;
      fbc?: string;
    };

    // Early bird: check if we're before the deadline (end of day Argentina time, UTC-3)
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    const isEarlyBird = new Date() <= deadline;

    const price = isEarlyBird ? broteConfig.earlyBirdPriceRaw : broteConfig.ticketPriceRaw;
    const title = `BROTE — Entrada${isEarlyBird ? " (Preventa)" : ""}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

    const preference = await new Preference(mp).create({
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
          success: `${baseUrl}/es/brote/success`,
          failure: `${baseUrl}/es/brote/failure`,
          pending: `${baseUrl}/es/brote/failure`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/brote/webhook`,
        metadata: { type: "ticket" },
      },
    });

    // Store Meta tracking data in Redis for webhook to pick up
    const preferenceId = preference.id;
    if (preferenceId && (eventId || fbp || fbc)) {
      try {
        const redis = await getRedis();
        await redis.set(
          `brote:checkout:${preferenceId}`,
          JSON.stringify({
            eventId,
            fbp,
            fbc,
            ip,
            ua: req.headers.get("user-agent") || "",
          }),
          { EX: 86400 }, // 24h TTL
        );
      } catch (err) {
        console.error("Failed to store checkout meta:", err);
      }
    }

    // Fire Meta CAPI InitiateCheckout (server-side, dedup with browser event)
    if (eventId) {
      sendMetaEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        event_source_url: `${baseUrl}/es/brote`,
        user_data: {
          client_ip_address: ip,
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
*/
