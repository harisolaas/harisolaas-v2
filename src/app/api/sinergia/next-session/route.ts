import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sinergiaConfig } from "@/data/sinergia";
import { resolveOverrideLink } from "@/lib/override-link";
import { nextSinergiaDate } from "@/lib/sinergia-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const date = nextSinergiaDate();
    const eventId = `sinergia-${date}`;

    // Count confirmed RSVPs from the DB — same source the rsvp endpoint
    // uses to compute `remaining` for its own response. Earlier this read
    // a Redis counter (`sinergia:session:{date}:counter`) that nothing
    // ever incremented, so the landing always showed the full capacity.
    const res = await db
      .select({ n: count() })
      .from(schema.participations)
      .where(
        and(
          eq(schema.participations.eventId, eventId),
          eq(schema.participations.status, "confirmed"),
        ),
      );
    const confirmedCount = Number(res[0]?.n ?? 0);
    const capacity = sinergiaConfig.capacity;
    const remaining = Math.max(0, capacity - confirmedCount);

    // When the landing arrives with `?link=<slug>` for an override invite,
    // signal that the form should stay open even if remaining===0. The
    // client uses this to swap the "lleno" card for an invite-specific copy.
    const slug = new URL(req.url).searchParams.get("link");
    const override = await resolveOverrideLink(slug);

    return NextResponse.json({
      ok: true,
      date,
      capacity,
      remaining,
      status: remaining === 0 && !override.bypassCapacity ? "full" : "open",
      override: override.bypassCapacity,
    });
  } catch (error) {
    console.error("sinergia/next-session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
