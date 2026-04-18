import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

type Grouping = "channel" | "campaign";

// GET /api/admin/links/rollups?by=channel|campaign
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  void session;

  const url = new URL(req.url);
  const by = url.searchParams.get("by") as Grouping | null;
  if (by !== "channel" && by !== "campaign") {
    return NextResponse.json(
      { error: "by must be 'channel' or 'campaign'" },
      { status: 400 },
    );
  }

  const groupCol = by === "channel" ? sql`l.channel` : sql`l.campaign`;

  const rows = await db.execute<{
    grouping: string | null;
    links: number;
    clicks: number;
    signups: number;
    sticky: number;
  }>(sql`
    WITH person_counts AS (
      SELECT person_id, COUNT(*)::int AS total
      FROM participations
      GROUP BY person_id
    ),
    clicks_per_link AS (
      SELECT link_slug, COUNT(*)::int AS clicks
      FROM link_clicks
      WHERE is_bot = false
      GROUP BY link_slug
    ),
    signups_per_link AS (
      SELECT
        p.link_slug,
        COUNT(DISTINCT p.person_id)::int AS signups,
        COUNT(DISTINCT p.person_id) FILTER (WHERE pc.total >= 2)::int AS sticky
      FROM participations p
      JOIN person_counts pc ON pc.person_id = p.person_id
      WHERE p.link_slug IS NOT NULL
      GROUP BY p.link_slug
    )
    SELECT
      ${groupCol} AS grouping,
      COUNT(*)::int AS links,
      COALESCE(SUM(c.clicks), 0)::int AS clicks,
      COALESCE(SUM(s.signups), 0)::int AS signups,
      COALESCE(SUM(s.sticky), 0)::int AS sticky
    FROM links l
    LEFT JOIN clicks_per_link c ON c.link_slug = l.slug
    LEFT JOIN signups_per_link s ON s.link_slug = l.slug
    GROUP BY ${groupCol}
    ORDER BY clicks DESC
  `);

  return NextResponse.json({
    by,
    rollups: (rows.rows ?? []).map((r) => ({
      key: r.grouping,
      links: Number(r.links),
      clicks: Number(r.clicks),
      signups: Number(r.signups),
      sticky: Number(r.sticky),
    })),
  });
}
