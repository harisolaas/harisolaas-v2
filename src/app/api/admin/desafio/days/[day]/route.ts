import { NextResponse } from "next/server";
import {
  requireAdminSession,
  assertCanWriteEvent,
} from "@/lib/admin-api-auth";
import { DESAFIO_EVENT_ID } from "@/data/desafio";
import { buildAdminDay, parseDayNumber, validateDayInput } from "@/lib/desafio";
import { ensureDesafioEvent, upsertChallengeDay } from "@/lib/desafio-server";

export const dynamic = "force-dynamic";

// PUT /api/admin/desafio/days/[day]
// Full replace of one day's content (every design field + `publicado`).
// Setting `publicado: true` is what makes the day appear on the public page.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ day: string }> },
) {
  const session = await requireAdminSession(req, { minRole: "editor" });
  if (session instanceof NextResponse) return session;
  const denied = assertCanWriteEvent(session, DESAFIO_EVENT_ID);
  if (denied) return denied;

  const { day } = await params;
  const n = parseDayNumber(day);
  if (n === null) {
    return NextResponse.json({ error: "Día inválido" }, { status: 400 });
  }

  const parsed = validateDayInput(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await ensureDesafioEvent();
    const row = await upsertChallengeDay(
      DESAFIO_EVENT_ID,
      n,
      parsed.value,
      session.email,
    );
    return NextResponse.json({ ok: true, day: buildAdminDay(n, row) });
  } catch (err) {
    console.error("admin/desafio PUT error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
