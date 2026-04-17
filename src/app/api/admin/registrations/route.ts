import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

const PLANT_EVENT_ID = "plant-2026-04";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const rows = await db
    .select({
      id: schema.participations.id,
      email: schema.people.email,
      name: schema.people.name,
      status: schema.participations.status,
      createdAt: schema.participations.createdAt,
      metadata: schema.participations.metadata,
      attribution: schema.participations.attribution,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.eventId, PLANT_EVENT_ID))
    .orderBy(asc(schema.participations.createdAt));

  // Match the PlantRegistration shape the admin UI reads.
  const registrations = rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      const attr = (r.attribution as Record<string, unknown> | null) ?? null;
      return {
        id: r.id,
        email: r.email ?? "",
        name: r.name,
        status: r.status === "waitlist" ? "waitlist" : "registered",
        groupType: meta.groupType,
        carpool: Boolean(meta.carpool),
        message: meta.message as string | undefined,
        createdAt: r.createdAt.toISOString(),
        utm: attr
          ? {
              source: attr.source as string | undefined,
              medium: attr.medium as string | undefined,
              campaign: attr.campaign as string | undefined,
            }
          : undefined,
      };
    });

  return NextResponse.json({ registrations });
}
