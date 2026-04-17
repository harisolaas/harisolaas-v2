import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export async function POST(req: Request) {
  try {
    const { ticketId, action } = (await req.json()) as {
      ticketId: string;
      action: "check" | "use" | "redeem-coffee";
    };

    if (!ticketId) {
      return NextResponse.json(
        { valid: false, error: "Missing ticket ID" },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: schema.participations.id,
        status: schema.participations.status,
        usedAt: schema.participations.usedAt,
        metadata: schema.participations.metadata,
        buyerName: schema.people.name,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.id, ticketId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ valid: false, error: "not_found" });
    }

    const row = rows[0];
    const metadata = (row.metadata as Record<string, unknown>) ?? {};
    const coffeeRedeemed = Boolean(metadata.coffeeRedeemed);

    // Legacy response shape expects string status: 'valid' | 'used'.
    const legacyStatus = row.status === "used" ? "used" : "valid";

    if (action === "check") {
      return NextResponse.json({
        valid: row.status !== "used" && row.status !== "cancelled",
        status: legacyStatus,
        coffeeRedeemed,
        ticket: {
          id: row.id,
          type: "ticket",
          buyerName: row.buyerName,
          status: legacyStatus,
          coffeeRedeemed,
        },
      });
    }

    if (action === "use") {
      if (row.status === "used") {
        return NextResponse.json({
          valid: false,
          error: "already_used",
          usedAt: row.usedAt?.toISOString(),
          coffeeRedeemed,
        });
      }

      await db
        .update(schema.participations)
        .set({
          status: "used",
          usedAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, ticketId));

      return NextResponse.json({
        valid: true,
        status: "used",
        coffeeRedeemed,
        ticket: {
          id: row.id,
          type: "ticket",
          buyerName: row.buyerName,
          status: "used",
          coffeeRedeemed,
        },
      });
    }

    if (action === "redeem-coffee") {
      if (coffeeRedeemed) {
        return NextResponse.json({
          valid: false,
          error: "coffee_already_redeemed",
          coffeeRedeemedAt: metadata.coffeeRedeemedAt,
        });
      }

      const nowIso = new Date().toISOString();
      await db
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
            ...metadata,
            coffeeRedeemed: true,
            coffeeRedeemedAt: nowIso,
          })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, ticketId));

      return NextResponse.json({
        valid: true,
        coffeeRedeemed: true,
        ticket: {
          id: row.id,
          type: "ticket",
          buyerName: row.buyerName,
          status: legacyStatus,
          coffeeRedeemed: true,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("validate error:", err);
    return NextResponse.json(
      { valid: false, error: "Server error" },
      { status: 500 },
    );
  }
}
