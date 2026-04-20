import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isAllowedEmail, createMagicLinkToken } from "@/lib/admin-auth";
import { buildMagicLinkEmailHtml } from "@/lib/admin-email";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const normalized = (email || "").trim().toLowerCase();

    // Always return ok — never reveal whether the email is in the allowlist
    if (!normalized || !normalized.includes("@")) {
      return NextResponse.json({ ok: true });
    }
    if (!(await isAllowedEmail(normalized))) {
      return NextResponse.json({ ok: true });
    }

    const token = await createMagicLinkToken(normalized);
    // Derive the origin from the request so preview deploys get links
    // back to themselves instead of prod. `NEXT_PUBLIC_BASE_URL` is the
    // prod domain on every Vercel deploy, so using it here meant clicking
    // the magic link always landed you on prod regardless of which
    // deploy you requested it from.
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const baseUrl = host
      ? `${proto}://${host}`
      : process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
    const loginUrl = `${baseUrl}/api/admin/auth/verify?token=${token}`;

    const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
    await getResend().emails.send({
      from: `BROTE Admin <${fromEmail}>`,
      to: normalized,
      subject: "Tu link de acceso al admin",
      html: buildMagicLinkEmailHtml(loginUrl),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
