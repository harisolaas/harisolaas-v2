import { NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  createSession,
  buildSessionCookie,
} from "@/lib/admin-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=invalid`);
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=invalid`);
  }

  const sessionId = await createSession(email);
  const response = NextResponse.redirect(`${baseUrl}/admin`);
  response.headers.set("Set-Cookie", buildSessionCookie(sessionId));
  return response;
}
