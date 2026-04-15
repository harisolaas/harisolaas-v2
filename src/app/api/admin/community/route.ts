import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

interface Participation {
  event: string;
  role: string;
  id: string;
  date: string;
}

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
      const parts: Participation[] = person.participations ?? [];
      const hasBrote = parts.some((p) => p.event === "brote");
      const hasPlant = parts.some((p) => p.event === "plant-2026-04");
      const sinergiaParts = parts.filter((p) => p.event.startsWith("sinergia-"));
      const hasSinergia = sinergiaParts.length > 0;
      const sinergiaCount = sinergiaParts.length;
      const lastSinergia = sinergiaParts
        .map((p) => p.event.replace("sinergia-", ""))
        .sort()
        .at(-1) ?? null;

      people.push({
        ...person,
        hasBrote,
        hasPlant,
        hasSinergia,
        sinergiaCount,
        lastSinergia,
        // Kept for back-compat. Overview badge derived from the flags above.
        journey: hasBrote && hasPlant ? "both" : hasBrote ? "brote" : hasPlant ? "plant" : "sinergia",
      });
    } catch { /* skip */ }
  }
  people.sort(
    (a, b) => String(b.firstSeen ?? "").localeCompare(String(a.firstSeen ?? "")),
  );
  return NextResponse.json({ people });
}
