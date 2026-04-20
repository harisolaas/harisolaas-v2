import { NextResponse } from "next/server";
import { Resend } from "resend";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { nextSinergiaDate } from "@/lib/sinergia-types";
import { buildSinergiaReminderEmailHtml } from "@/lib/sinergia-email";
import { sendBulkEmails } from "@/lib/bulk-email";
import { notifyAdminOfCampaign } from "@/lib/admin-alert";

// Runs via Vercel Cron (see vercel.json) every Wednesday at 13:00 UTC = 10:00 ART.
// Manual trigger: GET with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = await getRedis();
    const sessionDate = nextSinergiaDate();
    const today = todayInArg();

    if (sessionDate !== today) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "No session today",
        today,
        nextSession: sessionDate,
      });
    }

    const eventId = `sinergia-${sessionDate}`;
    const attendees = await db
      .select({
        rsvpId: schema.participations.id,
        email: schema.people.email,
        name: schema.people.name,
        metadata: schema.participations.metadata,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(
        and(
          eq(schema.participations.eventId, eventId),
          eq(schema.participations.status, "confirmed"),
        ),
      );

    const audience = attendees.filter(
      (a): a is typeof a & { email: string } => Boolean(a.email),
    );
    const missingEmail = attendees.length - audience.length;

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    const result = await sendBulkEmails({
      audience,
      resend,
      getEmail: (a) => a.email,
      build: (a) => {
        const meta = (a.metadata as Record<string, unknown>) ?? {};
        return {
          from: `Sinergia <${fromEmail}>`,
          to: a.email,
          subject: "Hoy miércoles — nos vemos a las 19:30",
          html: buildSinergiaReminderEmailHtml({
            name: a.name,
            sessionDate,
            staysForDinner: Boolean(meta.staysForDinner),
          }),
        };
      },
      shouldSkip: async (a) =>
        Boolean(await redis.get(`sinergia:rsvp:${a.rsvpId}:reminder`)),
      onSent: async (a) => {
        await redis.set(`sinergia:rsvp:${a.rsvpId}:reminder`, "1");
      },
      logPrefix: "sinergia-reminder",
    });

    const adminAlert = await notifyAdminOfCampaign({
      campaign: `sinergia-reminder-${sessionDate}`,
      audienceSize: audience.length,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      warnings: result.warnings,
      missingEmails: missingEmail,
    });

    // `skipped` reflects the send loop only (already-flagged recipients) so
    // `sent + skipped + failed.length` reconciles against `audienceSize`.
    // `missingEmail` surfaces separately — those confirmed attendees never
    // entered the audience in the first place.
    return NextResponse.json({
      ok: true,
      sessionDate,
      total: attendees.length,
      audienceSize: audience.length,
      missingEmail,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      warnings: result.warnings,
      adminAlert,
    });
  } catch (err) {
    console.error("Sinergia send-reminders failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function todayInArg(): string {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const d = String(arg.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
