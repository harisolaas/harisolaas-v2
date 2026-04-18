import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/events/:id — full detail for one event.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const eventRows = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .limit(1);
  if (eventRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const event = eventRows[0];

  // Aggregate counts
  const countsRes = await db.execute<{
    confirmed: number;
    waitlist: number;
    used: number;
    cancelled: number;
    total: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('confirmed', 'used'))::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'waitlist')::int AS waitlist,
      COUNT(*) FILTER (WHERE status = 'used')::int AS used,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*)::int AS total
    FROM participations
    WHERE event_id = ${id}
  `);
  const counts = countsRes.rows?.[0] ?? {
    confirmed: 0,
    waitlist: 0,
    used: 0,
    cancelled: 0,
    total: 0,
  };

  // Signup timeline (day-by-day counts + cumulative).
  const timelineRes = await db.execute<{ day: string; n: number }>(sql`
    SELECT
      to_char(
        date_trunc('day', created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'),
        'YYYY-MM-DD'
      ) AS day,
      COUNT(*)::int AS n
    FROM participations
    WHERE event_id = ${id}
      AND status IN ('confirmed', 'used')
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  let cumulative = 0;
  const timeline = (timelineRes.rows ?? []).map((r) => {
    cumulative += Number(r.n);
    return { day: r.day, count: Number(r.n), cumulative };
  });

  // Source breakdown (from attribution.source).
  const sourceRes = await db.execute<{ source: string | null; n: number }>(sql`
    SELECT
      COALESCE(attribution->>'source', '(directo)') AS source,
      COUNT(*)::int AS n
    FROM participations
    WHERE event_id = ${id}
      AND status IN ('confirmed', 'used')
    GROUP BY 1
    ORDER BY n DESC
  `);
  const sourceBreakdown = (sourceRes.rows ?? []).map((r) => ({
    source: r.source ?? "(directo)",
    count: Number(r.n),
  }));

  // Link breakdown (top attributed links).
  const linkRes = await db.execute<{
    slug: string;
    label: string;
    channel: string;
    n: number;
  }>(sql`
    SELECT
      l.slug,
      l.label,
      l.channel,
      COUNT(*)::int AS n
    FROM participations p
    JOIN links l ON l.slug = p.link_slug
    WHERE p.event_id = ${id}
      AND p.status IN ('confirmed', 'used')
    GROUP BY l.slug, l.label, l.channel
    ORDER BY n DESC
    LIMIT 20
  `);
  const linkBreakdown = (linkRes.rows ?? []).map((r) => ({
    slug: r.slug,
    label: r.label,
    channel: r.channel,
    count: Number(r.n),
  }));

  // Participants (people in this event).
  const participantsRes = await db.execute<{
    participation_id: string;
    person_id: number;
    person_name: string;
    person_email: string | null;
    role: string;
    status: string;
    created_at: string;
    attribution: Record<string, unknown> | null;
    link_slug: string | null;
  }>(sql`
    SELECT
      p.id AS participation_id,
      p.person_id,
      people.name AS person_name,
      people.email AS person_email,
      p.role,
      p.status,
      p.created_at,
      p.attribution,
      p.link_slug
    FROM participations p
    JOIN people ON people.id = p.person_id
    WHERE p.event_id = ${id}
    ORDER BY p.created_at DESC
  `);
  const participants = (participantsRes.rows ?? []).map((r) => ({
    participationId: r.participation_id,
    personId: Number(r.person_id),
    personName: r.person_name,
    personEmail: r.person_email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    attribution: r.attribution,
    linkSlug: r.link_slug,
  }));

  return NextResponse.json({
    event: {
      ...event,
      date: event.date.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    },
    counts: {
      confirmed: Number(counts.confirmed),
      waitlist: Number(counts.waitlist),
      used: Number(counts.used),
      cancelled: Number(counts.cancelled),
      total: Number(counts.total),
    },
    timeline,
    sourceBreakdown,
    linkBreakdown,
    participants,
  });
}
