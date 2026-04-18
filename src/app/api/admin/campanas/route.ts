import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/campanas — rollup cards for the Campañas tab.
// The full link list/detail lives under /api/admin/links/*.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const res = await db.execute<{
    total_links: number;
    active_links: number;
    total_clicks: number;
    bot_clicks: number;
    total_signups: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM links) AS total_links,
      (SELECT COUNT(*)::int FROM links WHERE status = 'active') AS active_links,
      (SELECT COUNT(*)::int FROM link_clicks WHERE is_bot = false) AS total_clicks,
      (SELECT COUNT(*)::int FROM link_clicks WHERE is_bot = true) AS bot_clicks,
      (SELECT COUNT(*)::int FROM participations WHERE link_slug IS NOT NULL) AS total_signups
  `);

  const r = res.rows?.[0];
  const totalClicks = Number(r?.total_clicks ?? 0);
  const totalSignups = Number(r?.total_signups ?? 0);
  const cvr =
    totalClicks > 0 ? Math.round((totalSignups / totalClicks) * 1000) / 10 : 0;

  return NextResponse.json({
    totalLinks: Number(r?.total_links ?? 0),
    activeLinks: Number(r?.active_links ?? 0),
    totalClicks,
    botClicks: Number(r?.bot_clicks ?? 0),
    totalSignups,
    cvr,
  });
}
