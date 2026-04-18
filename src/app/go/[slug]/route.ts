import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { LINK_COOKIE_NAME } from "@/lib/attribution";
import { buildDestinationUrl, isBotUserAgent } from "@/lib/links";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const rows = await db
    .select()
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1);

  const link = rows[0];
  if (!link || link.status !== "active") {
    return NextResponse.redirect(
      new URL("/", req.url).toString(),
      { status: 302 },
    );
  }

  const campaign =
    link.campaign && link.campaign.length > 0 ? link.campaign : undefined;
  const destination = buildDestinationUrl(link.destination, {
    source: link.source,
    medium: link.medium,
    campaign: campaign ?? deriveCampaignFallback(link.destination),
    slug: link.slug,
  });

  const userAgent = req.headers.get("user-agent");
  const referer = req.headers.get("referer");
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const bot = isBotUserAgent(userAgent);

  // Log the click. Bot hits are recorded with is_bot=true so we can reason
  // about them later, but they don't inflate the "real" count in UI queries.
  // Swallow failures so analytics never break the redirect.
  try {
    await db.insert(schema.linkClicks).values({
      linkSlug: link.slug,
      userAgent: userAgent ?? null,
      referer: referer ?? null,
      ipHash: hashIp(ip),
      isBot: bot,
    });
  } catch (err) {
    console.error("link_clicks insert failed:", err);
  }

  const res = NextResponse.redirect(destination, { status: 302 });
  res.cookies.set({
    name: LINK_COOKIE_NAME,
    value: link.slug,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: true,
  });
  return res;
}

function deriveCampaignFallback(destination: string): string {
  try {
    const url = destination.startsWith("http")
      ? new URL(destination)
      : new URL(destination, "https://www.harisolaas.com");
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last === "es" || last === "en") return "home";
    return last;
  } catch {
    return "home";
  }
}
