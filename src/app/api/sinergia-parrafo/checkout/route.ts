import { NextResponse } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db, schema } from "@/db";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";
import { isValidEmail, isValidWhatsApp } from "@/lib/sinergia-types";
import { buildAttribution } from "@/lib/attribution";
import { getRedis } from "@/lib/redis";

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

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
    })
    .onConflictDoNothing();
}

async function countOccupied(): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, sinergiaParrafoConfig.eventId),
        inArray(schema.participations.status, ["confirmed", "used"]),
      ),
    );
  return Number(res[0]?.n ?? 0);
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const name = ((body.name as string) || "").trim();
    const email = ((body.email as string) || "").trim();
    const phone = ((body.phone as string) || "").trim();
    const locale = body.locale === "en" ? "en" : "es";

    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json(
        { error: "Name, valid email, and valid WhatsApp required" },
        { status: 400 },
      );
    }

    // Pre-flight capacity check. Authoritative enforcement still happens
    // inside `recordParticipation` in the webhook (under a row lock), but
    // the pre-flight stops us from creating MP preferences for events
    // that are already full.
    await ensureEvent();
    const occupied = await countOccupied();
    if (occupied >= sinergiaParrafoConfig.capacity) {
      return NextResponse.json(
        { ok: false, full: true, error: "Capacity reached" },
        { status: 409 },
      );
    }

    const attribution = buildAttribution({ req, body });

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
    const preference = await new Preference(getMp()).create({
      body: {
        items: [
          {
            id: "sinergia-parrafo-ticket",
            title: "Sinergia × Párrafo — Entrada (16/05/2026)",
            quantity: 1,
            unit_price: sinergiaParrafoConfig.ticketPriceCents / 100,
            currency_id: sinergiaParrafoConfig.currency,
          },
        ],
        back_urls: {
          success: `${baseUrl}/${locale}/sinergia-parrafo/success`,
          failure: `${baseUrl}/${locale}/sinergia-parrafo/failure`,
          pending: `${baseUrl}/${locale}/sinergia-parrafo/failure`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/sinergia-parrafo/webhook`,
        metadata: {
          type: "sinergia-parrafo-ticket",
          event_id: sinergiaParrafoConfig.eventId,
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

    // Stash buyer info under the preference id so the webhook can write
    // the participation with our captured name/email/phone — MP's payer
    // object is unreliable for Account Money flows (often empty).
    // 24h TTL covers the longest plausible time between checkout and
    // payment confirmation.
    try {
      const redis = await getRedis();
      await redis.set(
        `sinergia-parrafo:checkout:${preferenceId}`,
        JSON.stringify({
          name,
          email,
          phone,
          locale,
          attribution: attribution ?? null,
          ip,
          ua: req.headers.get("user-agent") || "",
        }),
        { EX: 86400 },
      );
    } catch (err) {
      console.error(
        "sinergia-parrafo: failed to stash checkout meta:",
        err,
      );
      // Continue anyway — the webhook has fallbacks via MP's payer object,
      // and a manual recovery step exists if the buyer info is lost.
    }

    const initPoint =
      process.env.NODE_ENV === "development"
        ? (preference.sandbox_init_point ?? preference.init_point ?? null)
        : (preference.init_point ?? null);

    if (!initPoint) {
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, initPoint });
  } catch (error) {
    console.error("sinergia-parrafo/checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}
