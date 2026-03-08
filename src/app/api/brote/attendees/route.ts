import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.BROTE_ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = await getRedis();
    const raw = await redis.sMembers("brote:attendees");
    const attendees = (raw ?? []).map((r: string) => JSON.parse(r));
    return NextResponse.json({ count: attendees.length, attendees });
  } catch (err) {
    console.error("Attendees fetch failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
