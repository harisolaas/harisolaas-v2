import { NextResponse } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";

// Module-level flag: skip the INSERT after the first call within a warm
// Vercel instance. Without this, every landing load triggers an
// INSERT...ON CONFLICT DO NOTHING — cheap per-call, but wasted work on
// every page view since the row exists after the first one. With the
// flag, each warm instance does at most one attempt; cold starts retry
// (still safe via ON CONFLICT). Cost drops to a handful of inserts/hour
// instead of one per visitor.
let eventEnsured = false;

// Idempotently insert the event row. Mirrors the helpers in the checkout
// and webhook routes — calling it from availability makes sure the row
// exists (and shows up in admin) the moment anyone loads the landing,
// instead of waiting for the first checkout attempt.
async function ensureEvent(): Promise<void> {
  if (eventEnsured) return;
  const { eventId, eventName, startIso, capacity } = sinergiaParrafoConfig;
  const eventDate = new Date(startIso);
  const status = eventDate < new Date() ? "past" : "upcoming";
  await db
    .insert(schema.events)
    .values({
      id: eventId,
      type: "sinergia-parrafo",
      series: "sinergia-parrafo",
      name: eventName,
      date: eventDate,
      capacity,
      status,
    })
    .onConflictDoNothing();
  eventEnsured = true;
}

// Live seat count for the landing's hero label. Mirrors the capacity
// query in `recordParticipation` (status IN ('confirmed','used')) so the
// number we show matches what the checkout webhook will actually enforce.
export async function GET() {
  try {
    await ensureEvent();
    const res = await db
      .select({ n: count() })
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.eventId, sinergiaParrafoConfig.eventId),
          inArray(schema.participations.status, ["confirmed", "used"]),
        ),
      );
    const occupied = Number(res[0]?.n ?? 0);
    const remaining = Math.max(0, sinergiaParrafoConfig.capacity - occupied);
    return NextResponse.json({
      ok: true,
      remaining,
      capacity: sinergiaParrafoConfig.capacity,
    });
  } catch (err) {
    console.error("sinergia-parrafo/availability error:", err);
    // Fall back to "no info" without surfacing an error — the landing
    // already initialises with the configured capacity.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
