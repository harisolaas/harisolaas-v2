import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { plantConfig } from "@/data/brote";
import {
  type PlantRegistration,
  type CommunityPerson,
  type GroupType,
  isValidEmail,
} from "@/lib/plant-types";
import { buildPlantConfirmationEmailHtml } from "@/lib/plant-email";

// Rate limit: 5 requests per IP per 60s
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

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const action = body.action as string | undefined;
    const email = (body.email as string || "").trim().toLowerCase();

    const redis = await getRedis();

    // ── Waitlist flow ─────────────────────────────────────────────
    if (action === "waitlist") {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      }
      await redis.sAdd("plant:waitlist", JSON.stringify({
        email,
        createdAt: new Date().toISOString(),
      }));
      return NextResponse.json({ ok: true, waitlisted: true });
    }

    // ── Full registration flow ────────────────────────────────────
    const name = (body.name as string || "").trim();
    const groupType = body.groupType;
    const carpool = Boolean(body.carpool);
    const message = (body.message as string || "").trim().slice(0, 280) || undefined;
    const utm = body.utm as { source?: string; medium?: string; campaign?: string } | undefined;

    if (!name || !isValidEmail(email)) {
      return NextResponse.json({ error: "Name and valid email required" }, { status: 400 });
    }
    if (!isValidGroupType(groupType)) {
      return NextResponse.json({ error: "Invalid group type" }, { status: 400 });
    }

    // Check capacity
    const currentCount = Number(await redis.get("plant:counter") ?? 0);
    if (currentCount >= plantConfig.capacity) {
      return NextResponse.json(
        { ok: false, full: true, error: "Capacity reached" },
        { status: 409 },
      );
    }

    // Idempotency: check if this email already registered for planting
    const existingPersonRaw = await redis.get(`community:person:${email}`);
    if (existingPersonRaw) {
      const person: CommunityPerson = JSON.parse(existingPersonRaw);
      const plantParticipation = person.participations.find((p) => p.event === "plant-2026-04");
      if (plantParticipation) {
        const remaining = Math.max(0, plantConfig.capacity - currentCount);
        return NextResponse.json({
          ok: true,
          alreadyRegistered: true,
          registrationId: plantParticipation.id,
          remaining,
        });
      }
    }

    // Create registration
    const registrationId = `PLANT-${nanoid(8).toUpperCase()}`;
    const registration: PlantRegistration = {
      id: registrationId,
      email,
      name,
      groupType,
      carpool,
      status: "registered",
      ...(message && { message }),
      createdAt: new Date().toISOString(),
      ...(utm && { utm }),
    };

    await redis.set(`plant:registration:${registrationId}`, JSON.stringify(registration));
    const newCount = await redis.incr("plant:counter");
    await redis.sAdd("plant:registrations", JSON.stringify({
      email,
      name,
      groupType,
      carpool,
      registrationId,
      createdAt: registration.createdAt,
    }));

    // Create or update community person
    const now = new Date().toISOString();
    const plantParticipation = {
      event: "plant-2026-04",
      role: "planter",
      id: registrationId,
      date: now,
    };

    if (existingPersonRaw) {
      const person: CommunityPerson = JSON.parse(existingPersonRaw);
      person.participations.push(plantParticipation);
      if (name && name !== person.name) person.name = name;
      await redis.set(`community:person:${email}`, JSON.stringify(person));
    } else {
      const person: CommunityPerson = {
        email,
        name,
        firstSeen: now,
        participations: [plantParticipation],
      };

      // Lazy-link BROTE attendance by email
      const attendeesRaw = await redis.sMembers("brote:attendees");
      for (const raw of attendeesRaw) {
        try {
          const a = JSON.parse(raw);
          if (a.email && a.email.toLowerCase() === email) {
            person.firstSeen = a.createdAt || now;
            person.participations.unshift({
              event: "brote",
              role: "attendee",
              id: a.ticketId || "unknown",
              date: a.createdAt || now,
            });
            break;
          }
        } catch { /* skip */ }
      }

      await redis.set(`community:person:${email}`, JSON.stringify(person));
    }

    // Send confirmation email (fire-and-forget style)
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

    const remaining = Math.max(0, plantConfig.capacity - newCount);
    return NextResponse.json({ ok: true, registrationId, remaining });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
