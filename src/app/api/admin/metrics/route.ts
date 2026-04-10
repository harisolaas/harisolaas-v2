import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { plantConfig } from "@/data/brote";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const redis = await getRedis();

  // ── Fetch all data in parallel ──────────────────────────────
  const plantKeys: string[] = await redis.keys("plant:registration:*");
  const communityKeys: string[] = await redis.keys("community:person:*");
  const broteTicketKeys: string[] = await redis.keys("brote:ticket:*");
  const plantCounter = Number((await redis.get("plant:counter")) ?? 0);
  const broteCounter = Number((await redis.get("brote:counter")) ?? 0);

  // Parse plant registrations
  interface PlantReg {
    id: string;
    email: string;
    name: string;
    groupType: string;
    carpool: boolean;
    message?: string;
    createdAt: string;
    utm?: { source?: string; medium?: string; campaign?: string };
  }
  const plantRegs: PlantReg[] = [];
  for (const k of plantKeys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try { plantRegs.push(JSON.parse(raw)); } catch { /* skip */ }
  }
  plantRegs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Parse community persons
  interface CommunityPerson {
    email: string;
    name: string;
    firstSeen: string;
    participations: { event: string; role: string; id: string; date: string }[];
  }
  const people: CommunityPerson[] = [];
  for (const k of communityKeys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try { people.push(JSON.parse(raw)); } catch { /* skip */ }
  }

  // Parse brote tickets
  interface BroteTicket {
    id: string;
    status: string;
    coffeeRedeemed?: boolean;
    createdAt: string;
  }
  const broteTickets: BroteTicket[] = [];
  for (const k of broteTicketKeys) {
    const raw = await redis.get(k);
    if (!raw) continue;
    try { broteTickets.push(JSON.parse(raw)); } catch { /* skip */ }
  }

  // Waitlist
  const waitlistRaw: string[] = await redis.sMembers("plant:waitlist");
  const waitlistCount = waitlistRaw.length;

  // Campaign logs
  let campaign1Sent = 0;
  let campaign2Sent = 0;
  try {
    const c1 = await redis.get("plant:campaign:1:sent");
    if (c1) campaign1Sent = JSON.parse(c1).sent ?? 0;
  } catch { /* skip */ }
  try {
    const c2 = await redis.get("plant:campaign:2:sent");
    if (c2) campaign2Sent = JSON.parse(c2).sent ?? 0;
  } catch { /* skip */ }

  // ── Community metrics ───────────────────────────────────────
  const returning = people.filter(
    (p) =>
      p.participations.some((e) => e.event === "brote") &&
      p.participations.some((e) => e.event === "plant-2026-04"),
  );
  const newOnly = people.filter(
    (p) =>
      p.participations.some((e) => e.event === "plant-2026-04") &&
      !p.participations.some((e) => e.event === "brote"),
  );
  const broteAttendeeCount = new Set(
    people
      .filter((p) => p.participations.some((e) => e.event === "brote"))
      .map((p) => p.email),
  ).size;

  // ── Plantation metrics ──────────────────────────────────────
  const remaining = Math.max(0, plantConfig.capacity - plantCounter);

  // Timeline by day
  const timelineMap = new Map<string, number>();
  for (const r of plantRegs) {
    const day = r.createdAt.slice(0, 10);
    timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
  }
  const timelineDays = Array.from(timelineMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  let cumulative = 0;
  const timeline = timelineDays.map(([date, count]) => {
    cumulative += count;
    return { date, count, cumulative };
  });

  // Group breakdown
  const groupBreakdown = { solo: 0, conAlguien: 0, grupo: 0 };
  for (const r of plantRegs) {
    if (r.groupType === "solo") groupBreakdown.solo++;
    else if (r.groupType === "con-alguien") groupBreakdown.conAlguien++;
    else if (r.groupType === "grupo") groupBreakdown.grupo++;
  }

  const carpoolOffers = plantRegs.filter((r) => r.carpool).length;
  const messagesCount = plantRegs.filter((r) => r.message).length;

  // UTM breakdown
  const utmMap = new Map<string, number>();
  let organic = 0;
  for (const r of plantRegs) {
    if (r.utm?.campaign) {
      const key = r.utm.campaign;
      utmMap.set(key, (utmMap.get(key) ?? 0) + 1);
    } else {
      organic++;
    }
  }
  const utmBreakdown = Array.from(utmMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Campaign attribution
  const email1Attributed = plantRegs.filter(
    (r) => r.utm?.campaign === "plantacion_email1",
  ).length;
  const email2Attributed = plantRegs.filter(
    (r) => r.utm?.campaign === "plantacion_email2",
  ).length;

  // Projected fill date
  let projectedFillDate: string | null = null;
  if (plantRegs.length >= 2 && remaining > 0) {
    const firstDate = new Date(plantRegs[0].createdAt).getTime();
    const lastDate = new Date(
      plantRegs[plantRegs.length - 1].createdAt,
    ).getTime();
    const daysSoFar = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const ratePerDay = plantRegs.length / daysSoFar;
    if (ratePerDay > 0) {
      const daysToFill = remaining / ratePerDay;
      const fillDate = new Date(Date.now() + daysToFill * 24 * 60 * 60 * 1000);
      projectedFillDate = fillDate.toISOString().slice(0, 10);
    }
  }

  // Avg days BROTE → Plant
  const daysArr: number[] = [];
  for (const p of returning) {
    const broteDate = p.participations.find((e) => e.event === "brote")?.date;
    const plantDate = p.participations.find((e) => e.event === "plant-2026-04")?.date;
    if (broteDate && plantDate) {
      const diff =
        (new Date(plantDate).getTime() - new Date(broteDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff > 0) daysArr.push(diff);
    }
  }
  const avgDaysBroteToPlant =
    daysArr.length > 0
      ? Math.round((daysArr.reduce((a, b) => a + b, 0) / daysArr.length) * 10) / 10
      : null;

  // ── BROTE metrics ───────────────────────────────────────────
  const gateEntries = broteTickets.filter((t) => t.status === "used").length;
  const coffeeRedemptions = broteTickets.filter(
    (t) => t.coffeeRedeemed,
  ).length;

  return NextResponse.json({
    community: {
      totalPeople: people.length,
      returningCount: returning.length,
      newCount: newOnly.length,
      retentionRate:
        broteAttendeeCount > 0
          ? Math.round((returning.length / broteAttendeeCount) * 1000) / 10
          : 0,
    },
    plantation: {
      registrations: plantCounter,
      capacity: plantConfig.capacity,
      remaining,
      timeline,
      groupBreakdown,
      carpoolOffers,
      messagesCount,
      messagesRate:
        plantCounter > 0
          ? Math.round((messagesCount / plantCounter) * 1000) / 10
          : 0,
      waitlistCount,
      utmBreakdown,
      projectedFillDate,
    },
    brote: {
      ticketsSold: broteCounter,
      gateEntries,
      attendanceRate:
        broteCounter > 0
          ? Math.round((gateEntries / broteCounter) * 1000) / 10
          : 0,
      coffeeRedemptions,
      coffeeRate:
        gateEntries > 0
          ? Math.round((coffeeRedemptions / gateEntries) * 1000) / 10
          : 0,
    },
    funnel: {
      campaigns: {
        email1: { sent: campaign1Sent, registrations: email1Attributed },
        email2: { sent: campaign2Sent, registrations: email2Attributed },
      },
      organic,
      otherSources: utmBreakdown.filter(
        (u) =>
          u.source !== "plantacion_email1" && u.source !== "plantacion_email2",
      ),
    },
    health: {
      messageEngagementRate:
        plantCounter > 0
          ? Math.round((messagesCount / plantCounter) * 1000) / 10
          : 0,
      avgDaysBroteToPlant,
      projectedFillDate,
    },
  });
}
