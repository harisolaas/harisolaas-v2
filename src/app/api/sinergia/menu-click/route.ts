import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

// Hari's WhatsApp. Hardcoded because this is a one-off, session-scoped
// send — if it becomes recurring, lift to env.
const WHATSAPP_NUMBER = "5491122555110";
const PREFILLED_MESSAGE =
  "Hola Hari, ¿me pasás el menú del restaurante para hoy?";

// GET /api/sinergia/menu-click?r=<rsvpId>&s=<sessionDate>
//
// Public redirect — the link is embedded in the Sinergia first-session-extras
// email. We record the click (first-click-wins timestamp + per-session SET of
// rsvpIds) then 302 to WhatsApp.
//
// Fail-open: Redis errors or missing params don't block the redirect; the
// operator just doesn't get tracking data for that click.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rsvpId = url.searchParams.get("r")?.trim() ?? "";
  const sessionDate = url.searchParams.get("s")?.trim() ?? "";

  if (rsvpId && sessionDate) {
    try {
      const redis = await getRedis();
      const clickedAt = new Date().toISOString();
      // SET NX so the first click wins — later clicks don't overwrite the
      // original timestamp.
      await redis.set(
        `sinergia:menu-click:${sessionDate}:${rsvpId}`,
        clickedAt,
        { NX: true },
      );
      await redis.sAdd(`sinergia:menu-clicks:${sessionDate}`, rsvpId);
    } catch (err) {
      console.error("sinergia menu-click tracking failed:", err);
    }
  }

  const target = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    PREFILLED_MESSAGE,
  )}`;
  return NextResponse.redirect(target, 302);
}
