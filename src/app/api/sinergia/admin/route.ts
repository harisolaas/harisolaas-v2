import { NextResponse } from "next/server";
import { Resend } from "resend";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { sinergiaConfig } from "@/data/sinergia";
import { formatSessionDateEs } from "@/lib/sinergia-types";
import { buildSinergiaErratumEmailHtml } from "@/lib/sinergia-email";

// POST /api/sinergia/admin
// Bearer $BROTE_ADMIN_SECRET
//
// Actions:
//   { action: "migrate-to-first-session", fromDate?: "YYYY-MM-DD" }
//   { action: "send-erratum", emails: string[], oldDate: "YYYY-MM-DD" }
//
// Erratum-sent state is kept in Redis (`sinergia:rsvp:{id}:erratum-sent`)
// as a simple idempotency flag; entity data (RSVPs, sessions) lives in
// Postgres under the Spec 01 model.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.BROTE_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    fromDate?: string;
    oldDate?: string;
    emails?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "migrate-to-first-session") {
    return handleMigrate(body.fromDate ?? "2026-04-15");
  }

  if (body.action === "send-erratum") {
    if (!Array.isArray(body.emails) || body.emails.length === 0) {
      return NextResponse.json({ error: "emails[] required" }, { status: 400 });
    }
    return handleSendErratum(body.emails, body.oldDate ?? "2026-04-15");
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handleMigrate(fromDate: string) {
  const toDate = sinergiaConfig.firstSessionDate;
  if (!toDate || fromDate >= toDate) {
    return NextResponse.json(
      { error: "fromDate must be before firstSessionDate" },
      { status: 400 },
    );
  }

  const fromEventId = `sinergia-${fromDate}`;
  const toEventId = `sinergia-${toDate}`;

  try {
    // Ensure destination event exists.
    const toDateObj = new Date(`${toDate}T19:30:00-03:00`);
    await db
      .insert(schema.events)
      .values({
        id: toEventId,
        type: "sinergia",
        series: "sinergia",
        name: `Sinergia — ${toDate}`,
        date: toDateObj,
        capacity: sinergiaConfig.capacity,
        status: toDateObj < new Date() ? "past" : "upcoming",
      })
      .onConflictDoNothing();

    // Load participants that will migrate so we know who to email.
    const affected = await db
      .select({
        id: schema.participations.id,
        email: schema.people.email,
        name: schema.people.name,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.eventId, fromEventId));

    // Reassign in a single UPDATE. (person_id, event_id) unique constraint
    // means if someone already has an RSVP for toDate, the UPDATE will fail;
    // we pre-filter those and skip to keep the migration idempotent.
    const existingAtDest = await db
      .select({ personId: schema.participations.personId })
      .from(schema.participations)
      .where(eq(schema.participations.eventId, toEventId));
    const destPersonIds = new Set(existingAtDest.map((r) => r.personId));

    let migrated = 0;
    await db.transaction(async (tx) => {
      for (const row of affected) {
        // Look up person_id for this participation.
        const personRow = await tx
          .select({ personId: schema.participations.personId })
          .from(schema.participations)
          .where(eq(schema.participations.id, row.id))
          .limit(1);
        const personId = personRow[0]?.personId;
        if (personId == null) continue;
        if (destPersonIds.has(personId)) {
          // Already has an RSVP at the destination — cancel the duplicate at source.
          await tx
            .update(schema.participations)
            .set({ status: "cancelled", updatedAt: sql`NOW()` })
            .where(eq(schema.participations.id, row.id));
          continue;
        }
        await tx
          .update(schema.participations)
          .set({ eventId: toEventId, updatedAt: sql`NOW()` })
          .where(eq(schema.participations.id, row.id));
        destPersonIds.add(personId);
        migrated++;
      }
    });

    // Send erratum emails with the same Redis-flag-based idempotency.
    const redis = await getRedis();
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    let emailsSent = 0;
    const emailsFailed: { email: string; reason: string }[] = [];

    for (const row of affected) {
      if (!row.email) continue;
      const flagKey = `sinergia:rsvp:${row.id}:erratum-sent`;
      if (await redis.get(flagKey)) continue;

      const result = await sendErratum(resend, fromEmail, {
        email: row.email,
        name: row.name,
        oldDate: fromDate,
        newDate: toDate,
      });
      if (result.ok) {
        await redis.set(flagKey, "1");
        emailsSent++;
      } else {
        emailsFailed.push({ email: row.email, reason: result.reason });
      }
      await sleep(600);
    }

    return NextResponse.json({
      ok: true,
      fromDate,
      toDate,
      migrated,
      emailsSent,
      emailsFailed,
    });
  } catch (err) {
    console.error("Sinergia admin migrate failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function handleSendErratum(emails: string[], oldDate: string) {
  const toDate = sinergiaConfig.firstSessionDate;
  try {
    const redis = await getRedis();
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
    const toEventId = `sinergia-${toDate}`;

    let sent = 0;
    const failed: { email: string; reason: string }[] = [];

    for (const rawEmail of emails) {
      const email = rawEmail.trim();
      const personRow = await db
        .select({ name: schema.people.name })
        .from(schema.people)
        .where(eq(schema.people.email, email))
        .limit(1);
      const name = personRow[0]?.name ?? "hola";

      const result = await sendErratum(resend, fromEmail, {
        email,
        name,
        oldDate,
        newDate: toDate,
      });
      if (result.ok) {
        sent++;
        // Mark every participation at toEventId with this email as erratum-sent.
        const parts = await db
          .select({ id: schema.participations.id })
          .from(schema.participations)
          .innerJoin(
            schema.people,
            eq(schema.people.id, schema.participations.personId),
          )
          .where(
            and(
              eq(schema.participations.eventId, toEventId),
              eq(schema.people.email, email),
            ),
          );
        for (const p of parts) {
          await redis.set(`sinergia:rsvp:${p.id}:erratum-sent`, "1");
        }
      } else {
        failed.push({ email, reason: result.reason });
      }
      await sleep(600);
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    console.error("Sinergia admin send-erratum failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function sendErratum(
  resend: Resend,
  fromEmail: string,
  params: { email: string; name: string; oldDate: string; newDate: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await resend.emails.send({
      from: `Sinergia <${fromEmail}>`,
      to: params.email,
      subject: `Fe de erratas — Sinergia arranca el ${formatSessionDateEs(params.newDate)}`,
      html: buildSinergiaErratumEmailHtml({
        name: params.name,
        oldDate: params.oldDate,
        newDate: params.newDate,
      }),
    });
    if (res.error) {
      return { ok: false, reason: res.error.message || String(res.error) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
