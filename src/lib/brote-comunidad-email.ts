/**
 * The three "Comunidad BROTE" emails — a win-back campaign for everyone who
 * came to BROTE 1 or the planting day and has not bought for BROTE 2.
 *
 * Design note: this is the first BROTE mail written in the landing's
 * "vintage eco-editorial" language (paper, Instrument Serif, hard offset
 * shadow) rather than the older green-header shell in `plant-email.ts`. The
 * click lands on `/brote/invitacion/comunidad`, and a mail that looks nothing
 * like its destination reads as a different sender. The two shells coexist on
 * purpose; unifying them is a separate job.
 *
 * Copy is UTF-8, not HTML entities like the older BROTE templates. The charset
 * meta is set and Sinergia's templates already ship this way — for a file this
 * copy-heavy, `&aacute;` everywhere is a typo waiting to happen.
 *
 * Nothing here retypes a price, a time or a running order: they come from
 * `broteConfig`, `resolveInvitationPrice` and `es.brote`, so this mail cannot
 * contradict the page it is selling. That rule was learned the hard way — see
 * the RUN_OF_SHOW comment in `brote-email.ts`.
 */

import {
  broteConfig,
  currentTicketPrice,
  isEarlyBird,
  regularPriceValidFrom,
} from "@/data/brote";
import {
  collaboratorNameUrl,
  getInvitation,
  resolveInvitationPrice,
} from "@/lib/brote-invitations";
import es from "@/dictionaries/es";

/* ─── palette ─────────────────────────────────────────────────────────────
 * Same tokens as `BroteLanding.tsx` / `BroteInvitacion.tsx`. Duplicated as
 * plain hex because email needs them inline on every element anyway, and the
 * component constants are not exported.
 * ---------------------------------------------------------------------- */
const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const BODY = "#5C6B45";
const FOREST_60 = "#78855E";
const FOREST_30 = "#BBC2A9";

/* ─── type stacks ─────────────────────────────────────────────────────────
 * Outlook desktop strips webfonts, so each stack ends in something of the
 * same *category* as the webfont — serif falls to Georgia, mono to Courier.
 * `sinergia-email.ts` learned this after a mail flipped genre entirely in
 * Outlook, so the fallbacks are chosen rather than inherited.
 *
 * Two families, not the landing's three: Archivo only carries the BROTE
 * wordmark, and the wordmark is set in mono here — `font-stretch: 125%`, the
 * thing that makes it look like the wordmark, has no effect in email, so
 * loading a third font would buy nothing but a request.
 * ---------------------------------------------------------------------- */
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const MONO = "'Space Mono','Courier New',Courier,monospace";

const FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Space+Mono:wght@400;700&display=swap');
</style>`;

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

/* ─── audience shape ──────────────────────────────────────────────────── */

export type ComunidadWave = 1 | 2 | 3;

/** Which past event they came to. Drives the one variable paragraph. */
export type ComunidadSegment = "brote1" | "plant" | "both";

export interface ComunidadRecipient {
  name: string | null;
  cameToBrote1: boolean;
  cameToPlant: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function segmentOf(recipient: {
  cameToBrote1: boolean;
  cameToPlant: boolean;
}): ComunidadSegment {
  if (recipient.cameToBrote1 && recipient.cameToPlant) return "both";
  if (recipient.cameToPlant) return "plant";
  // Everyone in this audience came to at least one of the two, so a recipient
  // with neither flag can only be an audienceOverride address typed by hand.
  // `brote1` is the safe default: it is the copy that assumes the least.
  return "brote1";
}

/**
 * The tracked `/go/` slug per wave, so `/admin/links/<slug>` reports clicks
 * and sales for each send separately. Sales attribute here rather than to
 * `inv-comunidad` — the mail is what sold the ticket, and a real `/go/` link
 * is the more specific fact (same reasoning as `checkout/route.ts`).
 */
export function waveLinkSlug(wave: ComunidadWave): string {
  return `email-comunidad-w${wave}`;
}

export function waveCtaUrl(wave: ComunidadWave): string {
  return `${BASE_URL}/go/${waveLinkSlug(wave)}`;
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

/**
 * The buyer name reaches us from MercadoPago's payer object, so it is
 * uncontrolled input and every use of it is escaped.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * First name, or nothing.
 *
 * `people.name` is not clean: MercadoPago payments that carried no payer name
 * were written as the literal "Asistente" (see
 * `scripts/backfill-asistente-names.ts`), and plantación waitlist rows were
 * seeded with the email address as the name. Greeting someone "Hola,
 * Asistente" is worse than not greeting them at all, so both cases fall
 * through to the no-name variant.
 */
export function firstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.includes("@")) return "";
  const first = trimmed.split(/\s+/)[0] ?? "";
  if (/^asistente$/i.test(first)) return "";
  return first;
}

/** Today's date in Buenos Aires as YYYY-MM-DD, for the "mañana" wording. */
function argentinaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(now);
}

/** "14 de agosto" — the day the regular price takes over, derived not typed. */
function regularPriceFromDisplay(): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(regularPriceValidFrom()));
}

/**
 * The price-rise line, true on whichever day the send actually goes out.
 *
 * Wave 1 is scheduled for the last day of the preventa, where the honest
 * headline is "tomorrow it goes up for everyone but you". If the send slips a
 * day the sentence has to stop saying "mañana" rather than become a lie, so
 * the wording is chosen from `now` instead of being written into the copy.
 */
function priceRiseLine(now: Date): string {
  const regular = broteConfig.ticketPrice;
  const from = regularPriceFromDisplay();

  if (argentinaDate(now) === broteConfig.earlyBirdDeadline) {
    return `Mañana, ${from}, la entrada pasa a ${regular} para todo el mundo. Para vos no: tenés un precio aparte, por haber estado.`;
  }
  if (isEarlyBird(now)) {
    return `El ${from} la entrada pasa a ${regular} para todo el mundo. Para vos no: tenés un precio aparte, por haber estado.`;
  }
  return `Desde el ${from} la entrada está ${regular} para todo el mundo. Para vos no: tenés un precio aparte, por haber estado.`;
}

/**
 * The inbox preview line, on the same clock as `priceRiseLine`.
 *
 * It gets its own function rather than a slice of the body because it was
 * written as a fixed "Mañana la entrada pasa a …" first, and a test caught it
 * still saying "mañana" four days after the preventa had closed. The preheader
 * is the second thing a reader sees; it can be short, but it cannot be false.
 */
function priceRisePreheader(now: Date): string {
  const regular = broteConfig.ticketPrice;
  const from = regularPriceFromDisplay();

  if (argentinaDate(now) === broteConfig.earlyBirdDeadline) {
    return `Mañana la entrada pasa a ${regular}. La tuya no.`;
  }
  if (isEarlyBird(now)) {
    return `El ${from} la entrada pasa a ${regular}. La tuya no.`;
  }
  return `La entrada está ${regular} para todo el mundo. La tuya no.`;
}

/** A collaborator's name, linked, resolved from the registry — never retyped. */
function collaboratorLink(slug: string): string {
  const invitation = getInvitation(slug);
  if (!invitation) return "";
  const href = collaboratorNameUrl(invitation);
  if (!href) return invitation.name;
  return `<a href="${href}" style="color:${FOREST};text-decoration:underline">${invitation.name}</a>`;
}

/** `{bodyBefore}{collaborator}{bodyAfter}` as the dictionary stores it. */
function mentionText(mention: {
  bodyBefore: string;
  slug: string;
  bodyAfter: string;
}): string {
  return `${mention.bodyBefore}${collaboratorLink(mention.slug)}${mention.bodyAfter}`;
}

/* ─── shell ───────────────────────────────────────────────────────────── */

/** The dotted rule that opens and closes every mail: `LABEL ···· BROTE 2026`. */
function ruleRow(left: string, right: string): string {
  const cell = `font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${FOREST_60};white-space:nowrap;vertical-align:middle`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="${cell}">${left}</td>
    <td width="100%" style="padding:0 10px;vertical-align:middle"><div style="border-top:2px dotted ${FOREST_30};font-size:1px;line-height:1px">&nbsp;</div></td>
    <td style="${cell}">${right}</td>
  </tr>
</table>`;
}

/** A full-width dotted divider between sections. */
const DIVIDER = `<tr><td style="padding:26px 0"><div style="border-top:2px dotted ${FOREST_30};font-size:1px;line-height:1px">&nbsp;</div></td></tr>`;

function shellOpen(eyebrow: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
${FONT_HEAD}
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${MONO};color:${BODY}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}">
<tr><td align="center" style="padding:32px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 0 26px">${ruleRow(eyebrow, "BROTE 2026")}</td></tr>`;
}

/**
 * Footer. Carries the opt-out line: this campaign is marketing, not a receipt,
 * and there is no unsubscribe endpoint in the repo — a reply is the honest
 * channel, and it is paired with a `List-Unsubscribe` header on the send side.
 */
const SHELL_CLOSE = `<tr><td style="padding:34px 0 0">${ruleRow("BROTE", "Con Un Árbol")}</td></tr>
<tr><td style="padding:16px 0 0;text-align:center">
  <p style="margin:0 0 6px;font-family:${MONO};font-size:10px;letter-spacing:.12em;color:${FOREST_60}">harisolaas.com/brote</p>
  <p style="margin:0;font-family:${MONO};font-size:10px;line-height:1.6;color:${FOREST_30}">Te escribimos porque estuviste en BROTE o en la plantación.<br>Si no querés recibir estos mails, respondé BAJA y te sacamos.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

/* ─── shared blocks ───────────────────────────────────────────────────── */

function serifHeading(text: string, size = 46): string {
  return `<p style="margin:0;font-family:${SERIF};font-size:${size}px;line-height:1.06;color:${FOREST};font-weight:400">${text}</p>`;
}

/**
 * Body copy is mono, not sans — that is the landing's own choice for running
 * text (`BroteInvitacion.tsx` sets `mono` at 14px/1.9 on its paragraphs), and
 * the line-height is matched to it so the two surfaces share a rhythm.
 */
function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${MONO};font-size:14px;line-height:1.9;color:${BODY}">${text}</p>`;
}

function eyebrowLabel(text: string): string {
  return `<p style="margin:0 0 12px;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${FOREST_60}">${text}</p>`;
}

/**
 * The CTA. A rectangle, not a pill: the landing rounds nothing, and the
 * button is the element a reader compares against the page they land on.
 */
function ctaButton(wave: ComunidadWave, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto">
  <tr><td style="background:${FOREST}">
    <a href="${waveCtaUrl(wave)}" style="display:inline-block;padding:17px 36px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${PAPER};text-decoration:none">${label}</a>
  </td></tr>
</table>`;
}

/**
 * The price block, with the hard offset shadow the landing uses everywhere.
 *
 * `box-shadow` does not survive Outlook, so the shadow is a solid band of
 * `FOREST_30` revealed by padding on the outer cell — right and bottom only,
 * which is the same 12px-no-blur offset the page draws. The landing's -9°
 * strike on the old price has no email equivalent; a plain line-through says
 * the same thing.
 */
function priceCard(now: Date): string {
  const invitation = getInvitation("comunidad");
  const price = resolveInvitationPrice(invitation, now);
  const discount = invitation?.discountPct ?? 0;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:${FOREST_30};padding:0 9px 9px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:1.5px solid ${FOREST}">
      <tr><td style="padding:22px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${FOREST_60}">Tu precio</td>
            <td align="right"><span style="display:inline-block;padding:4px 9px;background:${FOREST};font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.12em;color:${PAPER}">-${discount}%</span></td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:${SERIF};font-size:24px;line-height:1;color:${FOREST_60};text-decoration:line-through">${price.compareAtDisplay ?? broteConfig.ticketPrice}</p>
        <p style="margin:4px 0 0;font-family:${SERIF};font-size:56px;line-height:1;color:${FOREST}">${price.priceDisplay}</p>
        <p style="margin:14px 0 0;font-family:${MONO};font-size:11px;line-height:1.6;color:${FOREST_60}">Es tu precio por haber estado.<br>No está en la web.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/** `JUE 20 AGO · 19:00–22:30 · COSTA RICA 5644` — all of it from config. */
function eventStrip(): string {
  const { final } = es.brote;
  return `<p style="margin:0;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${FOREST_60};line-height:1.9;text-align:center">${final.compactDate} &middot; ${final.compactTime} &middot; ${final.address}, Palermo</p>`;
}

/** "Qué incluye tu entrada", straight out of the landing's dictionary. */
function includesBlock(): string {
  const { items, featured } = es.brote.includes;
  const rows = [...items, featured]
    .map((item) => {
      const body =
        "mention" in item && item.mention
          ? mentionText(item.mention)
          : ("body" in item && item.body) || "";
      return `<tr>
  <td style="padding:0 12px 14px 0;vertical-align:top;width:26px;font-family:${MONO};font-size:11px;font-weight:700;color:${FOREST_30}">${item.number}</td>
  <td style="padding:0 0 14px;vertical-align:top">
    <p style="margin:0 0 3px;font-family:${SERIF};font-size:19px;line-height:1.2;color:${FOREST}">${item.title}</p>
    <p style="margin:0;font-family:${MONO};font-size:12px;line-height:1.65;color:${BODY}">${body}</p>
  </td>
</tr>`;
    })
    .join("\n");

  return `${eyebrowLabel("Tu entrada incluye")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
</table>`;
}

/* ─── wave 1 — "el regalo" ────────────────────────────────────────────── */

/**
 * The one paragraph that makes the mail feel written for this person.
 *
 * Reciprocity is the whole hook of this campaign, and it only works if it
 * names what *they* actually did. A single neutral line ("estuviste en la
 * primera, o metiste las manos en la tierra") reads as a mail merge.
 */
const WAVE1_OPENING: Record<ComunidadSegment, string> = {
  brote1:
    "El 28 de marzo estuviste en la primera. Esa noche no bailaste nomás: se plantaron árboles que hoy están en el suelo, creciendo, con tu nombre entre ellos.",
  plant:
    "El 19 de abril te tomaste el viaje hasta la reserva y plantaste con las manos. Volviste con tierra en las zapatillas y un árbol que sigue ahí.",
  both: "Estuviste en las dos: en la fiesta de marzo y en la reserva de San Miguel, con las manos en la tierra. Sos de la primera camada, de quienes empezaron esto.",
};

function renderWave1(recipient: ComunidadRecipient, now: Date): RenderedEmail {
  const name = firstName(recipient.name);
  const greeting = name
    ? `Tenemos un regalo<br>para vos, ${escapeHtml(name)}.`
    : "Tenemos un regalo<br>para vos.";
  const price = resolveInvitationPrice(getInvitation("comunidad"), now);

  const html = `${shellOpen("Invitación", priceRisePreheader(now))}
<tr><td style="padding:0 0 18px">
  <img src="${BASE_URL}/brote/ilustraciones/brote-arbol-riso.png" alt="" width="88" height="88" style="display:block;border:0;width:88px;height:auto">
</td></tr>

<tr><td style="padding:0 0 14px">${eyebrowLabel("Para vos, que ya viniste")}${serifHeading(greeting)}</td></tr>

<tr><td style="padding:0 0 4px">
  <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:21px;line-height:1.35;color:${FOREST_60}">Vos, que ya le regalaste un bosque a tu país.</p>
</td></tr>

${DIVIDER}

<tr><td>
  ${paragraph(WAVE1_OPENING[segmentOf(recipient)])}
  ${paragraph(`El ${broteConfig.eventDateDisplay.toLowerCase()} hacemos la segunda. Mismo bosque, otra noche.`)}
  ${paragraph(priceRiseLine(now))}
</td></tr>

<tr><td style="padding:12px 0 0">${priceCard(now)}</td></tr>

<tr><td style="padding:30px 0 0">${ctaButton(1, "Quiero mi entrada")}</td></tr>

${DIVIDER}

<tr><td>${includesBlock()}</td></tr>

<tr><td style="padding:14px 0 0">${eventStrip()}</td></tr>

${DIVIDER}

<tr><td>
  <p style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${FOREST}">Volvé. El bosque que empezaste sigue creciendo.</p>
  <p style="margin:0;font-family:${MONO};font-size:11px;line-height:1.7;color:${FOREST_60}">P.D. Si venís con alguien, podés llevar hasta 10 entradas en la misma compra, todas a ${price.priceDisplay}.</p>
</td></tr>
${SHELL_CLOSE}`;

  return { subject: "Un regalo para quien ya plantó un bosque", html };
}

/* ─── wave 2 — "cómo suena" ───────────────────────────────────────────── */

/**
 * Wave 2 sells the night, not the discount.
 *
 * Someone who ignored 35% off does not need 40% off — they need to know what
 * they would be in the room for. The price appears once, near the bottom, as
 * a fact rather than an argument.
 */
const WAVE2_CLOSER: Record<ComunidadSegment, string> = {
  brote1: "Ya sabés cómo termina esto.",
  plant: "La fiesta la conocés de oídas. El jueves la ves.",
  both: "Ya sabés cómo termina esto.",
};

function renderWave2(recipient: ComunidadRecipient, now: Date): RenderedEmail {
  const { lineup } = es.brote;
  const price = resolveInvitationPrice(getInvitation("comunidad"), now);
  const publicPrice = currentTicketPrice(now).display;

  // Times and block names come from the landing's line-up, so the running
  // order in this mail cannot drift from the page — the same guard as
  // RUN_OF_SHOW in `brote-email.ts`, which exists because a day-of mail once
  // contradicted the page people had bought from.
  //
  // The dictionary stores both halves in one string ("19:00 · Llegada"); the
  // clock becomes the eyebrow and the name becomes the heading. Only the
  // arrival body is written here: the dictionary's version says "si venís
  // solo/a", which the repo's gender-agnostic rule does not allow in new copy.
  const blocks = [
    {
      time: lineup.welcome.time,
      body: "Algo para comer, algo para tomar y una hora entera para conocerse. Si venís por tu cuenta, estamos en la puerta: te presentamos gente.",
    },
    { time: lineup.live.time, body: mentionText(lineup.live.mention) },
    { time: lineup.dj.time, body: mentionText(lineup.dj.mention) },
  ]
    .map((block) => {
      const [clock, label] = block.time.split("·").map((part) => part.trim());
      return `<tr>
  <td style="padding:0 0 22px">
    <p style="margin:0 0 4px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.18em;color:${FOREST_60}">${clock}</p>
    <p style="margin:0 0 6px;font-family:${SERIF};font-size:24px;line-height:1.15;color:${FOREST}">${label}</p>
    <p style="margin:0;font-family:${MONO};font-size:13px;line-height:1.8;color:${BODY}">${block.body}</p>
  </td>
</tr>`;
    })
    .join("\n");

  const html = `${shellOpen("Line up", "Guitarra y voz, sin nada en el medio. Después entra Gian.")}
<tr><td style="padding:0 0 22px">${serifHeading("Cómo va a sonar<br>el jueves.")}</td></tr>

<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${blocks}
  </table>
</td></tr>

${DIVIDER}

<tr><td>
  <p style="margin:0 0 14px;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.3;color:${FOREST}">${WAVE2_CLOSER[segmentOf(recipient)]}</p>
  ${paragraph(`Tu precio sigue en <strong style="color:${FOREST}">${price.priceDisplay}</strong>. El resto está pagando ${publicPrice}.`)}
</td></tr>

<tr><td style="padding:16px 0 0">${ctaButton(2, "Quiero mi entrada")}</td></tr>

<tr><td style="padding:30px 0 0">${eventStrip()}</td></tr>
${SHELL_CLOSE}`;

  return { subject: "El jueves, a las 20, toca José", html };
}

/* ─── wave 3 — "mañana" ───────────────────────────────────────────────── */

/**
 * Last call, and deliberately soft at the end.
 *
 * No scarcity claim: there is no capacity cap enforced at checkout, so "se
 * agota" would be a number we cannot stand behind. `expectedAttendees` is a
 * fact and does the same work. And a list of people who already gave money and
 * a Sunday afternoon gets an exit line, not a squeeze.
 */
function renderWave3(recipient: ComunidadRecipient, now: Date): RenderedEmail {
  const name = firstName(recipient.name);
  const price = resolveInvitationPrice(getInvitation("comunidad"), now);
  // No segment variant here on purpose: the closing line is true for both
  // halves of the audience — everyone in it has a tree in the ground.
  const closer =
    "Y si no llegás, no pasa nada: el árbol que plantaste sigue creciendo igual. Nos vemos en la próxima.";

  const html = `${shellOpen("Mañana", `Jueves 19:00, ${broteConfig.locationAddress}. Tu entrada sigue en ${price.priceDisplay}.`)}
<tr><td style="padding:0 0 22px">${serifHeading(name ? `Mañana, ${escapeHtml(name)}.` : "Mañana.", 58)}</td></tr>

<tr><td>
  ${paragraph(`${broteConfig.eventDateDisplay}, ${broteConfig.eventTime}, ${broteConfig.locationAddress}. Somos alrededor de ${broteConfig.expectedAttendees} personas en una casa de Palermo. Mañana a esta hora ya estamos ahí.`)}
  ${paragraph("Si lo venías pensando, es hoy.")}
</td></tr>

<tr><td style="padding:18px 0 0">${ctaButton(3, `Quiero mi entrada — ${price.priceDisplay}`)}</td></tr>

${DIVIDER}

<tr><td>
  <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:20px;line-height:1.4;color:${FOREST_60}">${closer}</p>
</td></tr>
${SHELL_CLOSE}`;

  return { subject: "Mañana es BROTE", html };
}

/* ─── entry point ─────────────────────────────────────────────────────── */

/**
 * `now` is injected so the price-rise wording and the invitation price are
 * testable at any point on the calendar — the same reason every helper in
 * `src/data/brote.ts` takes it.
 */
export function renderComunidadEmail(
  wave: ComunidadWave,
  recipient: ComunidadRecipient,
  now: Date = new Date(),
): RenderedEmail {
  switch (wave) {
    case 1:
      return renderWave1(recipient, now);
    case 2:
      return renderWave2(recipient, now);
    case 3:
      return renderWave3(recipient, now);
  }
}
