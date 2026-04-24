import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { plantConfig } from "@/data/brote";
import {
  CapacityReachedError,
  recordParticipation,
} from "@/lib/community";
import { buildAttribution } from "@/lib/attribution";
import { type GroupType, isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { buildPlantConfirmationEmailHtml } from "@/lib/plant-email";

const PLANT_EVENT_ID = "plant-2026-04";

// Rate limit: 5 requests per IP per 60s.
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

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

function isValidGroupType(v: unknown): v is GroupType {
  return v === "solo" || v === "con-alguien" || v === "grupo";
}

async function countConfirmed(eventId: string): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, eventId),
        eq(schema.participations.status, "confirmed"),
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
    const action = body.action as string | undefined;
    const email = (body.email as string || "").trim();
    const phone = (body.phone as string || "").trim();

    // ── Waitlist flow ─────────────────────────────────────────────
    if (action === "waitlist") {
      if (!isValidEmail(email) || !isValidWhatsApp(phone)) {
        return NextResponse.json(
          { error: "Valid email and WhatsApp required" },
          { status: 400 },
        );
      }

      // Deterministic id so a re-POSTed waitlist stays idempotent.
      const hash = createHash("sha1").update(email.toLowerCase()).digest("hex");
      const waitlistId = `PLANT-WL-${hash.slice(0, 8).toUpperCase()}`;

      await recordParticipation({
        email,
        name: email, // no name captured on the waitlist form
        phone,
        eventId: PLANT_EVENT_ID,
        participationId: waitlistId,
        role: "planter",
        status: "waitlist",
      });

      return NextResponse.json({ ok: true, waitlisted: true });
    }

    // ── Full registration flow ────────────────────────────────────
    const name = (body.name as string || "").trim();
    const groupType = body.groupType;
    const carpool = Boolean(body.carpool);
    const message =
      (body.message as string || "").trim().slice(0, 280) || undefined;
    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json(
        { error: "Name, valid email, and valid WhatsApp required" },
        { status: 400 },
      );
    }
    if (!isValidGroupType(groupType)) {
      return NextResponse.json({ error: "Invalid group type" }, { status: 400 });
    }

    const registrationId = `PLANT-${nanoid(8).toUpperCase()}`;
    const attribution = buildAttribution({ req, body });

    let result;
    try {
      result = await recordParticipation({
        email,
        name,
        phone,
        eventId: PLANT_EVENT_ID,
        participationId: registrationId,
        role: "planter",
        status: "confirmed",
        attribution,
        metadata: {
          groupType,
          carpool,
          ...(message ? { message } : {}),
        },
      });
    } catch (err) {
      if (err instanceof CapacityReachedError) {
        return NextResponse.json(
          { ok: false, full: true, error: "Capacity reached" },
          { status: 409 },
        );
      }
      throw err;
    }

    const confirmedCount = await countConfirmed(PLANT_EVENT_ID);
    const remaining = Math.max(0, plantConfig.capacity - confirmedCount);

    // Idempotent re-submission by the same email.
    if (!result.created && !result.promoted) {
      return NextResponse.json({
        ok: true,
        alreadyRegistered: true,
        registrationId: result.participationId,
        remaining,
      });
    }

    // Fire-and-forget confirmation email.
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      await getResend().emails.send({
        from: `BROTE <${fromEmail}>`,
        to: email,
        subject: "¡Te anotaste para plantar! 🌱 Detalles del evento",
        html: buildPlantConfirmationEmailHtml(name),
      });
    } catch (err) {
      console.error("Plant registration email failed:", err);
    }

    return NextResponse.json({
      ok: true,
      registrationId: result.participationId,
      remaining,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
