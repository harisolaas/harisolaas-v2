import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { applyBroteContactConfirmation } from "@/lib/brote-contact";
import {
  CONFIRM_TTL,
  confirmTicketKey,
  pendingContactKey,
  type PendingContact,
} from "@/lib/brote-confirm-token";
import {
  markBroteTicketEmailSent,
  sendBroteTicketEmail,
} from "@/lib/brote-ticket-email";
import { BROTE_EVENT_ID } from "@/data/brote";

/**
 * Post-payment contact confirmation for BROTE.
 *
 * No session auth: the `ct` capability token IS the authorization. It is
 * unguessable (nanoid 21), scoped to one checkout, expires in 7 days, and
 * only ever appears in the browser that made the purchase. Deliberately not
 * keyed on `payment_id` — MP payment ids are sequential integers, so that
 * would let anyone enumerate their way into redirecting someone's ticket.
 */

// Same envelope as the sibling BROTE routes.
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

const MAX_NAME = 120;
const MAX_PHONE = 30;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function readToken(raw: string | null): string {
  const token = (raw ?? "").trim();
  // Shape check before it reaches Redis — nanoid(21) is url-safe base64.
  return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : "";
}

async function resolveTicketId(token: string): Promise<string | null> {
  try {
    const redis = await getRedis();
    return await redis.get(confirmTicketKey(token));
  } catch (err) {
    console.error("brote/confirm-contact: redis read failed:", err);
    return null;
  }
}

/** Prefill the form with whatever we already know about this ticket. */
export async function GET(req: Request) {
  const token = readToken(new URL(req.url).searchParams.get("token"));
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const ticketId = await resolveTicketId(token);
  if (!ticketId) {
    // Normal, not exceptional: the webhook is async and MP redirects
    // instantly, so the ticket usually doesn't exist yet.
    return NextResponse.json({ found: false });
  }

  const rows = await db
    .select({
      metadata: schema.participations.metadata,
      email: schema.people.email,
      name: schema.people.name,
      phone: schema.people.phone,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.id, ticketId))
    .limit(1);

  if (rows.length === 0) return NextResponse.json({ found: false });
  const row = rows[0];
  const meta = (row.metadata as Record<string, unknown>) ?? {};

  return NextResponse.json({
    found: true,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    confirmed: Boolean(meta.contact),
  });
}

export async function POST(req: Request) {
  try {
    if (isRateLimited(clientIp(req))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const token = readToken(body.token as string | null);
    const name = ((body.name as string) || "").trim().slice(0, MAX_NAME);
    const email = ((body.email as string) || "").trim();
    const phone = ((body.phone as string) || "").trim().slice(0, MAX_PHONE);

    if (!token) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }
    if (!name || !isValidEmail(email) || !isValidWhatsApp(phone)) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    }

    const ticketId = await resolveTicketId(token);

    // ── No ticket yet: the normal case. Park the contact for the webhook.
    if (!ticketId) {
      const pending: PendingContact = {
        name,
        // Normalized before parking: the webhook writes this straight into
        // `people.email` via recordParticipation, which only trims. Keeping
        // the stored form consistent with the applied path
        // (`applyBroteContactConfirmation` lowercases) means the canonical
        // address doesn't depend on which path got there first.
        email: email.toLowerCase(),
        phone,
        confirmedAt: new Date().toISOString(),
      };
      try {
        const redis = await getRedis();
        await redis.set(pendingContactKey(token), JSON.stringify(pending), {
          EX: CONFIRM_TTL,
        });
      } catch (err) {
        console.error("brote/confirm-contact: failed to park contact:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
      // Nothing is issued here — a ticket only ever comes from an approved
      // payment in the webhook.
      return NextResponse.json({ ok: true, outcome: "pending" });
    }

    // ── Ticket exists: apply now, and resend if the address moved.
    const result = await applyBroteContactConfirmation({
      participationId: ticketId,
      eventId: BROTE_EVENT_ID,
      name,
      email,
      phone,
    });

    if (result.outcome === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (result.outcome === "email_taken") {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    let resent = false;
    if (result.shouldResend) {
      try {
        const treeCountRes = await db
          .select({ n: count() })
          .from(schema.participations)
          .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
        await sendBroteTicketEmail({
          tickets: [
            { ticketId, treeNumber: Number(treeCountRes[0]?.n ?? 1) },
          ],
          to: result.to,
          buyerName: result.buyerName,
          paymentId: result.paymentId,
        });
        await markBroteTicketEmailSent([ticketId]);
        resent = true;
      } catch (err) {
        // The contact change is already committed and is the thing that
        // matters; a failed resend is recoverable from the admin. Don't
        // fail the request and make the person retype everything.
        console.error("brote/confirm-contact: resend failed:", ticketId, err);
      }
    }

    return NextResponse.json({
      ok: true,
      outcome: "applied",
      emailChanged: result.emailChanged,
      resent,
    });
  } catch (error) {
    console.error("brote/confirm-contact error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
