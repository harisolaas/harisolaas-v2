import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { recordParticipation } from "@/lib/community";
import { buildAttribution } from "@/lib/attribution";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { desafioStartDate, isRegistrationOpen } from "@/data/desafio";
import {
  countDesafioRegistrants,
  ensureDesafioEvent,
} from "@/lib/desafio-server";
import {
  buildDesafioConfirmationEmailHtml,
  buildDesafioHostNotificationHtml,
  desafioConfirmationSubject,
} from "@/lib/desafio-email";

// Same in-memory limiter as /api/sinergia/rsvp: 5 requests / IP / 60s.
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

function notifyList(): string[] {
  const raw =
    process.env.DESAFIO_NOTIFY_EMAILS || process.env.SINERGIA_NOTIFY_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// POST /api/desafio/register
// { name, email, phone, locale, utm?, linkSlug? }
export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (typeof body.name === "string" ? body.name : "").trim();
    const email = (typeof body.email === "string" ? body.email : "").trim();
    const phone = (typeof body.phone === "string" ? body.phone : "").trim();
    const locale = body.locale === "en" ? "en" : "es";

    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json(
        { error: "Name, valid email, and valid WhatsApp required" },
        { status: 400 },
      );
    }

    if (!isRegistrationOpen(new Date())) {
      return NextResponse.json({ ok: false, closed: true }, { status: 409 });
    }

    const eventId = await ensureDesafioEvent();
    const attribution = buildAttribution({ req, body });

    // Capacity is null, so no CapacityReachedError path. bypassLinkSlug is
    // still passed so referral links stamp referred_by_person_id.
    const result = await recordParticipation({
      email,
      name,
      phone,
      eventId,
      participationId: `DES-${nanoid(8).toUpperCase()}`,
      role: "participant",
      status: "confirmed",
      attribution,
      metadata: { locale },
      bypassLinkSlug: attribution?.linkSlug,
    });
    const alreadyRegistered = !result.created && !result.promoted;

    // Emails only on a fresh registration; a repeat submit is a no-op for
    // the inbox. Each send has its own try/catch — a mail failure never
    // un-registers anyone.
    if (!alreadyRegistered) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
      const from = `Desafío 15 días <${fromEmail}>`;

      try {
        await getResend().emails.send({
          from,
          to: email,
          subject: desafioConfirmationSubject(locale),
          html: buildDesafioConfirmationEmailHtml({
            name,
            locale,
            startDate: desafioStartDate(),
          }),
        });
      } catch (err) {
        console.error("Desafío confirmation email failed:", err);
      }

      const to = notifyList();
      if (to.length > 0) {
        try {
          const totalRegistered = await countDesafioRegistrants(eventId);
          await getResend().emails.send({
            from,
            to,
            subject: `Nueva inscripción Desafío — ${name}`,
            html: buildDesafioHostNotificationHtml({
              name,
              email,
              phone,
              locale,
              totalRegistered,
            }),
          });
        } catch (err) {
          console.error("Desafío host notification failed:", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      participationId: result.participationId,
      ...(alreadyRegistered ? { alreadyRegistered: true } : {}),
    });
  } catch (error) {
    console.error("desafio/register error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
