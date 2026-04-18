import { NextResponse } from "next/server";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

const BROTE_EVENT_ID = "brote-2026-03-28";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await db
      .select({ n: count() })
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.eventId, BROTE_EVENT_ID),
          inArray(schema.participations.status, ["confirmed", "used"]),
        ),
      );
    return NextResponse.json({ count: Number(res[0]?.n ?? 0) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
