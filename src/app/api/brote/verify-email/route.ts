import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/plant-types";
import {
  requestEmailVerification,
  verifyEmailCode,
} from "@/lib/email-verification-server";

// In-process rate limit — same envelope as the sibling BROTE routes, but a
// higher ceiling because one legit verification round is several requests
// (send + up to 5 verify attempts + a resend).
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "send") {
      const email = ((body.email as string) || "").trim();
      const name = ((body.name as string) || "").trim();
      const locale = body.locale === "en" ? "en" : "es";
      if (!isValidEmail(email) || !name) {
        return NextResponse.json(
          { error: "Valid email and name required" },
          { status: 400 },
        );
      }
      const result = await requestEmailVerification(email, name, locale);
      return NextResponse.json({
        ok: result.outcome === "sent",
        outcome: result.outcome,
      });
    }

    if (action === "verify") {
      const email = ((body.email as string) || "").trim();
      const code = ((body.code as string) || "").trim();
      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: "Valid email and 6-digit code required" },
          { status: 400 },
        );
      }
      const result = await verifyEmailCode(email, code);
      return NextResponse.json({
        ok: result.outcome === "verified",
        outcome: result.outcome,
        ...(result.outcome === "verified" ? { token: result.token } : {}),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("brote/verify-email error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 },
    );
  }
}
