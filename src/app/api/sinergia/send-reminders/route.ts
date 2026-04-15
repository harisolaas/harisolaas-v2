import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import {
  nextSinergiaDate,
  type SinergiaAttendeeEntry,
} from "@/lib/sinergia-types";
import { buildSinergiaReminderEmailHtml } from "@/lib/sinergia-email";

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

    const rsvpsSetKey = `sinergia:session:${sessionDate}:rsvps`;
    const raw = await redis.sMembers(rsvpsSetKey);
    const attendees: SinergiaAttendeeEntry[] = (raw ?? []).map((r: string) =>
      JSON.parse(r),
    );

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const a of attendees) {
      const flagKey = `sinergia:rsvp:${a.rsvpId}:reminder`;
      if (await redis.get(flagKey)) {
        skipped++;
        continue;
      }
      try {
        await resend.emails.send({
          from: `Sinergia <${fromEmail}>`,
          to: a.email,
          subject: "Hoy miércoles — nos vemos a las 19:30",
          html: buildSinergiaReminderEmailHtml({
            name: a.name,
            sessionDate,
            staysForDinner: a.staysForDinner,
          }),
        });
        await redis.set(flagKey, "1");
        sent++;
      } catch (err) {
        console.error(`Sinergia reminder failed for ${a.email}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      sessionDate,
      total: attendees.length,
      sent,
      skipped,
      failed,
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
