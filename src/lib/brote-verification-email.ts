import { Resend } from "resend";
import type { Locale } from "@/i18n/config";
import { artOfLivingInstagram } from "@/data/brote";

// Lazy Resend instantiation (same pattern as the BROTE webhook) so importing
// this module never crashes a build where RESEND_API_KEY is absent.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export interface BroteVerificationEmailInput {
  email: string;
  code: string;
  name: string;
  locale: Locale;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * DORMANT — `/brote/checkout` no longer exists.
 *
 * BROTE went back to sending buyers straight to MercadoPago, so the
 * pre-payment verification form was deleted along with the route that
 * triggered these emails. This module and `email-verification-server.ts`
 * are kept intact (with the `email_verifications` table) because the flow
 * is worth reusing, but **the URL below points at a 404 today**. Whoever
 * reactivates it has to re-point it at whatever page hosts the code form.
 *
 * The link autofills email, code and name — same TTL and attempt limit as
 * typing the code by hand. It carries the name because the link opens a
 * fresh browser context (mail app), where nothing the person already typed
 * in the original form survives.
 */
export function verificationLinkUrl(
  email: string,
  code: string,
  name: string,
  locale: Locale,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
  const params = new URLSearchParams({ verifEmail: email, verifCode: code, verifName: name });
  return `${baseUrl}/${locale}/brote/checkout?${params.toString()}`;
}

const COPY = {
  es: {
    subject: (code: string) => `Tu código para comprar tu entrada BROTE: ${code}`,
    tagline: "Fiesta de reforestación",
    eyebrow: "Verificá tu email",
    heading: "Tu código de verificación",
    body: "Ingresá este código en la página de compra para confirmar que este email es tuyo. Vence en 10 minutos.",
    ctaLabel: "Verificar y seguir con la compra",
    ignore: "Si no fuiste vos, podés ignorar este mensaje.",
  },
  en: {
    subject: (code: string) => `Your code to buy your BROTE ticket: ${code}`,
    tagline: "Reforestation party",
    eyebrow: "Verify your email",
    heading: "Your verification code",
    body: "Enter this code on the checkout page to confirm this email is yours. It expires in 10 minutes.",
    ctaLabel: "Verify and continue to checkout",
    ignore: "If this wasn't you, you can ignore this message.",
  },
} as const;

export function renderBroteVerificationEmail(input: BroteVerificationEmailInput): {
  subject: string;
  html: string;
} {
  const { email, code, name, locale } = input;
  const copy = COPY[locale] ?? COPY.es;
  const link = verificationLinkUrl(email, code, name, locale);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<!-- Header -->
<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:36px;letter-spacing:3px;font-weight:700">BROTE</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">${copy.tagline}</p>
</td></tr>

<!-- Code -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <p style="margin:0 0 8px;color:#C4704B;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase">${copy.eyebrow}</p>
  <h2 style="margin:0 0 20px;color:#2D4A3E;font-size:24px;font-weight:700">${copy.heading}</h2>
  <div style="display:inline-block;padding:16px 28px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0;color:#2D4A3E;font-size:36px;font-weight:700;letter-spacing:8px">${escapeHtml(code)}</p>
  </div>
  <p style="margin:20px 0 0;color:#666;font-size:14px;line-height:1.6">${copy.body}</p>
</td></tr>

<!-- CTA -->
<tr><td style="padding:24px;text-align:center">
  <a href="${link}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.5px">${copy.ctaLabel}</a>
  <p style="margin:20px 0 0;color:#aaa;font-size:12px">${copy.ignore}</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE · <a href="${artOfLivingInstagram}" style="color:#aaa;text-decoration:underline">El Arte de Vivir</a></p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: copy.subject(code), html };
}

export async function sendBroteVerificationCodeEmail(
  input: BroteVerificationEmailInput,
): Promise<void> {
  const { subject, html } = renderBroteVerificationEmail(input);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  const result = await getResend().emails.send({
    from: `BROTE <${fromEmail}>`,
    to: input.email,
    subject,
    html,
  });
  if (result.error) {
    throw new Error(
      `Resend error sending verification code: ${result.error.name}: ${result.error.message}`,
    );
  }
}
