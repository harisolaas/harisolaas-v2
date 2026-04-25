import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { and, count, eq, inArray } from "drizzle-orm";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db, schema } from "@/db";
import { sinergiaConfig } from "@/data/sinergia";
import {
  CapacityReachedError,
  recordParticipation,
} from "@/lib/community";
import { buildAttribution } from "@/lib/attribution";
import {
  isValidEmail,
  isValidWhatsApp,
  nextSinergiaDate,
} from "@/lib/sinergia-types";
import {
  buildSinergiaConfirmationEmailHtml,
  buildSinergiaHostNotificationHtml,
} from "@/lib/sinergia-email";

// Donation amount bounds in cents of ARS. 1.000 floor catches accidental
// zeros; 1.000.000 ceiling is a sanity guard — genuine donations that
// large should route through a direct conversation, not a landing form.
const MIN_DONATION_CENTS = 100_000;
const MAX_DONATION_CENTS = 100_000_000;

let _mp: MercadoPagoConfig | null = null;
function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

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

// Mirrors the capacity-enforcement query in `recordParticipation`
// (`status IN ('confirmed','used')`) so the response's `remaining`
// stays consistent with what would actually be enforced on the next
// RSVP — and so attendees marked `used` at the door don't free up a
// phantom spot in the count.
async function countOccupied(eventId: string): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, eventId),
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
    const staysForDinner = Boolean(body.staysForDinner);
    const locale = body.locale === "en" ? "en" : "es";

    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json(
        { error: "Name, valid email, and valid WhatsApp required" },
        { status: 400 },
      );
    }

    // Donation is optional. `donationDeclined:true` means the user opted
    // out via the checkbox. Any positive `donationAmountCents` triggers
    // an MP Preference; the RSVP is confirmed either way.
    const donationDeclined = Boolean(body.donationDeclined);
    const rawDonationAmount = Number(body.donationAmountCents);
    const donationAmountCents =
      !donationDeclined && Number.isFinite(rawDonationAmount) && rawDonationAmount > 0
        ? Math.round(rawDonationAmount)
        : 0;

    if (donationAmountCents > 0) {
      if (donationAmountCents < MIN_DONATION_CENTS) {
        return NextResponse.json(
          { error: "Donation below minimum" },
          { status: 400 },
        );
      }
      if (donationAmountCents > MAX_DONATION_CENTS) {
        return NextResponse.json(
          { error: "Donation above maximum" },
          { status: 400 },
        );
      }
    }

    const sessionDate = nextSinergiaDate();
    const eventId = await ensureSinergiaEvent(sessionDate);

    const rsvpId = `SIN-${nanoid(8).toUpperCase()}`;
    const attribution = buildAttribution({ req, body });

    // Pass the slug to recordParticipation; it resolves the link inside
    // the signup transaction so the bypass flag + referrer are read at
    // write time, not here. Closes the kill-switch race where an admin
    // archives the link between this handler starting and the insert.
    let result;
    try {
      result = await recordParticipation({
        email,
        name,
        phone,
        eventId,
        participationId: rsvpId,
        role: "rsvp",
        status: "confirmed",
        attribution,
        metadata: { staysForDinner },
        bypassLinkSlug: attribution?.linkSlug,
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

    const occupiedCount = await countOccupied(eventId);
    const remaining = Math.max(0, sinergiaConfig.capacity - occupiedCount);
    const alreadyRegistered = !result.created && !result.promoted;

    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    // Create the MP preference BEFORE the host notification so we know
    // whether the donation link was actually issued. If preference
    // creation fails (MP down, bad creds, rate-limited) the attendee
    // never gets redirected, and we don't want the host email to say
    // "aporte pendiente" for an intention that never left our server.
    let initPoint: string | null = null;
    let preferenceCreated = false;
    if (donationAmountCents > 0) {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
        const preference = await new Preference(getMp()).create({
          body: {
            items: [
              {
                id: "sinergia-donation",
                title: `Aporte Sinergia — ${sessionDate}`,
                quantity: 1,
                unit_price: donationAmountCents / 100,
                currency_id: "ARS",
              },
            ],
            back_urls: {
              success: `${baseUrl}/${locale}/sinergia/success`,
              failure: `${baseUrl}/${locale}/sinergia/failure`,
              pending: `${baseUrl}/${locale}/sinergia/failure`,
            },
            auto_return: "approved",
            notification_url: `${baseUrl}/api/sinergia/webhook`,
            metadata: {
              type: "sinergia-donation",
              rsvp_id: result.participationId,
              session_date: sessionDate,
            },
            external_reference: result.participationId,
          },
        });

        initPoint =
          process.env.NODE_ENV === "development"
            ? (preference.sandbox_init_point ?? preference.init_point ?? null)
            : (preference.init_point ?? null);
        preferenceCreated = Boolean(initPoint);
      } catch (err) {
        console.error("Sinergia MP preference failed:", err);
        // Fall through. Client receives the RSVP-success response with no
        // initPoint, which renders as the normal inline success state.
      }
    }

    // Fire the attendee confirmation + host notification only on a fresh
    // RSVP (or a waitlist promotion). Repeat submits from someone already
    // registered are no-ops for email to avoid duplicate inbox noise; the
    // donation flow above still runs for returning attendees who re-open
    // the form specifically to contribute.
    if (!alreadyRegistered) {
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
              phone,
              sessionDate,
              staysForDinner,
              totalRegistered: occupiedCount,
              remaining,
              capacity: sinergiaConfig.capacity,
              // Only surface the donation row once we actually got a
              // preference back from MP — otherwise the host sees
              // "aporte pendiente" for something the attendee never
              // had the chance to pay.
              donationAmountCents:
                preferenceCreated && donationAmountCents > 0
                  ? donationAmountCents
                  : null,
              donationStatus: preferenceCreated ? "pending" : undefined,
            }),
          });
        } catch (err) {
          console.error("Sinergia host notification failed:", err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      rsvpId: result.participationId,
      sessionDate,
      remaining,
      ...(alreadyRegistered ? { alreadyRegistered: true } : {}),
      ...(initPoint ? { initPoint } : {}),
    });
  } catch (error) {
    console.error("sinergia/rsvp error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
