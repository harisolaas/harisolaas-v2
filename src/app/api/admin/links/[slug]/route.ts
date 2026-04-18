import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/links/:slug — detail + stats + daily clicks + attributed people
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { slug } = await params;

  const linkRows = await db
    .select()
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1);
  if (linkRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const link = linkRows[0];

  // Click stats: total + daily breakdown (last 90 days) + first/last click
  const clickStats = await db.execute<{
    total_clicks: number;
    bot_clicks: number;
    first_click: string | null;
    last_click: string | null;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE is_bot = false)::int AS total_clicks,
      COUNT(*) FILTER (WHERE is_bot = true)::int AS bot_clicks,
      MIN(clicked_at) FILTER (WHERE is_bot = false) AS first_click,
      MAX(clicked_at) FILTER (WHERE is_bot = false) AS last_click
    FROM link_clicks
    WHERE link_slug = ${slug}
  `);

  const daily = await db.execute<{ day: string; n: number }>(sql`
    SELECT
      to_char(date_trunc('day', clicked_at AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS n
    FROM link_clicks
    WHERE link_slug = ${slug}
      AND is_bot = false
      AND clicked_at > NOW() - INTERVAL '90 days'
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  // Attributed signups: each participation + the person, plus total
  // participation count for the person (for stickiness).
  const attributed = await db.execute<{
    participation_id: string;
    person_id: number;
    person_name: string;
    person_email: string | null;
    event_id: string;
    event_name: string;
    event_type: string;
    status: string;
    created_at: string;
    total_participations: number;
  }>(sql`
    SELECT
      p.id AS participation_id,
      p.person_id,
      people.name AS person_name,
      people.email AS person_email,
      p.event_id,
      e.name AS event_name,
      e.type AS event_type,
      p.status,
      p.created_at,
      (SELECT COUNT(*)::int FROM participations p2 WHERE p2.person_id = p.person_id) AS total_participations
    FROM participations p
    JOIN people ON people.id = p.person_id
    JOIN events e ON e.id = p.event_id
    WHERE p.link_slug = ${slug}
    ORDER BY p.created_at DESC
  `);

  const stats = clickStats.rows?.[0];
  const signups = attributed.rows ?? [];
  const uniquePeople = new Set(signups.map((s) => s.person_id));
  const stickyPeople = new Set(
    signups
      .filter((s) => Number(s.total_participations) >= 2)
      .map((s) => s.person_id),
  );

  return NextResponse.json({
    link,
    stats: {
      clicks: Number(stats?.total_clicks ?? 0),
      botClicks: Number(stats?.bot_clicks ?? 0),
      signups: uniquePeople.size,
      stickyPeople: stickyPeople.size,
      firstClick: stats?.first_click ?? null,
      lastClick: stats?.last_click ?? null,
    },
    dailyClicks: (daily.rows ?? []).map((r) => ({
      day: r.day,
      clicks: Number(r.n),
    })),
    signups: signups.map((r) => ({
      participationId: r.participation_id,
      personId: Number(r.person_id),
      personName: r.person_name,
      personEmail: r.person_email,
      eventId: r.event_id,
      eventName: r.event_name,
      eventType: r.event_type,
      status: r.status,
      createdAt: r.created_at,
      totalParticipations: Number(r.total_participations),
    })),
  });
}

// PATCH /api/admin/links/:slug — update editable fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  void session;

  const { slug } = await params;
  const body = (await req.json()) as {
    label?: string;
    campaign?: string | null;
    resourceUrl?: string | null;
    note?: string | null;
    status?: "active" | "archived" | "disabled";
  };

  const update: Record<string, unknown> = { updatedAt: sql`NOW()` };
  if (body.label !== undefined) update.label = body.label.trim();
  if (body.campaign !== undefined)
    update.campaign = body.campaign ? body.campaign.trim() : null;
  if (body.resourceUrl !== undefined)
    update.resourceUrl = body.resourceUrl ? body.resourceUrl.trim() : null;
  if (body.note !== undefined)
    update.note = body.note ? body.note.trim() : null;
  if (body.status !== undefined) {
    if (!["active", "archived", "disabled"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }

  const res = await db
    .update(schema.links)
    .set(update)
    .where(eq(schema.links.slug, slug))
    .returning();

  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, link: res[0] });
}

// DELETE /api/admin/links/:slug — hard delete (blocked if any signups attributed)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  void session;

  const { slug } = await params;

  const signupCount = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM participations WHERE link_slug = ${slug}
  `);
  const n = Number(signupCount.rows?.[0]?.n ?? 0);
  if (n > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete — link has attributed signups. Archive instead.",
        signups: n,
      },
      { status: 409 },
    );
  }

  const res = await db
    .delete(schema.links)
    .where(eq(schema.links.slug, slug))
    .returning();

  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
