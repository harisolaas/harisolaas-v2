import { NextResponse } from "next/server";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { plantConfig } from "@/data/brote";

const BROTE_EVENT_ID = "brote-2026-03-28";
const PLANT_EVENT_ID = "plant-2026-04";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  // ── Community totals ────────────────────────────────────────
  const [totalPeopleRes] = await db
    .select({ n: count() })
    .from(schema.people);
  const totalPeople = Number(totalPeopleRes?.n ?? 0);

  const [broteAttendeeRes] = await db
    .select({ n: countDistinct(schema.participations.personId) })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  const broteAttendees = Number(broteAttendeeRes?.n ?? 0);

  // Returning = people with BOTH brote + plant participations.
  const returningRes = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT person_id
      FROM participations
      WHERE event_id IN (${BROTE_EVENT_ID}, ${PLANT_EVENT_ID})
      GROUP BY person_id
      HAVING COUNT(DISTINCT event_id) = 2
    ) t
  `);
  const returningCount = Number(returningRes.rows?.[0]?.n ?? 0);

  // New = plant registrants NOT in brote.
  const newRes = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT p1.person_id
      FROM participations p1
      WHERE p1.event_id = ${PLANT_EVENT_ID}
        AND NOT EXISTS (
          SELECT 1 FROM participations p2
          WHERE p2.person_id = p1.person_id AND p2.event_id = ${BROTE_EVENT_ID}
        )
    ) t
  `);
  const newCount = Number(newRes.rows?.[0]?.n ?? 0);

  const retentionRate =
    broteAttendees > 0
      ? Math.round((returningCount / broteAttendees) * 1000) / 10
      : 0;

  // ── Plantation metrics ──────────────────────────────────────
  const plantRows = await db
    .select({
      id: schema.participations.id,
      createdAt: schema.participations.createdAt,
      metadata: schema.participations.metadata,
      attribution: schema.participations.attribution,
      status: schema.participations.status,
    })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, PLANT_EVENT_ID));

  const plantConfirmed = plantRows.filter((r) => r.status === "confirmed");
  const waitlistCount = plantRows.filter((r) => r.status === "waitlist").length;
  const plantRegistrations = plantConfirmed.length;
  const remaining = Math.max(0, plantConfig.capacity - plantRegistrations);

  // Group breakdown.
  const groupBreakdown = { solo: 0, conAlguien: 0, grupo: 0 };
  let carpoolOffers = 0;
  let messagesCount = 0;
  const utmMap = new Map<string, number>();
  let organic = 0;
  const email1Attributed = plantConfirmed.filter((r) => {
    const a = (r.attribution as Record<string, unknown> | null) ?? null;
    return a?.campaign === "plantacion_email1";
  }).length;
  const email2Attributed = plantConfirmed.filter((r) => {
    const a = (r.attribution as Record<string, unknown> | null) ?? null;
    return a?.campaign === "plantacion_email2";
  }).length;
  for (const r of plantConfirmed) {
    const m = (r.metadata as Record<string, unknown>) ?? {};
    if (m.groupType === "solo") groupBreakdown.solo++;
    else if (m.groupType === "con-alguien") groupBreakdown.conAlguien++;
    else if (m.groupType === "grupo") groupBreakdown.grupo++;
    if (m.carpool) carpoolOffers++;
    if (m.message) messagesCount++;
    const attr = (r.attribution as Record<string, unknown> | null) ?? null;
    const campaign = attr?.campaign as string | undefined;
    if (campaign) utmMap.set(campaign, (utmMap.get(campaign) ?? 0) + 1);
    else organic++;
  }
  const utmBreakdown = Array.from(utmMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Timeline: day-by-day registration counts + cumulative.
  const sortedByDate = [...plantConfirmed].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const timelineMap = new Map<string, number>();
  for (const r of sortedByDate) {
    const day = r.createdAt.toISOString().slice(0, 10);
    timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
  }
  let cumulative = 0;
  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      cumulative += count;
      return { date, count, cumulative };
    });

  // Projected fill date.
  let projectedFillDate: string | null = null;
  if (plantConfirmed.length >= 2 && remaining > 0) {
    const firstDate = sortedByDate[0].createdAt.getTime();
    const lastDate = sortedByDate[sortedByDate.length - 1].createdAt.getTime();
    const daysSoFar = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const ratePerDay = plantConfirmed.length / daysSoFar;
    if (ratePerDay > 0) {
      const daysToFill = remaining / ratePerDay;
      const fillDate = new Date(Date.now() + daysToFill * 24 * 60 * 60 * 1000);
      projectedFillDate = fillDate.toISOString().slice(0, 10);
    }
  }

  // Avg days brote → plant.
  const avgRes = await db.execute<{ avg_days: string | null }>(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (plant.date - brote.date)) / 86400)::text AS avg_days
    FROM participations brote
    JOIN participations plant
      ON plant.person_id = brote.person_id
    WHERE brote.event_id = ${BROTE_EVENT_ID}
      AND plant.event_id = ${PLANT_EVENT_ID}
      AND plant.date > brote.date
  `);
  const avgRaw = avgRes.rows?.[0]?.avg_days;
  const avgDaysBroteToPlant =
    avgRaw != null ? Math.round(Number(avgRaw) * 10) / 10 : null;

  // ── BROTE metrics ───────────────────────────────────────────
  const broteRows = await db
    .select({
      status: schema.participations.status,
      metadata: schema.participations.metadata,
    })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));

  const ticketsSold = broteRows.length;
  const gateEntries = broteRows.filter((r) => r.status === "used").length;
  const coffeeRedemptions = broteRows.filter((r) => {
    const m = (r.metadata as Record<string, unknown>) ?? {};
    return Boolean(m.coffeeRedeemed);
  }).length;

  // ── Campaign logs (still in Redis per spec) ─────────────────
  let campaign1Sent = 0;
  let campaign2Sent = 0;
  try {
    const redis = await getRedis();
    const c1 = await redis.get("plant:campaign:1:sent");
    if (c1) campaign1Sent = JSON.parse(c1).sent ?? 0;
    const c2 = await redis.get("plant:campaign:2:sent");
    if (c2) campaign2Sent = JSON.parse(c2).sent ?? 0;
  } catch {
    /* Redis optional for this endpoint */
  }

  return NextResponse.json({
    community: {
      totalPeople,
      broteAttendees,
      returningCount,
      newCount,
      retentionRate,
    },
    plantation: {
      registrations: plantRegistrations,
      capacity: plantConfig.capacity,
      remaining,
      timeline,
      groupBreakdown,
      carpoolOffers,
      messagesCount,
      messagesRate:
        plantRegistrations > 0
          ? Math.round((messagesCount / plantRegistrations) * 1000) / 10
          : 0,
      waitlistCount,
      utmBreakdown,
      projectedFillDate,
    },
    brote: {
      ticketsSold,
      gateEntries,
      attendanceRate:
        ticketsSold > 0
          ? Math.round((gateEntries / ticketsSold) * 1000) / 10
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
        plantRegistrations > 0
          ? Math.round((messagesCount / plantRegistrations) * 1000) / 10
          : 0,
      avgDaysBroteToPlant,
      projectedFillDate,
    },
  });
}

// Silence the TS unused-import warning when developing; these stay because
// future endpoints in this file may want them.
void and;
