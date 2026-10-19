import { formatArsLabel, hackeaConfig } from "@/data/hackea";
import { phoneToWaMe } from "@/lib/plant-types";

// Emails for Hackeá tu mente: the buyer's confirmation and the host
// notification. Pure builders — the webhook decides when to send them.
// A clean on-brand mail over the landing's violet palette; Outlook strips
// webfonts, so system stacks only.

const BG = "#0E0B1A";
const CARD = "#FFFFFF";
const VIOLET = "#5B2BD6";
const VIOLET_SOFT = "#EFEAFD";
const INK = "#1C1830";
const MUTED = "#5E5A73";
const LINE = "#E4E0F0";

const BODY_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const MONO_STACK = `'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace`;

/** Hari's WhatsApp — same number the landing links to. */
export const HACKEA_CONTACT_WA_ME = "5491122555110";

/** Names, emails and phones are typed by the buyer: never interpolate raw. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "Jueves 29 de octubre" from `YYYY-MM-DD` — by hand, no runtime ICU. */
export function hackeaDateLabel(date: string = hackeaConfig.date): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} de ${MONTHS[m - 1]}`;
}

/**
 * wa.me link to the buyer with a greeting already typed, so the host taps
 * once and only has to hit send.
 */
export function hackeaGreetingWaMeUrl(phone: string, name: string): string {
  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  const text = `Hola ${firstName}, soy Hari. Gracias por sumarte a Hackeá tu mente. Te escribo para pasarte los detalles del ${hackeaDateLabel().toLowerCase()}.`;
  return `https://wa.me/${phoneToWaMe(phone)}?text=${encodeURIComponent(text)}`;
}

export const HACKEA_BUYER_SUBJECT = "Tu entrada para Hackeá tu mente";

export interface HackeaBuyerEmailParams {
  name: string;
  participationId: string;
}

export function buildHackeaBuyerConfirmationHtml({
  name,
  participationId,
}: HackeaBuyerEmailParams): string {
  const { startTime, exactAddress, exactAddressMapLink } = hackeaConfig;
  const safeName = escapeHtml(name.trim());
  const safeId = escapeHtml(participationId);
  const contactHref = `https://wa.me/${HACKEA_CONTACT_WA_ME}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${BODY_STACK};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:${CARD};border-radius:16px;overflow:hidden">

<tr><td style="background:${VIOLET};padding:40px 24px 36px;text-align:center">
  <p style="margin:0 0 10px;color:#FFFFFF;opacity:0.8;font-family:${MONO_STACK};font-size:12px;letter-spacing:2px;text-transform:uppercase">Pago confirmado</p>
  <h1 style="margin:0;color:#FFFFFF;font-family:${BODY_STACK};font-size:26px;letter-spacing:3px;font-weight:800;text-transform:uppercase">Hackeá tu mente</h1>
</td></tr>

<tr><td style="padding:32px 24px 0">
  <h2 style="margin:0 0 8px;color:${VIOLET};font-size:20px;font-weight:700">Hola ${safeName}, tu lugar está confirmado.</h2>
  <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.6">Recibimos tu pago. Guardá este mail: es el comprobante de tu entrada.</p>
</td></tr>

<tr><td style="padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${INK}">
    <tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};width:90px;vertical-align:top"><strong style="color:${VIOLET}">Entrada</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};text-align:right;font-family:${MONO_STACK};letter-spacing:1px">${safeId}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};vertical-align:top"><strong style="color:${VIOLET}">Cuándo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};text-align:right">${hackeaDateLabel()} &middot; ${startTime} h</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:${VIOLET}">Dónde</strong></td>
        <td style="padding:10px 0;text-align:right;line-height:1.5">${exactAddress}</td></tr>
  </table>

  <div style="margin-top:24px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:${VIOLET};color:#FFFFFF;font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:0 24px 24px">
  <div style="padding:18px 20px;background:${VIOLET_SOFT};border-radius:12px">
    <p style="margin:0 0 8px;color:${VIOLET};font-size:14px;font-weight:700">Te escribimos por WhatsApp</p>
    <p style="margin:0;color:${MUTED};font-size:13px;line-height:1.7">Te escribimos al número que dejaste con los detalles del encuentro. Si tenés alguna duda, escribinos cuando quieras.</p>
    <p style="margin:14px 0 0"><a href="${contactHref}" style="color:${VIOLET};font-size:13px;font-weight:600;text-decoration:none">Escribir por WhatsApp</a></p>
  </div>
</td></tr>

<tr><td style="padding:20px 24px 26px;text-align:center;border-top:1px solid ${LINE}">
  <p style="margin:0 0 6px;color:${MUTED};font-size:12px">Hackeá tu mente &middot; ${hackeaConfig.neighborhood}</p>
  <p style="margin:0;color:${MUTED};opacity:0.7;font-size:11px">harisolaas.com${hackeaConfig.landingPath}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface HackeaHostNotificationParams {
  name: string;
  phone: string | null;
  email: string | null;
  participationId: string;
  amountCents: number;
  /** Confirmed + used entradas for the event, this one included. */
  totalConfirmed: number;
}

export function hackeaHostSubject(name: string): string {
  // Buyer-typed: collapse every whitespace run (CR/LF included) so the
  // name can't break the header line.
  return `Nueva entrada Hackeá tu mente — ${name.replace(/\s+/g, " ").trim()}`;
}

// Internal mail so the host can reach the buyer on WhatsApp by hand — the
// wa.me link carries a prefilled greeting. It never promises the ebook's
// delivery: Hari hands it out at the talk.
export function buildHackeaHostNotificationHtml({
  name,
  phone,
  email,
  participationId,
  amountCents,
  totalConfirmed,
}: HackeaHostNotificationParams): string {
  const safeName = escapeHtml(name.trim());
  const phoneCell = phone
    ? `<a href="${escapeHtml(hackeaGreetingWaMeUrl(phone, name))}" style="color:${VIOLET};text-decoration:none;font-weight:600">${escapeHtml(phone)}</a>`
    : `<span style="color:${MUTED}">sin WhatsApp</span>`;
  const emailCell = email
    ? `<a href="mailto:${escapeHtml(email)}" style="color:${VIOLET};text-decoration:none">${escapeHtml(email)}</a>`
    : `<span style="color:${MUTED}">sin email</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${VIOLET_SOFT};font-family:${BODY_STACK};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:${CARD};border-radius:12px;overflow:hidden">
<tr><td style="background:${VIOLET};padding:20px 24px">
  <p style="margin:0;color:#FFFFFF;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Nueva entrada &middot; Hackeá tu mente</p>
</td></tr>
<tr><td style="padding:24px">
  <h2 style="margin:0 0 16px;color:${VIOLET};font-size:20px;font-weight:700">${safeName}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${INK}">
    <tr><td style="padding:6px 0;color:${MUTED};width:110px">WhatsApp</td><td style="padding:6px 0">${phoneCell}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Email</td><td style="padding:6px 0">${emailCell}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Entrada</td><td style="padding:6px 0;font-family:${MONO_STACK}">${escapeHtml(participationId)} &middot; ${formatArsLabel(amountCents)}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Confirmadas</td><td style="padding:6px 0">${totalConfirmed}</td></tr>
  </table>
  <p style="margin:18px 0 0;color:${MUTED};font-size:13px;line-height:1.6">Tocá el número para abrir el chat con el saludo ya escrito.</p>
</td></tr>
</table>
</body>
</html>`;
}
