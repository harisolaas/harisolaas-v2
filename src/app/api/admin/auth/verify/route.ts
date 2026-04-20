import { NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  createSession,
  buildSessionCookie,
  loadAdminUserByEmail,
} from "@/lib/admin-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  // Redirect targets mirror the deploy the user verified from. If the
  // magic-link email was sent by a preview deploy (login/route.ts also
  // derives from the request), verify keeps them on that preview.
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

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
