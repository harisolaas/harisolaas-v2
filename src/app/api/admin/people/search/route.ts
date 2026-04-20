import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/people/search?q=<query>
// Fuzzy name/email/phone/instagram search. Returns top 20.
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ people: [] });
  }

  const pattern = `%${q}%`;
  const res = await db.execute<{
    id: number;
    email: string | null;
    name: string;
    phone: string | null;
    instagram: string | null;
    first_seen: string;
    tags: string[];
  }>(sql`
    SELECT id, email, name, phone, instagram, first_seen, tags
    FROM people
    WHERE
      name ILIKE ${pattern}
      OR email::text ILIKE ${pattern}
      OR phone ILIKE ${pattern}
      OR instagram ILIKE ${pattern}
    ORDER BY
      CASE
        WHEN LOWER(name) = LOWER(${q}) THEN 0
        WHEN LOWER(email::text) = LOWER(${q}) THEN 0
        WHEN name ILIKE ${q + "%"} THEN 1
        WHEN email::text ILIKE ${q + "%"} THEN 1
        ELSE 2
      END,
      first_seen DESC
    LIMIT 20
  `);

  return NextResponse.json({ people: res.rows });
}
