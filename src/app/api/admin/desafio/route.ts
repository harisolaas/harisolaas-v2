import { NextResponse } from "next/server";
import {
  requireAdminSession,
  assertEventAccess,
} from "@/lib/admin-api-auth";
import { DESAFIO_EVENT_ID, DESAFIO_TOTAL_DAYS } from "@/data/desafio";
import {
  buildAdminDays,
  isDayPublic,
  type DesafioAdminResponse,
} from "@/lib/desafio";
import { ensureDesafioEvent, getChallengeDayRows } from "@/lib/desafio-server";

export const dynamic = "force-dynamic";

// GET /api/admin/desafio
// Everything the /admin/desafio panel needs in one round-trip: all 15 days
// (stored or not) with every design field, plus how many are visible.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertEventAccess(session, DESAFIO_EVENT_ID);
  if (denied) return denied;

  try {
    // Idempotent side effect: opening the panel creates the event row the
    // challenge_days FK needs (and surfaces /es/desafio in the link builder).
    await ensureDesafioEvent();
    const rows = await getChallengeDayRows(DESAFIO_EVENT_ID);

    const body: DesafioAdminResponse = {
      event: { id: DESAFIO_EVENT_ID, totalDays: DESAFIO_TOTAL_DAYS },
      days: buildAdminDays(rows),
      counts: { published: rows.filter(isDayPublic).length },
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("admin/desafio GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
