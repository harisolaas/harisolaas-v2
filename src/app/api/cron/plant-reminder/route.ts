import { NextResponse } from "next/server";
import { runPlantReminderCampaign } from "@/lib/plant-reminder";

const PLANT_EVENT_DATE = "2026-04-19";

// Vercel cron — see vercel.json. Fires at 13:00 UTC on 2026-04-19 (10:00 ART).
// Manual trigger: GET with `Authorization: Bearer $CRON_SECRET`.
//
// Belt-and-suspenders date guard: even if Vercel misfires the schedule or
// someone hits this after event day, we only send when ART today matches
// the event date.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayInArg();
  if (today !== PLANT_EVENT_DATE) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "today !== event date",
      today,
      eventDate: PLANT_EVENT_DATE,
    });
  }

  try {
    const result = await runPlantReminderCampaign({ mode: "send" });
    return NextResponse.json(result);
  } catch (err) {
    console.error("plant-reminder cron error:", err);
    return NextResponse.json(
      { error: "Server error", message: String(err) },
      { status: 500 },
    );
  }
}

function todayInArg(): string {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const d = String(arg.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
