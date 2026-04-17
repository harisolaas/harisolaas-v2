import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/participations?eventId=&status=&personId=&referralUnresolved=true&limit=&offset=
export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const status = url.searchParams.get("status");
  const personIdParam = url.searchParams.get("personId");
  const referralUnresolved =
    url.searchParams.get("referralUnresolved") === "true";
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const conditions: SQL[] = [];
  if (eventId) conditions.push(eq(schema.participations.eventId, eventId));
  if (status) conditions.push(eq(schema.participations.status, status));
  if (personIdParam) {
    const personId = Number(personIdParam);
    if (Number.isFinite(personId)) {
      conditions.push(eq(schema.participations.personId, personId));
    }
  }
  if (referralUnresolved) {
    conditions.push(isNotNull(schema.participations.referralNote));
    conditions.push(isNull(schema.participations.referredByPersonId));
  }

  const rows = await db
    .select({
      id: schema.participations.id,
      eventId: schema.participations.eventId,
      role: schema.participations.role,
      status: schema.participations.status,
      date: schema.participations.date,
      createdAt: schema.participations.createdAt,
      updatedAt: schema.participations.updatedAt,
      attribution: schema.participations.attribution,
      linkSlug: schema.participations.linkSlug,
      referredByPersonId: schema.participations.referredByPersonId,
      referralNote: schema.participations.referralNote,
      externalPaymentId: schema.participations.externalPaymentId,
      priceCents: schema.participations.priceCents,
      currency: schema.participations.currency,
      usedAt: schema.participations.usedAt,
      metadata: schema.participations.metadata,
      person: {
        id: schema.people.id,
        email: schema.people.email,
        name: schema.people.name,
      },
      event: {
        id: schema.events.id,
        type: schema.events.type,
        name: schema.events.name,
        date: schema.events.date,
      },
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .innerJoin(
      schema.events,
      eq(schema.events.id, schema.participations.eventId),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.participations.createdAt))
    .limit(limit)
    .offset(offset);

  const countRes = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM participations
    ${conditions.length > 0 ? sql`WHERE ${and(...conditions)}` : sql``}
  `);
  const total = Number(countRes.rows?.[0]?.n ?? rows.length);

  return NextResponse.json({
    total,
    limit,
    offset,
    participations: rows.map((r) => ({
      ...r,
      date: r.date.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      usedAt: r.usedAt?.toISOString() ?? null,
      event: { ...r.event, date: r.event.date.toISOString() },
    })),
  });
}
