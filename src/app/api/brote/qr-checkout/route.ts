import { NextResponse } from "next/server";

// Printed QR flyers point here. This used to create an MP preference
// directly (no identity capture); now that checkout requires a verified
// email, it just forwards to the checkout page — no unverified bypass.
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  return NextResponse.redirect(`${baseUrl}/es/brote/checkout?src=qr`, 302);
}
