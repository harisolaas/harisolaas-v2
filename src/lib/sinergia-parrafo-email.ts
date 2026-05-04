import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";
import { phoneToWaMe } from "@/lib/sinergia-types";

// Palette + type stacks mirror the Sinergia landing so the email reads as
// the same brand. Outlook desktop strips webfonts; sans fallbacks all the
// way down keeps the layout from flipping to serif.
const CREAM = "#F1ECDA";
const CREAM_DARK = "#E5DEC6";
const BLUE = "#0E6BA8";
const ACCENT = "#D97A3A";
const CHARCOAL = "#1F2A37";
const MUTED = "#5A6775";

const DISPLAY_STACK = `'Unbounded', 'Futura', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif`;
const BODY_STACK = `'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const SCRIPT_STACK = `'Dancing Script', 'Brush Script MT', cursive`;

const EMAIL_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

const FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&family=Unbounded:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&family=Unbounded:wght@400;600;700&display=swap');
@font-face {
  font-family: 'Aileron';
  src: url('${EMAIL_BASE_URL}/fonts/sinergia/aileron-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Aileron';
  src: url('${EMAIL_BASE_URL}/fonts/sinergia/aileron-bold.woff2') format('woff2');
  font-weight: 600 700;
  font-style: normal;
  font-display: swap;
}
</style>`;

interface TicketParams {
  name: string;
  ticketId: string;
  /** ARS cents — formatted as $X.XXX in the email body. */
  amountCents: number;
  paymentId: string;
}

// QR data URL → email attachment. Strips the `data:image/png;base64,`
// prefix and decodes the rest into a Buffer suitable for Resend's
// `attachments[].content`. Mirrors `qrDataUrlToBuffer` in brote-email so
// both webhook flows go through the same proven shape.
export function qrDataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

function formatArs(amountCents: number): string {
  const pesos = Math.round(amountCents / 100);
  return `$${pesos.toLocaleString("es-AR")}`;
}

export function buildSinergiaParrafoTicketEmailHtml({
  name,
  ticketId,
  amountCents,
  paymentId,
}: TicketParams): string {
  const { startTime, endTime, exactAddress, exactAddressMapLink, venueName } =
    sinergiaParrafoConfig;
  const amountLabel = formatArs(amountCents);
  const dateLabel = "Sábado 16 de mayo";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${FONT_HEAD}
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${BODY_STACK};color:${CHARCOAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(14,107,168,0.10)">

<tr><td style="background:${BLUE};padding:44px 24px 40px;text-align:center">
  <p style="margin:0 0 10px;color:${CREAM};font-family:${SCRIPT_STACK};font-size:22px;font-weight:500;letter-spacing:0.5px">Tu lugar está reservado</p>
  <h1 style="margin:0;color:${CREAM};font-family:${DISPLAY_STACK};font-size:26px;letter-spacing:3px;font-weight:700">SINERGIA × PÁRRAFO</h1>
  <p style="margin:12px 0 0;color:${CREAM};opacity:0.78;font-family:${BODY_STACK};font-size:13px;letter-spacing:1px">Meditación, lectura y almuerzo</p>
</td></tr>

<tr><td style="padding:32px 24px 0;text-align:center">
  <h2 style="margin:0 0 6px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:22px;font-weight:600">Nos vemos, ${name}.</h2>
  <p style="margin:8px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:15px;line-height:1.6">Recibimos tu pago. Mostrá este QR al llegar.</p>
</td></tr>

<tr><td style="padding:24px;text-align:center">
  <div style="display:inline-block;padding:18px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
    <img src="cid:qr" alt="Entrada ${ticketId}" width="220" height="220" style="display:block;width:220px;height:220px"/>
  </div>
  <p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:12px;letter-spacing:1px">${ticketId}</p>
</td></tr>

<tr><td style="padding:0 24px"><div style="height:1px;background:${CREAM_DARK}"></div></td></tr>

<tr><td style="padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${BODY_STACK};font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};width:90px;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Cuándo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right">${dateLabel} &middot; ${startTime}–${endTime}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Dónde</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right;line-height:1.5">${venueName}<br>${exactAddress}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Entrada</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right">${amountLabel}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Ref.</strong></td>
        <td style="padding:10px 0;text-align:right;font-family:${BODY_STACK};color:${MUTED};font-size:12px">${paymentId}</td></tr>
  </table>

  <div style="margin-top:24px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:0 24px 24px">
  <div style="padding:18px 20px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
    <p style="margin:0 0 10px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:14px;font-weight:600;letter-spacing:0.3px">Para llevar</p>
    <p style="margin:0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.8">
      &middot; Un libro &mdash; el que estés leyendo o quieras empezar<br>
      &middot; Un cuaderno y algo para escribir<br>
      &middot; Ropa cómoda
    </p>
    <p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.6">El almuerzo está incluido. Si tenés alguna restricción alimentaria, escribinos por WhatsApp.</p>
  </div>
</td></tr>

<tr><td style="padding:0 24px 28px;text-align:center">
  <p style="margin:0;color:${ACCENT};font-family:${SCRIPT_STACK};font-size:22px">Nos vemos el sábado.</p>
</td></tr>

<tr><td style="padding:22px 24px 28px;text-align:center;border-top:1px solid ${CREAM_DARK};background:#fdfbf5">
  <p style="margin:0 0 6px;color:${MUTED};font-family:${BODY_STACK};font-size:12px">Sinergia × Párrafo &middot; Sky Campus, Palermo</p>
  <p style="margin:0;color:${MUTED};opacity:0.65;font-family:${BODY_STACK};font-size:11px">harisolaas.com/sinergia-parrafo</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

interface HostNotifyParams {
  name: string;
  email: string;
  phone?: string;
  ticketId: string;
  amountCents: number;
  totalRegistered: number;
  remaining: number;
  capacity: number;
}

// Internal notification fired alongside the attendee ticket so the host
// sees who's coming and can reach them on WhatsApp directly.
export function buildSinergiaParrafoHostNotificationHtml({
  name,
  email,
  phone,
  ticketId,
  amountCents,
  totalRegistered,
  remaining,
  capacity,
}: HostNotifyParams): string {
  const phoneRow = phone
    ? `<tr><td style="padding:6px 0;color:${MUTED};width:110px">WhatsApp</td><td style="padding:6px 0"><a href="https://wa.me/${phoneToWaMe(phone)}" style="color:${BLUE};text-decoration:none">${phone}</a></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${CREAM};font-family:${BODY_STACK};color:${CHARCOAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(14,107,168,0.08)">
<tr><td style="background:${BLUE};padding:20px 24px">
  <p style="margin:0;color:${CREAM};font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Nueva entrada · Sinergia × Párrafo</p>
</td></tr>
<tr><td style="padding:24px">
  <h2 style="margin:0 0 16px;color:${BLUE};font-size:20px;font-weight:600">${name}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:6px 0;color:${MUTED};width:110px">Email</td><td style="padding:6px 0"><a href="mailto:${email}" style="color:${BLUE};text-decoration:none">${email}</a></td></tr>
    ${phoneRow}
    <tr><td style="padding:6px 0;color:${MUTED}">Entrada</td><td style="padding:6px 0">${ticketId} &middot; ${formatArs(amountCents)}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Ocupación</td><td style="padding:6px 0">${totalRegistered} / ${capacity} &middot; quedan ${remaining}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
