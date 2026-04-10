import { NextResponse } from "next/server";
import {
  destroySession,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  const sessionId = match?.split("=")[1];
  if (sessionId) {
    await destroySession(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
