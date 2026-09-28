import { NextResponse } from "next/server";
import {
  requireAdminSession,
  assertEventAccess,
} from "@/lib/admin-api-auth";
import {
  DESAFIO_EVENT_ID,
  desafioConfig,
  desafioPhase,
  desafioStartDate,
  unlockedDayCount,
} from "@/data/desafio";
import {
  buildAdminDays,
  isDayReady,
  type DesafioAdminResponse,
} from "@/lib/desafio";
import {
  ensureDesafioEvent,
  getChallengeDayRows,
  listDesafioRegistrants,
} from "@/lib/desafio-server";
import { phoneToWaMe } from "@/lib/plant-types";

export const dynamic = "force-dynamic";

// GET /api/admin/desafio
// Everything the /admin/desafio panel needs in one round-trip: the
// event's phase, all 15 days (stored or not), and the registrant list.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertEventAccess(session, DESAFIO_EVENT_ID);
  if (denied) return denied;

  try {
    const now = new Date();
    const start = desafioStartDate();
    // Idempotent side effect: opening the panel creates the event row the
    // challenge_days FK needs (and surfaces /es/desafio in the link builder).
    await ensureDesafioEvent(now);

    const [rows, registrants] = await Promise.all([
      getChallengeDayRows(DESAFIO_EVENT_ID),
      listDesafioRegistrants(DESAFIO_EVENT_ID),
    ]);

    const body: DesafioAdminResponse = {
      event: {
        id: DESAFIO_EVENT_ID,
        startDate: start,
        totalDays: desafioConfig.totalDays,
        phase: desafioPhase(now, start),
        unlockedDays: unlockedDayCount(now, start),
      },
      days: buildAdminDays(rows, now, start),
      registrants: registrants.map((r) => ({
        ...r,
        waMe: r.phone ? `https://wa.me/${phoneToWaMe(r.phone)}` : null,
      })),
      counts: {
        registered: registrants.length,
        daysReady: rows.filter(isDayReady).length,
      },
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("admin/desafio GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
