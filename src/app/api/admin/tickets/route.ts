import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const redis = await getRedis();
  const keys: string[] = await redis.keys("brote:ticket:*");
  const tickets = [];
  for (const k of keys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try { tickets.push(JSON.parse(raw)); } catch { /* skip */ }
  }
  tickets.sort(
    (a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
  return NextResponse.json({ tickets });
}
