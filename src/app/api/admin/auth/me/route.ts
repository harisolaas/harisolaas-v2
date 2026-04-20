import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";

export async function GET(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;
  return NextResponse.json({
    email: session.email,
    role: session.role,
    scope: session.scope,
    allowedEventIds: session.allowedEventIds,
  });
}
