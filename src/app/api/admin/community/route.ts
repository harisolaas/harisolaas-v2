import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const redis = await getRedis();
  const keys: string[] = await redis.keys("community:person:*");
  const people = [];
  for (const k of keys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try {
      const person = JSON.parse(raw);
      const hasBrote = person.participations?.some(
        (p: { event: string }) => p.event === "brote",
      );
      const hasPlant = person.participations?.some(
        (p: { event: string }) => p.event === "plant-2026-04",
      );
      people.push({
        ...person,
        hasBrote: Boolean(hasBrote),
        hasPlant: Boolean(hasPlant),
        journey: hasBrote && hasPlant ? "both" : hasBrote ? "brote" : "plant",
      });
    } catch { /* skip */ }
  }
  people.sort(
    (a, b) => String(b.firstSeen ?? "").localeCompare(String(a.firstSeen ?? "")),
  );
  return NextResponse.json({ people });
}
