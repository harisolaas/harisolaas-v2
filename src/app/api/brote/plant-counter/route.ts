import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { plantConfig } from "@/data/brote";

const PLANT_EVENT_ID = "plant-2026-04";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await db
      .select({ n: count() })
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.eventId, PLANT_EVENT_ID),
          eq(schema.participations.status, "confirmed"),
        ),
      );
    const c = Number(res[0]?.n ?? 0);
    const remaining = Math.max(0, plantConfig.capacity - c);
    return NextResponse.json({
      count: c,
      capacity: plantConfig.capacity,
      remaining,
      full: remaining === 0,
    });
  } catch {
    return NextResponse.json({
      count: 0,
      capacity: plantConfig.capacity,
      remaining: plantConfig.capacity,
      full: false,
    });
  }
}
