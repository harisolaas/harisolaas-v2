import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { plantConfig } from "@/data/brote";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = await getRedis();
    const count = Number((await redis.get("plant:counter")) ?? 0);
    const remaining = Math.max(0, plantConfig.capacity - count);
    return NextResponse.json({
      count,
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
