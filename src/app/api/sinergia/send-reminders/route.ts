import { NextResponse } from "next/server";
import { Resend } from "resend";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import {
  isValidWhatsApp,
  nextSinergiaDate,
  phoneToWaMe,
} from "@/lib/sinergia-types";
import { buildSinergiaReminderEmailHtml } from "@/lib/sinergia-email";
import { sendBulkEmails } from "@/lib/bulk-email";
import { notifyAdminOfCampaign } from "@/lib/admin-alert";
import { sendBulkWabaTemplate } from "@/lib/waba/bulk-send";
import { getLocalTemplateStatus } from "@/lib/waba/send";
import { SINERGIA_WEEKLY_REMINDER } from "@/lib/waba/templates";
import { WabaClientError } from "@/lib/waba/types";

// Runs via Vercel Cron (see vercel.json) every Wednesday at 13:00 UTC = 10:00 ART.
// Manual trigger: GET with `Authorization: Bearer $CRON_SECRET`.
//
// Sends two channels in parallel:
//   1. Email (always) — same as before, via sendBulkEmails.
//   2. WhatsApp (when the sinergia_weekly_reminder template is APPROVED
//      on Meta and the recipient has a valid phone). Each channel has
//      its own Redis idempotency flag so a retry won't double-send.
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
        personId: schema.people.id,
        email: schema.people.email,
        name: schema.people.name,
        phone: schema.people.phone,
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

    const emailResult = await sendBulkEmails({
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

    const wabaResult = await fanOutWhatsappReminders(attendees, sessionDate);

    const adminAlert = await notifyAdminOfCampaign({
      campaign: `sinergia-reminder-${sessionDate}`,
      audienceSize: audience.length,
      sent: emailResult.sent,
      skipped: emailResult.skipped,
      failed: emailResult.failed,
      warnings: emailResult.warnings,
      missingEmails: missingEmail,
      note: wabaResult.note,
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
      sent: emailResult.sent,
      skipped: emailResult.skipped,
      failed: emailResult.failed,
      warnings: emailResult.warnings,
      whatsapp: wabaResult,
      adminAlert,
    });
  } catch (err) {
    console.error("Sinergia send-reminders failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

interface AttendeeRow {
  rsvpId: string;
  personId: number;
  email: string | null;
  name: string;
  phone: string | null;
  metadata: unknown;
}

interface WabaFanOutResult {
  attempted: boolean;
  reason?: string;
  audienceSize?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  failures?: Array<{ to: string; reason: string }>;
  note?: string;
}

async function fanOutWhatsappReminders(
  attendees: AttendeeRow[],
  sessionDate: string,
): Promise<WabaFanOutResult> {
  const status = await getLocalTemplateStatus(SINERGIA_WEEKLY_REMINDER.name);
  if (status !== "approved") {
    const reason = `Template not approved (status: ${status}). Sync + wait for Meta approval, then retry.`;
    console.log(`sinergia-reminder waba: skipping — ${reason}`);
    return { attempted: false, reason };
  }

  const candidates = attendees.filter(
    (a): a is AttendeeRow & { phone: string } =>
      typeof a.phone === "string" && a.phone.length > 0 && isValidWhatsApp(a.phone),
  );

  if (candidates.length === 0) {
    return { attempted: false, reason: "No attendees have a valid phone" };
  }

  const redis = await getRedis();
  const campaign = `sinergia-reminder-${sessionDate}`;

  try {
    const result = await sendBulkWabaTemplate({
      audience: candidates,
      template: SINERGIA_WEEKLY_REMINDER,
      getTo: (a) => phoneToWaMe(a.phone),
      getPersonId: (a) => a.personId,
      buildVariables: (a) => ({
        name: a.name,
        time: "19:30",
      }),
      shouldSkip: async (a) =>
        Boolean(await redis.get(`sinergia:rsvp:${a.rsvpId}:waba-reminder`)),
      onSent: async (a) => {
        await redis.set(`sinergia:rsvp:${a.rsvpId}:waba-reminder`, "1");
      },
      campaign,
      logPrefix: "sinergia-reminder-waba",
    });

    const failureNote =
      result.failed.length > 0
        ? `WhatsApp: ${result.failed.length} fallos (ver logs).`
        : undefined;

    return {
      attempted: true,
      audienceSize: candidates.length,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed.length,
      failures: result.failed.slice(0, 10).map((f) => ({
        to: f.to,
        reason: `${f.error.name}: ${f.error.message}`,
      })),
      note: failureNote,
    };
  } catch (err) {
    if (err instanceof WabaClientError && err.statusCode === null) {
      const reason = `WABA not configured: ${err.message}`;
      console.warn(`sinergia-reminder waba: ${reason}`);
      return { attempted: false, reason };
    }
    throw err;
  }
}

function todayInArg(): string {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const d = String(arg.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
