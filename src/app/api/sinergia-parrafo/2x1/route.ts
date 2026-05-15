import { NextResponse } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { nanoid } from "nanoid";
import { db, schema } from "@/db";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";
import { isValidEmail, isValidWhatsApp } from "@/lib/sinergia-types";
import { buildAttribution, type UtmBody } from "@/lib/attribution";
import { getRedis } from "@/lib/redis";

// 2x1 invitation codes for Sinergia × Párrafo. One code = one paid ticket
// covering two attendees (primary + companion). Codes are single-use.
//
// Redis layout:
//   sinergia-parrafo:2x1:{CODE}    → "valid" | "used"
//   sinergia-parrafo:2x1:codes     → SET of all generated codes (index)
//   sinergia-parrafo:2x1:checkout:{preferenceId} → JSON stash
//
// The webhook resolves the stash from the MP preference id, creates two
// participations, and marks the code "used" only after MP confirms payment.

const CODE_PREFIX = "SP-2X1-";
const CODE_KEY = (code: string) => `sinergia-parrafo:2x1:${code}`;
const CODES_INDEX_KEY = "sinergia-parrafo:2x1:codes";
const CHECKOUT_KEY = (preferenceId: string) =>
  `sinergia-parrafo:2x1:checkout:${preferenceId}`;

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

// In-process rate limit, same shape as the regular checkout route.
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

function isAdmin(req: Request): boolean {
  const secret = req.headers.get("authorization");
  return secret === `Bearer ${process.env.BROTE_ADMIN_SECRET}`;
}

function normalizeCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
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
        eq(schema.participations.eventId, sinergiaParrafoConfig.eventId),
        inArray(schema.participations.status, ["confirmed", "used"]),
      ),
    );
  return Number(res[0]?.n ?? 0);
}

interface PersonInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
}

interface NormalizedPerson {
  name: string;
  email: string;
  phone: string;
}

function normalizePerson(p: PersonInput | undefined): NormalizedPerson {
  return {
    name: typeof p?.name === "string" ? p.name.trim() : "",
    email: typeof p?.email === "string" ? p.email.trim() : "",
    phone: typeof p?.phone === "string" ? p.phone.trim() : "",
  };
}

function personValid(p: NormalizedPerson): boolean {
  return Boolean(p.name) && isValidEmail(p.email) && isValidWhatsApp(p.phone);
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: { action?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const redis = await getRedis();

  // ─────────── Public: validate ───────────
  if (action === "validate") {
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json({ valid: false, reason: "missing" });
    }
    const status = await redis.get(CODE_KEY(code));
    if (!status) {
      return NextResponse.json({ valid: false, reason: "invalid" });
    }
    if (status === "used") {
      return NextResponse.json({ valid: false, reason: "used" });
    }
    return NextResponse.json({ valid: true, code });
  }

  // ─────────── Public: checkout ───────────
  if (action === "checkout") {
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Missing code" },
        { status: 400 },
      );
    }
    const codeStatus = await redis.get(CODE_KEY(code));
    if (codeStatus !== "valid") {
      return NextResponse.json(
        {
          ok: false,
          error: codeStatus === "used" ? "Code already used" : "Invalid code",
        },
        { status: 403 },
      );
    }

    const personOne = normalizePerson(body.personOne as PersonInput | undefined);
    const personTwo = normalizePerson(body.personTwo as PersonInput | undefined);
    if (!personValid(personOne) || !personValid(personTwo)) {
      return NextResponse.json(
        { ok: false, error: "Both attendees need name, valid email, and WhatsApp" },
        { status: 400 },
      );
    }
    if (personOne.email.toLowerCase() === personTwo.email.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "Both attendees need distinct emails" },
        { status: 400 },
      );
    }

    const locale = body.locale === "en" ? "en" : "es";

    // Pre-flight capacity check. A 2x1 takes 2 seats. The webhook still
    // enforces capacity authoritatively under a row lock for each insert,
    // but the pre-flight stops obviously doomed checkouts.
    await ensureEvent();
    const occupied = await countOccupied();
    if (occupied + 2 > sinergiaParrafoConfig.capacity) {
      return NextResponse.json(
        { ok: false, full: true, error: "Capacity reached" },
        { status: 409 },
      );
    }

    const attribution = buildAttribution({
      req,
      body: {
        utm: body.utm as UtmBody | null | undefined,
        linkSlug: body.linkSlug as string | null | undefined,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
    const preference = await new Preference(getMp()).create({
      body: {
        items: [
          {
            id: "sinergia-parrafo-ticket-2x1",
            title: "Sinergia × Párrafo — Entrada 2x1 (16/05/2026)",
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
          type: "sinergia-parrafo-2x1",
          event_id: sinergiaParrafoConfig.eventId,
          twox1_code: code,
        },
        payer: {
          name: personOne.name,
          email: personOne.email,
        },
      },
    });

    const preferenceId = preference.id;
    if (!preferenceId) {
      return NextResponse.json(
        { ok: false, error: "Failed to create checkout" },
        { status: 502 },
      );
    }

    // Stash both attendees + the 2x1 code under the preference id. The
    // webhook reads this to create the two participations.
    try {
      await redis.set(
        CHECKOUT_KEY(preferenceId),
        JSON.stringify({
          mode: "2x1",
          code,
          personOne,
          personTwo,
          locale,
          attribution: attribution ?? null,
          ip,
          ua: req.headers.get("user-agent") || "",
        }),
        { EX: 86400 },
      );
    } catch (err) {
      console.error("sinergia-parrafo 2x1: failed to stash checkout meta:", err);
      // Bail rather than continue: without the stash the webhook can't seat
      // the companion, and MP's payer object is unreliable for our case.
      return NextResponse.json(
        { ok: false, error: "Failed to persist checkout" },
        { status: 502 },
      );
    }

    const initPoint =
      process.env.NODE_ENV === "development"
        ? (preference.sandbox_init_point ?? preference.init_point ?? null)
        : (preference.init_point ?? null);
    if (!initPoint) {
      return NextResponse.json(
        { ok: false, error: "Failed to create checkout" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, initPoint });
  }

  // ─────────── Admin: generate / list / reset / revoke ───────────
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "generate") {
    const requested = Number(body.count);
    const count = Number.isFinite(requested)
      ? Math.max(1, Math.min(100, Math.floor(requested)))
      : 1;
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = `${CODE_PREFIX}${nanoid(6).toUpperCase()}`;
      await redis.set(CODE_KEY(code), "valid");
      await redis.sAdd(CODES_INDEX_KEY, code);
      codes.push(code);
    }
    return NextResponse.json({ ok: true, codes });
  }

  if (action === "list") {
    const codes = await redis.sMembers(CODES_INDEX_KEY);
    const rows = await Promise.all(
      codes.sort().map(async (code: string) => ({
        code,
        status: (await redis.get(CODE_KEY(code))) ?? "missing",
      })),
    );
    return NextResponse.json({ ok: true, codes: rows });
  }

  if (action === "reset") {
    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    const exists = await redis.get(CODE_KEY(code));
    if (!exists) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }
    await redis.set(CODE_KEY(code), "valid");
    return NextResponse.json({ ok: true, code, status: "valid" });
  }

  if (action === "revoke") {
    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }
    await redis.del(CODE_KEY(code));
    await redis.sRem(CODES_INDEX_KEY, code);
    return NextResponse.json({ ok: true, code });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const redis = await getRedis();
  const codes = await redis.sMembers(CODES_INDEX_KEY);
  const rows = await Promise.all(
    codes.sort().map(async (code: string) => ({
      code,
      status: (await redis.get(CODE_KEY(code))) ?? "missing",
    })),
  );
  return NextResponse.json({ ok: true, codes: rows });
}
