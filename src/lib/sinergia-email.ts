import { sinergiaConfig } from "@/data/sinergia";
import { formatSessionDateEs, phoneToWaMe } from "@/lib/sinergia-types";

interface Params {
  name: string;
  sessionDate: string;
  staysForDinner: boolean;
}

// Palette + type stacks mirror the Sinergia landing (/[locale]/sinergia).
//
// Fonts in email are best-effort: Apple Mail + Gmail webapp honor @import /
// @font-face, Outlook desktop strips them. The fallbacks stay sans-serif
// all the way down so the email still reads as designed when Unbounded
// doesn't load (earlier fallback was Georgia, which flipped headings to
// serif — the mismatch we're correcting).
const CREAM = "#F1ECDA";
const CREAM_DARK = "#E5DEC6";
const BLUE = "#0E6BA8";
const ACCENT = "#D97A3A";
const CHARCOAL = "#1F2A37";
const MUTED = "#5A6775";

const DISPLAY_STACK = `'Unbounded', 'Futura', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif`;
const BODY_STACK = `'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const SCRIPT_STACK = `'Dancing Script', 'Brush Script MT', cursive`;

// Shared <head> fragment — injected at the top of every user-facing
// Sinergia email (all templates except host-notification, which is an
// internal-only email with a minimal head). Declares the webfonts three
// ways (link, @import, @font-face) so each client picks up whichever it
// supports. The Aileron woff2 files live at /public/fonts/sinergia/ and
// are served from NEXT_PUBLIC_BASE_URL (falling back to the prod domain
// so emails rendered from a preview deploy still reference reachable,
// CORS-open font URLs).
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

interface ReminderParams {
  name: string;
  sessionDate: string;
  staysForDinner: boolean;
}

export function buildSinergiaReminderEmailHtml({
  name,
  sessionDate,
  staysForDinner,
}: ReminderParams): string {
  const dateLabel = formatSessionDateEs(sessionDate);
  const { time, exactAddress, exactAddressMapLink, venueName } = sinergiaConfig;

  const dinnerLine = staysForDinner
    ? `<p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.6">Te quedás a cenar — traé algo simple para la mesa si querés.</p>`
    : "";

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

<tr><td style="background:${BLUE};padding:40px 24px;text-align:center">
  <p style="margin:0 0 8px;color:${CREAM};font-family:${SCRIPT_STACK};font-size:24px;font-weight:500">Hoy es miércoles</p>
  <h1 style="margin:0;color:${CREAM};font-family:${DISPLAY_STACK};font-size:30px;letter-spacing:3px;font-weight:700">SINERGIA</h1>
</td></tr>

<tr><td style="padding:32px 24px 8px;text-align:center">
  <h2 style="margin:0;color:${BLUE};font-family:${DISPLAY_STACK};font-size:22px;font-weight:600">Nos vemos a las ${time}, ${name}.</h2>
  <p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:15px;line-height:1.6">Una hora para vos, en el medio de la semana. Si podés venir con tiempo de sobra, mejor.</p>
  ${dinnerLine}
</td></tr>

<tr><td style="padding:24px 24px 0"><div style="height:1px;background:${CREAM_DARK}"></div></td></tr>

<tr><td style="padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${BODY_STACK};font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};width:90px;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Cuándo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right">${dateLabel} &middot; ${time}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Dónde</strong></td>
        <td style="padding:10px 0;text-align:right;line-height:1.5">${venueName}<br>${exactAddress}</td></tr>
  </table>

  <div style="margin-top:24px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:22px 24px 28px;text-align:center;border-top:1px solid ${CREAM_DARK};background:#fdfbf5">
  <p style="margin:0 0 6px;color:${MUTED};font-family:${BODY_STACK};font-size:12px">Sinergia &middot; Hari &amp; Coni &middot; Sky Campus</p>
  <p style="margin:0;color:${MUTED};opacity:0.65;font-family:${BODY_STACK};font-size:11px">harisolaas.com/sinergia</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

interface FirstSessionExtrasParams {
  name: string;
  menuLink: string;
}

// Day-of "extras" email. Copy ("Hoy arrancamos", "Cuándo: Hoy") assumes
// it's sent on the session date itself. The admin action accepts a
// `sessionDate` override only so we can target a specific event; do NOT
// trigger this template against a future date — the copy will mislead.
export function buildSinergiaFirstSessionExtrasEmailHtml({
  name,
  menuLink,
}: FirstSessionExtrasParams): string {
  const { time, exactAddress, exactAddressMapLink, venueName } = sinergiaConfig;

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

<tr><td style="background:${BLUE};padding:40px 24px;text-align:center">
  <p style="margin:0 0 8px;color:${CREAM};font-family:${SCRIPT_STACK};font-size:24px;font-weight:500">Hoy arrancamos</p>
  <h1 style="margin:0;color:${CREAM};font-family:${DISPLAY_STACK};font-size:30px;letter-spacing:3px;font-weight:700">SINERGIA</h1>
</td></tr>

<tr><td style="padding:32px 24px 8px;text-align:center">
  <h2 style="margin:0;color:${BLUE};font-family:${DISPLAY_STACK};font-size:22px;font-weight:600">Qué llevar, ${name}.</h2>
  <p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:15px;line-height:1.6">A las 20:00, después de meditar, abrimos el rato de lectura y escritura &mdash; un rato a solas con un texto o con una hoja en blanco.</p>
</td></tr>

<tr><td style="padding:20px 24px 0">
  <div style="padding:18px 20px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
    <p style="margin:0 0 10px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:14px;font-weight:600;letter-spacing:0.3px">Para aprovecharlo, traé</p>
    <p style="margin:0;color:${CHARCOAL};font-family:${BODY_STACK};font-size:14px;line-height:1.9">
      &middot; Un cuaderno (u hojas sueltas)<br>
      &middot; Un libro &mdash; algo que estés leyendo o que quieras empezar<br>
      &middot; Una birome que escriba
    </p>
    <p style="margin:12px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.6">Si llegás con las manos vacías, tranqui: tenemos la biblioteca del Arte de Vivir a disposición, con propuestas para elegir cuando llegues.</p>
  </div>
</td></tr>

<tr><td style="padding:24px 24px 0">
  <div style="padding:18px 20px;background:#fdfbf5;border-radius:12px;border:1px solid ${CREAM_DARK}">
    <p style="margin:0 0 10px;color:${ACCENT};font-family:${BODY_STACK};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Para quienes se quedan a cenar</p>
    <p style="margin:0 0 14px;color:${CHARCOAL};font-family:${BODY_STACK};font-size:14px;line-height:1.7">Además de lo casero que vamos a tener, armamos un menú de un restaurante cercano &mdash; comida sana y casera &mdash; por si preferís pedir de ahí. Si querés ver las opciones, escribime por WhatsApp y te paso el menú.</p>
    <div style="text-align:center">
      <a href="${menuLink}" style="display:inline-block;background:#25D366;color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Escribime por WhatsApp</a>
    </div>
  </div>
</td></tr>

<tr><td style="padding:24px 24px 0"><div style="height:1px;background:${CREAM_DARK}"></div></td></tr>

<tr><td style="padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${BODY_STACK};font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};width:90px;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Cuándo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right">Hoy &middot; ${time}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Dónde</strong></td>
        <td style="padding:10px 0;text-align:right;line-height:1.5">${venueName}<br>${exactAddress}</td></tr>
  </table>

  <div style="margin-top:24px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:22px 24px 28px;text-align:center;border-top:1px solid ${CREAM_DARK};background:#fdfbf5">
  <p style="margin:0 0 6px;color:${MUTED};font-family:${BODY_STACK};font-size:12px">Sinergia &middot; Hari &amp; Coni &middot; Sky Campus</p>
  <p style="margin:0;color:${MUTED};opacity:0.65;font-family:${BODY_STACK};font-size:11px">harisolaas.com/sinergia</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

interface ErratumParams {
  name: string;
  oldDate: string; // e.g. "2026-04-15"
  newDate: string; // e.g. "2026-04-22"
}

export function buildSinergiaErratumEmailHtml({
  name,
  oldDate,
  newDate,
}: ErratumParams): string {
  const oldLabel = formatSessionDateEs(oldDate);
  const newLabel = formatSessionDateEs(newDate);
  const { time, exactAddress, exactAddressMapLink, venueName } = sinergiaConfig;

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

<tr><td style="background:${BLUE};padding:36px 24px;text-align:center">
  <p style="margin:0 0 8px;color:${CREAM};font-family:${BODY_STACK};font-size:11px;letter-spacing:2.5px;text-transform:uppercase">Fe de erratas</p>
  <h1 style="margin:0;color:${CREAM};font-family:${DISPLAY_STACK};font-size:28px;letter-spacing:3px;font-weight:700">SINERGIA</h1>
</td></tr>

<tr><td style="padding:32px 24px 8px">
  <h2 style="margin:0 0 12px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:22px;font-weight:600">Hola ${name},</h2>
  <p style="margin:0 0 12px;color:${CHARCOAL};font-family:${BODY_STACK};font-size:15px;line-height:1.7">
    Hubo un error en el mail de confirmación que te mandamos: decía que nos veíamos <span style="text-decoration:line-through;color:${MUTED}">${oldLabel}</span>, pero en realidad Sinergia arranca el miércoles que viene.
  </p>
  <p style="margin:0 0 16px;color:${CHARCOAL};font-family:${BODY_STACK};font-size:15px;line-height:1.7">
    Te mantuvimos el lugar para esa fecha. Todo lo demás sigue igual.
  </p>
</td></tr>

<tr><td style="padding:16px 24px 0">
  <div style="padding:18px 20px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
    <p style="margin:0 0 10px;color:${ACCENT};font-family:${BODY_STACK};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Nueva fecha</p>
    <p style="margin:0 0 4px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:20px;font-weight:600">${newLabel}</p>
    <p style="margin:0;color:${MUTED};font-family:${BODY_STACK};font-size:14px">${time} &middot; ${venueName} &middot; ${exactAddress}</p>
  </div>
</td></tr>

<tr><td style="padding:24px 24px 8px;text-align:center">
  <a href="${exactAddressMapLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
</td></tr>

<tr><td style="padding:16px 24px 28px;text-align:center">
  <p style="margin:0;color:${MUTED};font-family:${SCRIPT_STACK};font-size:20px">Perdón por la confusión — nos vemos ahí.</p>
</td></tr>

<tr><td style="padding:22px 24px 28px;text-align:center;border-top:1px solid ${CREAM_DARK};background:#fdfbf5">
  <p style="margin:0 0 6px;color:${MUTED};font-family:${BODY_STACK};font-size:12px">Sinergia &middot; Hari &amp; Coni &middot; Sky Campus</p>
  <p style="margin:0;color:${MUTED};opacity:0.65;font-family:${BODY_STACK};font-size:11px">harisolaas.com/sinergia</p>
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
  sessionDate: string;
  staysForDinner: boolean;
  totalRegistered: number;
  remaining: number;
  capacity: number;
}

export function buildSinergiaHostNotificationHtml({
  name,
  email,
  phone,
  sessionDate,
  staysForDinner,
  totalRegistered,
  remaining,
  capacity,
}: HostNotifyParams): string {
  const dateLabel = formatSessionDateEs(sessionDate);
  const phoneRow = phone
    ? `<tr><td style="padding:6px 0;color:${MUTED};width:110px">WhatsApp</td><td style="padding:6px 0"><a href="https://wa.me/${phoneToWaMe(phone)}" style="color:${BLUE};text-decoration:none">${phone}</a></td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${CREAM};font-family:${BODY_STACK};color:${CHARCOAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(14,107,168,0.08)">
<tr><td style="background:${BLUE};padding:20px 24px">
  <p style="margin:0;color:${CREAM};font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Nuevo RSVP Sinergia</p>
</td></tr>
<tr><td style="padding:24px">
  <h2 style="margin:0 0 16px;color:${BLUE};font-size:20px;font-weight:600">${name}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:6px 0;color:${MUTED};width:110px">Email</td><td style="padding:6px 0"><a href="mailto:${email}" style="color:${BLUE};text-decoration:none">${email}</a></td></tr>
    ${phoneRow}
    <tr><td style="padding:6px 0;color:${MUTED}">Sesión</td><td style="padding:6px 0">${dateLabel}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Cena</td><td style="padding:6px 0">${staysForDinner ? "Se queda ✓" : "Solo la práctica"}</td></tr>
    <tr><td style="padding:6px 0;color:${MUTED}">Ocupación</td><td style="padding:6px 0">${totalRegistered} / ${capacity} &middot; quedan ${remaining}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildSinergiaConfirmationEmailHtml({
  name,
  sessionDate,
  staysForDinner,
}: Params): string {
  const dateLabel = formatSessionDateEs(sessionDate);
  const { time, exactAddress, exactAddressMapLink, venueName } = sinergiaConfig;

  const dinnerBlock = staysForDinner
    ? `<tr><td style="padding:0 24px 24px">
        <div style="padding:16px 20px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
          <p style="margin:0 0 8px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:14px;font-weight:600;letter-spacing:0.3px">Te quedás a cenar</p>
          <p style="margin:0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.6">Traé algo simple para sumar a la mesa &mdash; pan, fruta, vino, lo que tengas a mano. No hace falta cocinar.</p>
        </div>
      </td></tr>`
    : "";

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
  <p style="margin:0 0 10px;color:${CREAM};font-family:${SCRIPT_STACK};font-size:22px;font-weight:500;letter-spacing:0.5px">Qué bueno tenerte</p>
  <h1 style="margin:0;color:${CREAM};font-family:${DISPLAY_STACK};font-size:34px;letter-spacing:4px;font-weight:700">SINERGIA</h1>
  <p style="margin:12px 0 0;color:${CREAM};opacity:0.78;font-family:${BODY_STACK};font-size:13px;letter-spacing:1px">Una hora a la semana para volver a vos</p>
</td></tr>

<tr><td style="padding:32px 24px 0;text-align:center">
  <h2 style="margin:0 0 6px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:24px;font-weight:600;letter-spacing:0.3px">Nos vemos, ${name}.</h2>
  <p style="margin:8px 0 0;color:${MUTED};font-family:${BODY_STACK};font-size:15px;line-height:1.6">Te esperamos el miércoles.</p>
</td></tr>

<tr><td style="padding:24px 24px 0"><div style="height:1px;background:${CREAM_DARK}"></div></td></tr>

<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:16px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase">El encuentro</h3>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${BODY_STACK};font-size:14px;color:${CHARCOAL}">
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};width:90px;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Cuándo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right">${dateLabel} &middot; ${time}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Dónde</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid ${CREAM_DARK};text-align:right;line-height:1.5">${venueName}<br>${exactAddress}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:${BLUE};font-family:${DISPLAY_STACK};font-weight:600">Aporte</strong></td>
        <td style="padding:10px 0;text-align:right">A colaboración</td></tr>
  </table>

  <div style="margin-top:24px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:${BODY_STACK};font-size:14px;font-weight:600;padding:13px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.4px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:0 24px 24px">
  <div style="padding:18px 20px;background:${CREAM};border-radius:12px;border:1px solid ${CREAM_DARK}">
    <p style="margin:0 0 10px;color:${BLUE};font-family:${DISPLAY_STACK};font-size:14px;font-weight:600;letter-spacing:0.3px">La forma del encuentro</p>
    <p style="margin:0;color:${MUTED};font-family:${BODY_STACK};font-size:13px;line-height:1.8">
      19:30 &middot; Meditación y pranayama<br>
      20:00 &middot; Lectura o escritura<br>
      20:30 &middot; Compartimos y escuchamos<br>
      21:00 &middot; Cena libre (opcional)
    </p>
  </div>
</td></tr>

${dinnerBlock}

<tr><td style="padding:0 24px 28px;text-align:center">
  <p style="margin:0;color:${ACCENT};font-family:${BODY_STACK};font-size:13px;font-weight:600">&#9728; Te mandamos un recordatorio el miércoles a la mañana.</p>
</td></tr>

<tr><td style="padding:22px 24px 28px;text-align:center;border-top:1px solid ${CREAM_DARK};background:#fdfbf5">
  <p style="margin:0 0 6px;color:${MUTED};font-family:${BODY_STACK};font-size:12px">Sinergia &middot; Hari &amp; Coni &middot; Sky Campus</p>
  <p style="margin:0;color:${MUTED};opacity:0.65;font-family:${BODY_STACK};font-size:11px">harisolaas.com/sinergia</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
