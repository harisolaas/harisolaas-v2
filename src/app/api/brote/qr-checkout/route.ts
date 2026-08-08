import { NextResponse } from "next/server";

// Printed QR flyers point here. Forwards to the landing, whose CTA creates
// the MP preference — one place mints preferences, so the confirm token and
// the `type: "ticket"` metadata can't drift between entry points.
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  return NextResponse.redirect(`${baseUrl}/es/brote?src=qr`, 302);
}
