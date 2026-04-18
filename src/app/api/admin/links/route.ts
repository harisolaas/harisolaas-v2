import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  CHANNELS,
  deriveCampaignFromDestination,
  formatAutoLabel,
  generateSlug,
  isChannelKey,
  type ChannelKey,
} from "@/lib/links";

export const dynamic = "force-dynamic";

type LinkRow = {
  slug: string;
  destination: string;
  label: string;
  channel: string;
  source: string;
  medium: string;
  campaign: string | null;
  resource_url: string | null;
  note: string | null;
  created_date: string;
  created_by: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  clicks: number;
  signups: number;
  sticky: number;
  [key: string]: unknown;
};

// GET /api/admin/links — list with aggregates
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const channelFilter = url.searchParams.get("channel");
  const campaignFilter = url.searchParams.get("campaign");
  const search = url.searchParams.get("q");

  const rows = await db.execute<LinkRow>(sql`
    WITH person_counts AS (
      SELECT person_id, COUNT(*)::int AS total
      FROM participations
      GROUP BY person_id
    ),
    link_signups AS (
      SELECT
        p.link_slug,
        COUNT(DISTINCT p.person_id)::int AS signups,
        COUNT(DISTINCT p.person_id) FILTER (WHERE pc.total >= 2)::int AS sticky
      FROM participations p
      JOIN person_counts pc ON pc.person_id = p.person_id
      WHERE p.link_slug IS NOT NULL
      GROUP BY p.link_slug
    ),
    link_click_counts AS (
      SELECT link_slug, COUNT(*)::int AS clicks
      FROM link_clicks
      WHERE is_bot = false
      GROUP BY link_slug
    )
    SELECT
      l.*,
      COALESCE(c.clicks, 0) AS clicks,
      COALESCE(s.signups, 0) AS signups,
      COALESCE(s.sticky, 0) AS sticky
    FROM links l
    LEFT JOIN link_click_counts c ON c.link_slug = l.slug
    LEFT JOIN link_signups s ON s.link_slug = l.slug
    ${statusFilter ? sql`WHERE l.status = ${statusFilter}` : sql``}
    ORDER BY l.created_at DESC
    LIMIT 500
  `);

  // Apply remaining filters client-side for simplicity (small list).
  const all = rows.rows ?? [];
  const filtered = all.filter((r) => {
    if (channelFilter && r.channel !== channelFilter) return false;
    if (campaignFilter && r.campaign !== campaignFilter) return false;
    if (search) {
      const needle = search.toLowerCase();
      if (
        !r.label.toLowerCase().includes(needle) &&
        !r.slug.toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });

  return NextResponse.json({
    total: filtered.length,
    links: filtered.map(serializeLink),
  });
}

// POST /api/admin/links — create
export async function POST(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as {
    destination?: string;
    channel?: string;
    createdDate?: string; // YYYY-MM-DD
    label?: string;
    campaign?: string | null;
    resourceUrl?: string | null;
    note?: string | null;
  };

  const destination = (body.destination ?? "").trim();
  if (!destination) {
    return NextResponse.json(
      { error: "destination required" },
      { status: 400 },
    );
  }
  if (!isChannelKey(body.channel)) {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }
  const channel: ChannelKey = body.channel;
  const createdDate = (body.createdDate ?? todayIsoDate()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) {
    return NextResponse.json(
      { error: "createdDate must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const label = (body.label ?? "").trim() || formatAutoLabel(channel, createdDate);
  const meta = CHANNELS[channel];
  const campaign = normalizeOptional(body.campaign);
  const resourceUrl = normalizeOptional(body.resourceUrl);
  const note = normalizeOptional(body.note);

  // Try to insert with a fresh slug; on collision retry once.
  const tryOnce = async () => {
    const slug = generateSlug(channel, createdDate);
    const effectiveCampaign =
      campaign ?? deriveCampaignFromDestination(destination);
    const inserted = await db
      .insert(schema.links)
      .values({
        slug,
        destination,
        label,
        channel,
        source: meta.source,
        medium: meta.medium,
        campaign: campaign ?? effectiveCampaign,
        resourceUrl: resourceUrl ?? null,
        note: note ?? null,
        createdDate,
        createdBy: session.email,
        status: "active",
        version: 1,
      })
      .onConflictDoNothing({ target: schema.links.slug })
      .returning();
    return inserted[0] ?? null;
  };

  let row = await tryOnce();
  if (!row) row = await tryOnce();
  if (!row) {
    return NextResponse.json(
      { error: "slug collision — retry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, link: row });
}

function serializeLink(r: LinkRow) {
  return {
    slug: r.slug,
    destination: r.destination,
    label: r.label,
    channel: r.channel,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    resourceUrl: r.resource_url,
    note: r.note,
    createdDate: r.created_date,
    createdBy: r.created_by,
    status: r.status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    clicks: Number(r.clicks),
    signups: Number(r.signups),
    sticky: Number(r.sticky),
  };
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
