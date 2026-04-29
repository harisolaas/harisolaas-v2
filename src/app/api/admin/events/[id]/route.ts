import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertEventAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/events/:id — full detail for one event.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const denied = assertEventAccess(session, id);
  if (denied) return denied;

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

  // Participants (people in this event). Includes the raw metadata
  // jsonb so the drawer can render event-type-specific fields
  // (Sinergia "staysForDinner", future ones) and offer a per-row
  // pretty-JSON dump for inspection.
  const participantsRes = await db.execute<{
    participation_id: string;
    person_id: number;
    person_name: string;
    person_email: string | null;
    role: string;
    status: string;
    created_at: string;
    used_at: string | null;
    attribution: Record<string, unknown> | null;
    link_slug: string | null;
    price_cents: number | null;
    currency: string | null;
    metadata: Record<string, unknown> | null;
  }>(sql`
    SELECT
      p.id AS participation_id,
      p.person_id,
      people.name AS person_name,
      people.email AS person_email,
      p.role,
      p.status,
      p.created_at,
      p.used_at,
      p.attribution,
      p.link_slug,
      p.price_cents,
      p.currency,
      p.metadata
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
    usedAt: r.used_at,
    attribution: r.attribution,
    linkSlug: r.link_slug,
    priceCents: r.price_cents == null ? null : Number(r.price_cents),
    currency: r.currency,
    metadata: r.metadata ?? {},
  }));

  // Contribution aggregates — one row per currency. Mirrors the
  // confirmed/used filter used elsewhere in this endpoint so the
  // "% confirmados aportaron" math in the UI can't exceed 100% and
  // pending/waitlist rows with stray prices don't leak in. NULL currency
  // is normalized to ARS in SQL so the grouping key matches what the
  // client renders (which also defaults to ARS).
  const contributionsRes = await db.execute<{
    currency: string;
    contributors: number;
    total_cents: string | number;
    max_cents: string | number;
  }>(sql`
    SELECT
      COALESCE(currency, 'ARS') AS currency,
      COUNT(*)::int AS contributors,
      COALESCE(SUM(price_cents), 0)::bigint AS total_cents,
      COALESCE(MAX(price_cents), 0)::bigint AS max_cents
    FROM participations
    WHERE event_id = ${id}
      AND status IN ('confirmed', 'used')
      AND price_cents IS NOT NULL
      AND price_cents > 0
    GROUP BY 1
    ORDER BY total_cents DESC
  `);
  const contributions = (contributionsRes.rows ?? []).map((r) => {
    const contributors = Number(r.contributors);
    const totalCents = Number(r.total_cents);
    return {
      currency: r.currency,
      contributors,
      totalCents,
      avgCents: contributors > 0 ? Math.round(totalCents / contributors) : 0,
      maxCents: Number(r.max_cents),
    };
  });

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
    contributions,
  });
}
