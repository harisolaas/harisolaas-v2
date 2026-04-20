import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

interface PersonaRow {
  id: number;
  email: string | null;
  name: string;
  firstSeen: string;
  firstTouch: Record<string, unknown> | null;
  tags: string[];
  participations: {
    eventId: string;
    eventName: string;
    eventType: string;
    eventSeries: string | null;
    status: string;
    role: string;
    createdAt: string;
  }[];
  eventSummary: {
    brote: boolean;
    plant: boolean;
    sinergiaCount: number;
  };
}

// GET /api/admin/people?search=&event=&source=&from=&to=&tag=
// Returns the full community list with per-person participation summary.
// Filtering is intentionally simple (single-select where multi was spec'd);
// all filters operate in the SQL layer except `tag` (array overlap).
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim();
  const eventFilter = url.searchParams.get("event") ?? "";
  const sourceFilter = url.searchParams.get("source") ?? "";
  const fromDate = url.searchParams.get("from") ?? "";
  const toDate = url.searchParams.get("to") ?? "";
  const tagFilter = url.searchParams.get("tag") ?? "";

  const searchPattern = search.length > 0 ? `%${search}%` : null;

  // We fetch people matching the filter predicates, then join in their
  // participations in a second query. Keeps the SQL readable and avoids
  // complex jsonb aggregation.
  const peopleRes = await db.execute<{
    id: number;
    email: string | null;
    name: string;
    first_seen: string;
    first_touch: Record<string, unknown> | null;
    tags: string[];
  }>(sql`
    SELECT DISTINCT p.id, p.email, p.name, p.first_seen, p.first_touch, p.tags
    FROM people p
    ${
      eventFilter
        ? sql`JOIN participations pe ON pe.person_id = p.id AND pe.event_id = ${eventFilter}`
        : sql``
    }
    WHERE 1 = 1
      ${
        searchPattern
          ? sql`AND (p.name ILIKE ${searchPattern} OR p.email::text ILIKE ${searchPattern})`
          : sql``
      }
      ${
        sourceFilter
          ? sql`AND p.first_touch->>'source' = ${sourceFilter}`
          : sql``
      }
      ${fromDate ? sql`AND p.first_seen >= ${fromDate}::timestamptz` : sql``}
      ${toDate ? sql`AND p.first_seen <= ${toDate}::timestamptz` : sql``}
      ${tagFilter ? sql`AND ${tagFilter} = ANY(p.tags)` : sql``}
    ORDER BY p.first_seen DESC
    LIMIT 1000
  `);

  const peopleRows = peopleRes.rows ?? [];
  const ids = peopleRows.map((r) => Number(r.id));

  if (ids.length === 0) {
    return NextResponse.json({ people: [], total: 0 });
  }

  const partsRes = await db.execute<{
    person_id: number;
    event_id: string;
    event_name: string;
    event_type: string;
    event_series: string | null;
    status: string;
    role: string;
    created_at: string;
  }>(sql`
    SELECT
      p.person_id,
      p.event_id,
      e.name AS event_name,
      e.type AS event_type,
      e.series AS event_series,
      p.status,
      p.role,
      p.created_at
    FROM participations p
    JOIN events e ON e.id = p.event_id
    WHERE p.person_id = ANY(${sql`ARRAY[${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}]::bigint[]`})
    ORDER BY p.created_at DESC
  `);

  const partsByPerson = new Map<number, typeof partsRes.rows>();
  for (const row of partsRes.rows ?? []) {
    const list = partsByPerson.get(Number(row.person_id)) ?? [];
    list.push(row);
    partsByPerson.set(Number(row.person_id), list);
  }

  const people: PersonaRow[] = peopleRows.map((p) => {
    const parts = partsByPerson.get(Number(p.id)) ?? [];
    const hasBrote = parts.some((r) => r.event_type === "brote");
    const hasPlant = parts.some((r) => r.event_type === "plant");
    const sinergiaCount = parts.filter(
      (r) => r.event_type === "sinergia" || r.event_series === "sinergia",
    ).length;

    return {
      id: Number(p.id),
      email: p.email,
      name: p.name,
      firstSeen: p.first_seen,
      firstTouch: p.first_touch,
      tags: p.tags ?? [],
      participations: parts.map((r) => ({
        eventId: r.event_id,
        eventName: r.event_name,
        eventType: r.event_type,
        eventSeries: r.event_series,
        status: r.status,
        role: r.role,
        createdAt: r.created_at,
      })),
      eventSummary: {
        brote: hasBrote,
        plant: hasPlant,
        sinergiaCount,
      },
    };
  });

  return NextResponse.json({ people, total: people.length });
}
