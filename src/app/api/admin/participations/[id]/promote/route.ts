import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  CapacityReachedError,
  promoteWaitlist,
} from "@/lib/community";

// POST /api/admin/participations/:id/promote
// Body: { externalPaymentId?, priceCents?, currency?, metadata? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    externalPaymentId?: string;
    priceCents?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    const res = await promoteWaitlist(id, body);
    return NextResponse.json({ ok: true, result: res });
  } catch (err) {
    if (err instanceof CapacityReachedError) {
      return NextResponse.json(
        { ok: false, error: "capacity_reached" },
        { status: 409 },
      );
    }
    console.error("promoteWaitlist failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
