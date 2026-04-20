import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

interface PanoramaResponse {
  community: {
    total: number;
    newThisWeek: number;
    newPreviousWeek: number;
    returningThisWeek: number;
    returningPreviousWeek: number;
    reactivationRate: number; // % of people with 1+ participations who have 2+
    peopleWithAny: number;
    peopleWithTwoPlus: number;
  };
  activeEvents: ActiveEventCard[];
}

interface ActiveEventCard {
  id: string;
  name: string;
  type: string;
  series: string | null;
  date: string;
  status: string;
  capacity: number | null;
  confirmed: number;
  waitlist: number;
  velocity7d: number; // signups/day, last 7 days
  projectedFillDate: string | null;
}

// GET /api/admin/panorama — durable community metrics + active events strip.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  // ── Durable community metrics ─────────────────────────────────────────
  const communityRes = await db.execute<{
    total: number;
    new_7d: number;
    new_prev_7d: number;
    returning_7d: number;
    returning_prev_7d: number;
    people_with_any: number;
    people_with_two_plus: number;
  }>(sql`
    WITH person_stats AS (
      SELECT
        p.id,
        p.first_seen,
        COUNT(part.id)::int AS participation_count,
        MAX(part.created_at) AS last_participation_at,
        MIN(part.created_at) AS first_participation_at
      FROM people p
      LEFT JOIN participations part ON part.person_id = p.id
      GROUP BY p.id, p.first_seen
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE first_seen > NOW() - INTERVAL '7 days')::int AS new_7d,
      COUNT(*) FILTER (
        WHERE first_seen > NOW() - INTERVAL '14 days'
          AND first_seen <= NOW() - INTERVAL '7 days'
      )::int AS new_prev_7d,
      COUNT(*) FILTER (
        WHERE last_participation_at > NOW() - INTERVAL '7 days'
          AND participation_count >= 2
      )::int AS returning_7d,
      COUNT(*) FILTER (
        WHERE last_participation_at > NOW() - INTERVAL '14 days'
          AND last_participation_at <= NOW() - INTERVAL '7 days'
          AND participation_count >= 2
      )::int AS returning_prev_7d,
      COUNT(*) FILTER (WHERE participation_count >= 1)::int AS people_with_any,
      COUNT(*) FILTER (WHERE participation_count >= 2)::int AS people_with_two_plus
    FROM person_stats
  `);

  const c = communityRes.rows?.[0];
  const peopleWithAny = Number(c?.people_with_any ?? 0);
  const peopleWithTwoPlus = Number(c?.people_with_two_plus ?? 0);
  const reactivationRate =
    peopleWithAny > 0
      ? Math.round((peopleWithTwoPlus / peopleWithAny) * 1000) / 10
      : 0;

  // ── Active events ─────────────────────────────────────────────────────
  const activeRes = await db.execute<{
    id: string;
    name: string;
    type: string;
    series: string | null;
    date: string;
    status: string;
    capacity: number | null;
    confirmed: number;
    waitlist: number;
    signups_last_7d: number;
  }>(sql`
    SELECT
      e.id,
      e.name,
      e.type,
      e.series,
      e.date,
      e.status,
      e.capacity,
      COUNT(p.id) FILTER (WHERE p.status IN ('confirmed', 'used'))::int AS confirmed,
      COUNT(p.id) FILTER (WHERE p.status = 'waitlist')::int AS waitlist,
      COUNT(p.id) FILTER (
        WHERE p.status IN ('confirmed', 'used')
          AND p.created_at > NOW() - INTERVAL '7 days'
      )::int AS signups_last_7d
    FROM events e
    LEFT JOIN participations p ON p.event_id = e.id
    WHERE e.status IN ('upcoming', 'live')
    GROUP BY e.id, e.name, e.type, e.series, e.date, e.status, e.capacity
    ORDER BY e.date ASC
  `);

  const activeEvents: ActiveEventCard[] = (activeRes.rows ?? []).map((r) => {
    const confirmed = Number(r.confirmed);
    const velocity7d = Number(r.signups_last_7d) / 7;
    const capacity = r.capacity != null ? Number(r.capacity) : null;
    const remaining = capacity != null ? Math.max(0, capacity - confirmed) : null;
    let projectedFillDate: string | null = null;
    if (remaining != null && remaining > 0 && velocity7d > 0) {
      const daysToFill = remaining / velocity7d;
      const fillAt = new Date(Date.now() + daysToFill * 86400_000);
      projectedFillDate = fillAt.toISOString().slice(0, 10);
    }

    return {
      id: r.id,
      name: r.name,
      type: r.type,
      series: r.series,
      date: r.date,
      status: r.status,
      capacity,
      confirmed,
      waitlist: Number(r.waitlist),
      velocity7d: Math.round(velocity7d * 10) / 10,
      projectedFillDate,
    };
  });

  const payload: PanoramaResponse = {
    community: {
      total: Number(c?.total ?? 0),
      newThisWeek: Number(c?.new_7d ?? 0),
      newPreviousWeek: Number(c?.new_prev_7d ?? 0),
      returningThisWeek: Number(c?.returning_7d ?? 0),
      returningPreviousWeek: Number(c?.returning_prev_7d ?? 0),
      reactivationRate,
      peopleWithAny,
      peopleWithTwoPlus,
    },
    activeEvents,
  };

  return NextResponse.json(payload);
}
