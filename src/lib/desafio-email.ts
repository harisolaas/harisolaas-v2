import { desafioConfig, formatDayDate, type DesafioLocale } from "@/data/desafio";
import { phoneToWaMe } from "@/lib/plant-types";

// Site palette (warm & earthy), not Sinergia's. Serif headings fall back
// to Georgia — no webfont head needed for a transactional mail.
const CREAM = "#FAF6F1";
const FOREST = "#2D4A3E";
const TERRACOTTA = "#C4704B";
const CHARCOAL = "#2C2C2C";
const SAGE = "#A8B5A0";
const MUTED = "#6B6B6B";

const SERIF = `'DM Serif Display', Georgia, 'Times New Roman', serif`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
}

// Unlike the Sinergia templates, every user-supplied value is escaped.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Email copy lives here (like sinergia-email.ts), not in the dictionaries.
const COPY = {
  es: {
    subject: "Ya tenés tu lugar en el desafío de 15 días",
    kicker: "Qué bueno tenerte",
    heading: "Hola, {name}.",
    body1:
      "El desafío arranca el {date}. Cada día se abre una práctica corta, de unos 15 minutos, en esta página:",
    button: "Ir al desafío",
    body2:
      "Guardala en favoritos: ahí vas a encontrar la práctica de cada día. Si arrancás más tarde, no pasa nada: los días anteriores quedan abiertos.",
    body3:
      "También te vamos a escribir por WhatsApp para acompañarte en el camino.",
    group: "Sumarme al grupo de WhatsApp",
  },
  en: {
    subject: "You're in — the 15-day meditation challenge",
    kicker: "So glad you're here",
    heading: "Hi, {name}.",
    body1:
      "The challenge starts on {date}. Each day a short practice, about 15 minutes, opens on this page:",
    button: "Go to the challenge",
    body2:
      "Bookmark it — that's where each day's practice lives. If you start late, no problem: earlier days stay open.",
    body3: "We'll also reach out on WhatsApp to keep you company along the way.",
    group: "Join the WhatsApp group",
  },
} as const;

const FOOTER = "Desafío 15 días · Hari Solaas · harisolaas.com/desafio";

export function desafioConfirmationSubject(locale: DesafioLocale): string {
  return COPY[locale].subject;
}

function button(href: string, label: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:${color};border-radius:999px">
  <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;color:${CREAM};font-family:${SANS};font-size:15px;font-weight:600;text-decoration:none">${label}</a>
</td></tr></table>`;
}

interface ConfirmationParams {
  name: string;
  locale: DesafioLocale;
  startDate: string;
}

export function buildDesafioConfirmationEmailHtml({
  name,
  locale,
  startDate,
}: ConfirmationParams): string {
  const c = COPY[locale];
  const date = formatDayDate(startDate, locale);
  const landing = `${baseUrl()}/${locale}/desafio`;
  const groupUrl = desafioConfig.whatsappGroupUrl;
  const p = (text: string) =>
    `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${CHARCOAL}">${text}</p>`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:${CREAM};color:${CHARCOAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid ${SAGE}">
<tr><td style="padding:32px 28px">
  <p style="margin:0 0 8px;font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${TERRACOTTA}">${c.kicker}</p>
  <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:28px;font-weight:400;line-height:1.2;color:${FOREST}">${c.heading.replace("{name}", escapeHtml(name))}</h1>
  ${p(c.body1.replace("{date}", date))}
  ${button(landing, c.button, FOREST)}
  ${p(c.body2)}
  ${p(c.body3)}
  ${groupUrl ? button(groupUrl, c.group, TERRACOTTA) : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${SAGE}">
  <p style="margin:0;font-family:${SANS};font-size:12px;color:${MUTED}">${FOOTER}</p>
</td></tr>
</table>
</body>
</html>`;
}

interface HostNotifyParams {
  name: string;
  email: string;
  phone: string;
  locale: DesafioLocale;
  totalRegistered: number;
}

/** Internal, Spanish only. Layout cloned from buildSinergiaHostNotificationHtml. */
export function buildDesafioHostNotificationHtml({
  name,
  email,
  phone,
  locale,
  totalRegistered,
}: HostNotifyParams): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:${MUTED};width:110px">${label}</td><td style="padding:6px 0">${value}</td></tr>`;
  const link = (href: string, text: string) =>
    `<a href="${escapeHtml(href)}" style="color:${TERRACOTTA};text-decoration:none">${escapeHtml(text)}</a>`;
  const phoneRow = phone
    ? row("WhatsApp", link(`https://wa.me/${phoneToWaMe(phone)}`, phone))
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:${CREAM};font-family:${SANS};color:${CHARCOAL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(45,74,62,0.08)">
<tr><td style="background:${FOREST};padding:20px 24px">
  <p style="margin:0;color:${CREAM};font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Nueva inscripción · Desafío 15 días</p>
</td></tr>
<tr><td style="padding:24px">
  <h2 style="margin:0 0 16px;color:${FOREST};font-family:${SERIF};font-size:20px;font-weight:400">${escapeHtml(name)}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${CHARCOAL}">
    ${row("Email", link(`mailto:${email}`, email))}
    ${phoneRow}
    ${row("Idioma", locale)}
    ${row("Inscripciones", String(totalRegistered))}
  </table>
</td></tr>
</table>
</body>
</html>`;
}
