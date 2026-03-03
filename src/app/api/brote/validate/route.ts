import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import type { BroteTicket } from "@/lib/brote-types";

export async function POST(req: Request) {
  try {
    const { ticketId, action } = (await req.json()) as {
      ticketId: string;
      action: "check" | "use";
    };

    if (!ticketId) {
      return NextResponse.json(
        { valid: false, error: "Missing ticket ID" },
        { status: 400 },
      );
    }

    const redis = await getRedis();
    const raw = await redis.get(`brote:ticket:${ticketId}`);
    if (!raw) {
      return NextResponse.json({ valid: false, error: "not_found" });
    }

    const ticket: BroteTicket = JSON.parse(raw);

    if (action === "check") {
      return NextResponse.json({
        valid: ticket.status === "valid",
        status: ticket.status,
        ticket: {
          id: ticket.id,
          type: ticket.type,
          buyerName: ticket.buyerName,
          status: ticket.status,
        },
      });
    }

    if (action === "use") {
      if (ticket.status === "used") {
        return NextResponse.json({
          valid: false,
          error: "already_used",
          usedAt: ticket.usedAt,
        });
      }

      ticket.status = "used";
      ticket.usedAt = new Date().toISOString();
      await redis.set(`brote:ticket:${ticket.id}`, JSON.stringify(ticket));

      return NextResponse.json({
        valid: true,
        status: "used",
        ticket: {
          id: ticket.id,
          type: ticket.type,
          buyerName: ticket.buyerName,
          status: ticket.status,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Server error" },
      { status: 500 },
    );
  }
}
