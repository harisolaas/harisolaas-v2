import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { sinergiaConfig } from "@/data/sinergia";
import {
  nextSinergiaDate,
  type SinergiaSession,
} from "@/lib/sinergia-types";

export const dynamic = "force-dynamic";

export async function GET() {
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

    return NextResponse.json({
      ok: true,
      date: session.date,
      capacity: session.capacity,
      remaining,
      status: remaining === 0 ? "full" : session.status,
    });
  } catch (error) {
    console.error("sinergia/next-session error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
