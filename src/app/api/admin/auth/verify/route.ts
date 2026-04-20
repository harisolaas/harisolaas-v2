import { NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  createSession,
  buildSessionCookie,
  loadAdminUserByEmail,
} from "@/lib/admin-auth";
import { getRequestBaseUrl } from "@/lib/request-origin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const baseUrl = getRequestBaseUrl(req);

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=invalid`);
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=invalid`);
  }

  // Re-check authorization at verify time. A row might have been removed
  // between magic-link request and click.
  const user = await loadAdminUserByEmail(email);
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/admin/login?error=unauthorized`);
  }

  const sessionId = await createSession({ email, ...user });
  const response = NextResponse.redirect(`${baseUrl}/admin`);
  response.headers.set("Set-Cookie", buildSessionCookie(sessionId));
  return response;
}
