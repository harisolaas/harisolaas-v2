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
//     Reassigns every RSVP under fromDate to sinergiaConfig.firstSessionDate,
//     fixes the attendee set, counters, community participation, and emails
//     each attendee an erratum.
//
//   { action: "send-erratum", emails: string[], oldDate: "YYYY-MM-DD" }
//     Sends the erratum to a specific list of addresses — useful for re-sending
//     to people the bulk migrate missed (e.g. Resend rate-limit drops). Pulls
//     the name from `community:person:{email}` when available.
//
// Resend's SDK resolves (not rejects) on HTTP errors and returns `{ data, error }`,
// so we must inspect `error` explicitly. We also pace sends at ≤2/s to stay
// under the default rate limit.
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
      return NextResponse.json(
        { error: "emails[] required" },
        { status: 400 },
      );
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

  try {
    const redis = await getRedis();
    const fromSessionKey = `sinergia:session:${fromDate}`;
    const toSessionKey = `sinergia:session:${toDate}`;
    const fromSetKey = `${fromSessionKey}:rsvps`;
    const toSetKey = `${toSessionKey}:rsvps`;
    const fromCounterKey = `${fromSessionKey}:counter`;
    const toCounterKey = `${toSessionKey}:counter`;

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
    const entries: SinergiaAttendeeEntry[] = (rawEntries ?? []).map(
      (r: string) => JSON.parse(r),
    );

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    let migrated = 0;
    let emailsSent = 0;
    const emailsFailed: { email: string; reason: string }[] = [];

    for (const entry of entries) {
      const rsvpKey = `sinergia:rsvp:${entry.rsvpId}`;
      const rsvpRaw = await redis.get(rsvpKey);
      if (!rsvpRaw) continue;
      const rsvp: SinergiaRsvp = JSON.parse(rsvpRaw);

      rsvp.sessionDate = toDate;
      await redis.set(rsvpKey, JSON.stringify(rsvp));

      const newEntry: SinergiaAttendeeEntry = { ...entry };
      await redis.sAdd(toSetKey, JSON.stringify(newEntry));
      await redis.sRem(fromSetKey, JSON.stringify(entry));

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

      const erratumFlagKey = `sinergia:rsvp:${entry.rsvpId}:erratum-sent`;
      if (!(await redis.get(erratumFlagKey))) {
        const result = await sendErratum(resend, fromEmail, {
          email: entry.email,
          name: entry.name,
          oldDate: fromDate,
          newDate: toDate,
        });
        if (result.ok) {
          await redis.set(erratumFlagKey, "1");
          emailsSent++;
        } else {
          emailsFailed.push({ email: entry.email, reason: result.reason });
        }
        await sleep(600);
      }
    }

    if (migrated > 0) await redis.incrBy(toCounterKey, migrated);
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

async function handleSendErratum(emails: string[], oldDate: string) {
  const toDate = sinergiaConfig.firstSessionDate;
  try {
    const redis = await getRedis();
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";

    let sent = 0;
    const failed: { email: string; reason: string }[] = [];

    for (const rawEmail of emails) {
      const email = rawEmail.trim().toLowerCase();
      const personRaw = await redis.get(`community:person:${email}`);
      const name = personRaw
        ? (JSON.parse(personRaw).name as string) || "hola"
        : "hola";

      const result = await sendErratum(resend, fromEmail, {
        email,
        name,
        oldDate,
        newDate: toDate,
      });
      if (result.ok) {
        sent++;
        // Flag any RSVPs under this email for the target session as erratum-sent.
        const rsvpsSet = await redis.sMembers(
          `sinergia:session:${toDate}:rsvps`,
        );
        for (const raw of rsvpsSet) {
          try {
            const a: SinergiaAttendeeEntry = JSON.parse(raw);
            if (a.email === email) {
              await redis.set(`sinergia:rsvp:${a.rsvpId}:erratum-sent`, "1");
            }
          } catch { /* skip */ }
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
