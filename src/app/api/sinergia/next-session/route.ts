import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { sinergiaConfig } from "@/data/sinergia";
import { resolveOverrideLink } from "@/lib/override-link";
import {
  nextSinergiaDate,
  type SinergiaSession,
} from "@/lib/sinergia-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const redis = await getRedis();
    const date = nextSinergiaDate();

    const sessionRaw = await redis.get(`sinergia:session:${date}`);
    let session: SinergiaSession;
    if (sessionRaw) {
      session = JSON.parse(sessionRaw);
    } else {
      session = {
        date,
        capacity: sinergiaConfig.capacity,
        status: "open",
      };
      await redis.set(`sinergia:session:${date}`, JSON.stringify(session));
    }

    const count = Number(
      (await redis.get(`sinergia:session:${date}:counter`)) ?? 0,
    );
    const remaining = Math.max(0, session.capacity - count);

    // When the landing arrives with `?link=<slug>` for an override invite,
    // signal that the form should stay open even if remaining===0. The
    // client uses this to swap the "lleno" card for an invite-specific copy.
    const slug = new URL(req.url).searchParams.get("link");
    const override = await resolveOverrideLink(slug);

    return NextResponse.json({
      ok: true,
      date: session.date,
      capacity: session.capacity,
      remaining,
      status:
        remaining === 0 && !override.bypassCapacity ? "full" : session.status,
      override: override.bypassCapacity,
    });
  } catch (error) {
    console.error("sinergia/next-session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
