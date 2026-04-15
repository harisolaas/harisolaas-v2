import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { sinergiaConfig } from "@/data/sinergia";
import {
  communityEventForSession,
  formatSessionDateEs,
  type SinergiaAttendeeEntry,
  type SinergiaRsvp,
  type SinergiaSession,
} from "@/lib/sinergia-types";
import { buildSinergiaErratumEmailHtml } from "@/lib/sinergia-email";
import type { CommunityPerson } from "@/lib/plant-types";

// POST /api/sinergia/admin
// Bearer $BROTE_ADMIN_SECRET
//
// Actions:
//   { action: "migrate-to-first-session", fromDate?: "YYYY-MM-DD" }
//     Reassigns every RSVP stored under fromDate to sinergiaConfig.firstSessionDate.
//     Updates the RSVP, the session attendee set, the counters, the
//     community:person participation, and emails an erratum to each attendee.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.BROTE_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; fromDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "migrate-to-first-session") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const fromDate = body.fromDate ?? "2026-04-15";
  const toDate = sinergiaConfig.firstSessionDate;

  if (!toDate || fromDate >= toDate) {
    return NextResponse.json(
      { error: "fromDate must be before firstSessionDate" },
      { status: 400 },
    );
  }

  try {
    const redis = await getRedis();
    const fromSessionKey = `sinergia:session:${fromDate}`;
    const toSessionKey = `sinergia:session:${toDate}`;
    const fromSetKey = `${fromSessionKey}:rsvps`;
    const toSetKey = `${toSessionKey}:rsvps`;
    const fromCounterKey = `${fromSessionKey}:counter`;
    const toCounterKey = `${toSessionKey}:counter`;

    // Ensure destination session exists
    const toSessionRaw = await redis.get(toSessionKey);
    if (!toSessionRaw) {
      const toSession: SinergiaSession = {
        date: toDate,
        capacity: sinergiaConfig.capacity,
        status: "open",
      };
      await redis.set(toSessionKey, JSON.stringify(toSession));
    }

    const rawEntries = await redis.sMembers(fromSetKey);
    const entries: SinergiaAttendeeEntry[] = (rawEntries ?? []).map((r: string) =>
      JSON.parse(r),
    );

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    let migrated = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const entry of entries) {
      const rsvpKey = `sinergia:rsvp:${entry.rsvpId}`;
      const rsvpRaw = await redis.get(rsvpKey);
      if (!rsvpRaw) continue;
      const rsvp: SinergiaRsvp = JSON.parse(rsvpRaw);

      // Update RSVP record
      rsvp.sessionDate = toDate;
      await redis.set(rsvpKey, JSON.stringify(rsvp));

      // Move attendee set membership
      const newEntry: SinergiaAttendeeEntry = { ...entry };
      await redis.sAdd(toSetKey, JSON.stringify(newEntry));
      await redis.sRem(fromSetKey, JSON.stringify(entry));

      // Update community:person participation
      const personKey = `community:person:${entry.email}`;
      const personRaw = await redis.get(personKey);
      if (personRaw) {
        const person: CommunityPerson = JSON.parse(personRaw);
        const oldEvent = communityEventForSession(fromDate);
        const newEvent = communityEventForSession(toDate);
        person.participations = person.participations.map((p) =>
          p.event === oldEvent && p.id === entry.rsvpId
            ? { ...p, event: newEvent }
            : p,
        );
        await redis.set(personKey, JSON.stringify(person));
      }

      migrated++;

      // Erratum email
      try {
        await resend.emails.send({
          from: `Sinergia <${fromEmail}>`,
          to: entry.email,
          subject: `Fe de erratas — Sinergia arranca el ${formatSessionDateEs(toDate)}`,
          html: buildSinergiaErratumEmailHtml({
            name: entry.name,
            oldDate: fromDate,
            newDate: toDate,
          }),
        });
        emailsSent++;
      } catch (err) {
        console.error(`Erratum email failed for ${entry.email}:`, err);
        emailsFailed++;
      }
    }

    if (migrated > 0) {
      await redis.incrBy(toCounterKey, migrated);
    }
    await redis.del(fromCounterKey);
    await redis.del(fromSessionKey);
    await redis.del(fromSetKey);

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
