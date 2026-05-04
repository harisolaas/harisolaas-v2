import { NextResponse } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";

// Live seat count for the landing's hero label. Mirrors the capacity
// query in `recordParticipation` (status IN ('confirmed','used')) so the
// number we show matches what the checkout webhook will actually enforce.
export async function GET() {
  try {
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
