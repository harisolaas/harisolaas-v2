import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

function getInitials(name: string): string {
  if (!name) return "?";
  // If "name" looks like an email, just take the first letter
  if (name.includes("@")) return name.charAt(0).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    const redis = await getRedis();
    const keys: string[] = await redis.keys("plant:registration:*");
    const messages: { initials: string; message: string }[] = [];
    for (const k of keys) {
      const raw = await redis.get(k);
      if (!raw) continue;
      try {
        const r = JSON.parse(raw);
        if (r.message && typeof r.message === "string" && r.message.trim()) {
          messages.push({
            initials: getInitials(r.name || ""),
            message: r.message.trim(),
          });
        }
      } catch { /* skip */ }
    }
    return NextResponse.json({ messages: shuffle(messages) });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
