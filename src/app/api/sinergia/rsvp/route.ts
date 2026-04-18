import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sinergiaConfig } from "@/data/sinergia";
import {
  CapacityReachedError,
  recordParticipation,
} from "@/lib/community";
import { isValidEmail, nextSinergiaDate } from "@/lib/sinergia-types";
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

async function ensureSinergiaEvent(sessionDate: string): Promise<string> {
  const eventId = `sinergia-${sessionDate}`;
  const eventDate = new Date(`${sessionDate}T19:30:00-03:00`);
  const status = eventDate < new Date() ? "past" : "upcoming";

  await db
    .insert(schema.events)
    .values({
      id: eventId,
      type: "sinergia",
      series: "sinergia",
      name: `Sinergia — ${sessionDate}`,
      date: eventDate,
      capacity: sinergiaConfig.capacity,
      status,
    })
    .onConflictDoNothing();

  return eventId;
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
    const name = ((body.name as string) || "").trim();
    const email = ((body.email as string) || "").trim();
    const staysForDinner = Boolean(body.staysForDinner);

    if (!name || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Name and valid email required" },
        { status: 400 },
      );
    }

    const sessionDate = nextSinergiaDate();
    const eventId = await ensureSinergiaEvent(sessionDate);

    const rsvpId = `SIN-${nanoid(8).toUpperCase()}`;

    let result;
    try {
      result = await recordParticipation({
        email,
        name,
        eventId,
        participationId: rsvpId,
        role: "rsvp",
        status: "confirmed",
        metadata: { staysForDinner },
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

    const confirmedCount = await countConfirmed(eventId);
    const remaining = Math.max(0, sinergiaConfig.capacity - confirmedCount);

    if (!result.created && !result.promoted) {
      return NextResponse.json({
        ok: true,
        alreadyRegistered: true,
        rsvpId: result.participationId,
        sessionDate,
        remaining,
      });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    // Confirmation email.
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

    // Host notification.
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
            totalRegistered: confirmedCount,
            remaining,
            capacity: sinergiaConfig.capacity,
          }),
        });
      } catch (err) {
        console.error("Sinergia host notification failed:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      rsvpId: result.participationId,
      sessionDate,
      remaining,
    });
  } catch (error) {
    console.error("sinergia/rsvp error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
