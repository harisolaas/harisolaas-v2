import { NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "./admin-auth";

/**
 * Reads the admin session cookie from the request, validates against Redis.
 * Returns the session data or a 401 JSON response.
 *
 * Usage in an API route:
 * ```ts
 * const session = await requireAdminSession(req);
 * if (session instanceof NextResponse) return session;
 * // session.email is available
 * ```
 */
export async function requireAdminSession(
  req: Request,
): Promise<{ email: string } | NextResponse> {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  const sessionId = match?.split("=")[1];
  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = await validateSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  return session;
}
