import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

interface EventListRow {
  id: string;
  name: string;
  type: string;
  series: string | null;
  date: string;
  status: string;
  capacity: number | null;
  confirmed: number;
  waitlist: number;
  used: number;
  signups_last_7d: number;
  [key: string]: unknown;
}

// GET /api/admin/events — every event + signup counts. Optional filters.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type") ?? "";
  const statusFilter = url.searchParams.get("status") ?? "";

  const rows = await db.execute<EventListRow>(sql`
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
      COUNT(p.id) FILTER (WHERE p.status = 'used')::int AS used,
      COUNT(p.id) FILTER (
        WHERE p.status IN ('confirmed', 'used')
          AND p.created_at > NOW() - INTERVAL '7 days'
      )::int AS signups_last_7d
    FROM events e
    LEFT JOIN participations p ON p.event_id = e.id
    ${typeFilter ? sql`WHERE e.type = ${typeFilter}` : sql``}
    ${
      statusFilter
        ? typeFilter
          ? sql`AND e.status = ${statusFilter}`
          : sql`WHERE e.status = ${statusFilter}`
        : sql``
    }
    GROUP BY e.id
    ORDER BY e.date DESC
  `);

  const events = (rows.rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    series: r.series,
    date: r.date,
    status: r.status,
    capacity: r.capacity != null ? Number(r.capacity) : null,
    confirmed: Number(r.confirmed),
    waitlist: Number(r.waitlist),
    used: Number(r.used),
    signupsLast7d: Number(r.signups_last_7d),
  }));

  return NextResponse.json({ events });
}
