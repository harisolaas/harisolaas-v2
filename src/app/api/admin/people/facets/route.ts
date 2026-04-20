import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/people/facets — cheap rollup of the distinct values that
// the Personas tab's filter dropdowns need, without paying the cost of the
// full participations-joined payload.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  const [events, sources, tags] = await Promise.all([
    db.execute<{ id: string; name: string }>(sql`
      SELECT e.id, e.name
      FROM events e
      WHERE EXISTS (SELECT 1 FROM participations p WHERE p.event_id = e.id)
      ORDER BY e.name ASC
    `),
    db.execute<{ source: string }>(sql`
      SELECT DISTINCT first_touch->>'source' AS source
      FROM people
      WHERE first_touch->>'source' IS NOT NULL
        AND first_touch->>'source' <> ''
      ORDER BY 1 ASC
    `),
    db.execute<{ tag: string }>(sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM people
      WHERE cardinality(tags) > 0
      ORDER BY 1 ASC
    `),
  ]);

  return NextResponse.json({
    events: (events.rows ?? []).map((r) => ({ id: r.id, name: r.name })),
    sources: (sources.rows ?? []).map((r) => r.source),
    tags: (tags.rows ?? []).map((r) => r.tag),
  });
}
