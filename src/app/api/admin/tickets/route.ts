import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminSession } from "@/lib/admin-api-auth";

const BROTE_EVENT_ID = "brote-2026-03-28";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const rows = await db
    .select({
      id: schema.participations.id,
      paymentId: schema.participations.externalPaymentId,
      buyerEmail: schema.people.email,
      buyerName: schema.people.name,
      status: schema.participations.status,
      createdAt: schema.participations.createdAt,
      usedAt: schema.participations.usedAt,
      metadata: schema.participations.metadata,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID))
    .orderBy(desc(schema.participations.createdAt));

  const tickets = rows.map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {};
    return {
      id: r.id,
      type: "ticket" as const,
      paymentId: r.paymentId ?? "",
      buyerEmail: r.buyerEmail ?? "",
      buyerName: r.buyerName,
      status: r.status === "used" ? "used" : "valid",
      createdAt: r.createdAt.toISOString(),
      usedAt: r.usedAt?.toISOString(),
      emailSent: Boolean(meta.emailSent),
      coffeeRedeemed: Boolean(meta.coffeeRedeemed),
      coffeeRedeemedAt: meta.coffeeRedeemedAt as string | undefined,
    };
  });

  return NextResponse.json({ tickets });
}
