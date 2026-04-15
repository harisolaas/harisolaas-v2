import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { sinergiaConfig } from "@/data/sinergia";
import type { CommunityPerson } from "@/lib/plant-types";
import {
  communityEventForSession,
  isValidEmail,
  nextSinergiaDate,
  type SinergiaAttendeeEntry,
  type SinergiaRsvp,
  type SinergiaSession,
} from "@/lib/sinergia-types";
import {
  buildSinergiaConfirmationEmailHtml,
  buildSinergiaHostNotificationHtml,
} from "@/lib/sinergia-email";

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

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const name = ((body.name as string) || "").trim();
    const email = ((body.email as string) || "").trim().toLowerCase();
    const staysForDinner = Boolean(body.staysForDinner);

    if (!name || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Name and valid email required" },
        { status: 400 },
      );
    }

    const redis = await getRedis();
    const sessionDate = nextSinergiaDate();
    const sessionKey = `sinergia:session:${sessionDate}`;
    const counterKey = `${sessionKey}:counter`;
    const rsvpsSetKey = `${sessionKey}:rsvps`;

    // Ensure session exists
    let session: SinergiaSession;
    const sessionRaw = await redis.get(sessionKey);
    if (sessionRaw) {
      session = JSON.parse(sessionRaw);
    } else {
      session = {
        date: sessionDate,
        capacity: sinergiaConfig.capacity,
        status: "open",
      };
      await redis.set(sessionKey, JSON.stringify(session));
    }

    // Idempotency: check if this email already RSVP'd for this session
    const personEventId = communityEventForSession(sessionDate);
    const existingPersonRaw = await redis.get(`community:person:${email}`);
    if (existingPersonRaw) {
      const person: CommunityPerson = JSON.parse(existingPersonRaw);
      const existing = person.participations.find(
        (p) => p.event === personEventId,
      );
      if (existing) {
        const count = Number((await redis.get(counterKey)) ?? 0);
        const remaining = Math.max(0, session.capacity - count);
        return NextResponse.json({
          ok: true,
          alreadyRegistered: true,
          rsvpId: existing.id,
          sessionDate,
          remaining,
        });
      }
    }

    // Capacity check
    const currentCount = Number((await redis.get(counterKey)) ?? 0);
    if (currentCount >= session.capacity) {
      return NextResponse.json(
        { ok: false, full: true, error: "Capacity reached" },
        { status: 409 },
      );
    }

    // Create RSVP
    const rsvpId = `SIN-${nanoid(8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const rsvp: SinergiaRsvp = {
      id: rsvpId,
      sessionDate,
      email,
      name,
      staysForDinner,
      createdAt,
      status: "registered",
    };

    await redis.set(`sinergia:rsvp:${rsvpId}`, JSON.stringify(rsvp));
    const newCount = await redis.incr(counterKey);
    const attendeeEntry: SinergiaAttendeeEntry = {
      email,
      name,
      staysForDinner,
      rsvpId,
      createdAt,
    };
    await redis.sAdd(rsvpsSetKey, JSON.stringify(attendeeEntry));

    // Update session status if it just filled
    if (newCount >= session.capacity) {
      session.status = "full";
      await redis.set(sessionKey, JSON.stringify(session));
    }

    // Update community:person
    const participation = {
      event: personEventId,
      role: "participant",
      id: rsvpId,
      date: createdAt,
    };

    if (existingPersonRaw) {
      const person: CommunityPerson = JSON.parse(existingPersonRaw);
      person.participations.push(participation);
      if (name && name !== person.name) person.name = name;
      await redis.set(`community:person:${email}`, JSON.stringify(person));
    } else {
      const person: CommunityPerson = {
        email,
        name,
        firstSeen: createdAt,
        participations: [participation],
      };

      // Lazy-link BROTE attendance by email
      const attendeesRaw = await redis.sMembers("brote:attendees");
      for (const raw of attendeesRaw) {
        try {
          const a = JSON.parse(raw);
          if (a.email && a.email.toLowerCase() === email) {
            person.firstSeen = a.createdAt || createdAt;
            person.participations.unshift({
              event: "brote",
              role: "attendee",
              id: a.ticketId || "unknown",
              date: a.createdAt || createdAt,
            });
            break;
          }
        } catch { /* skip */ }
      }

      await redis.set(`community:person:${email}`, JSON.stringify(person));
    }

    const remaining = Math.max(0, session.capacity - newCount);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    // Send confirmation email
    try {
      await getResend().emails.send({
        from: `Sinergia <${fromEmail}>`,
        to: email,
        subject: "Nos vemos el miércoles — acá va la dirección",
        html: buildSinergiaConfirmationEmailHtml({
          name,
          sessionDate,
          staysForDinner,
        }),
      });
    } catch (err) {
      console.error("Sinergia confirmation email failed:", err);
    }

    // Notify hosts
    const notifyList = (process.env.SINERGIA_NOTIFY_EMAILS || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (notifyList.length > 0) {
      try {
        await getResend().emails.send({
          from: `Sinergia <${fromEmail}>`,
          to: notifyList,
          subject: `Nuevo RSVP Sinergia — ${name}`,
          html: buildSinergiaHostNotificationHtml({
            name,
            email,
            sessionDate,
            staysForDinner,
            totalRegistered: newCount,
            remaining,
            capacity: session.capacity,
          }),
        });
      } catch (err) {
        console.error("Sinergia host notification failed:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      rsvpId,
      sessionDate,
      remaining,
    });
  } catch (error) {
    console.error("sinergia/rsvp error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
