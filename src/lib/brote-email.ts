import { artOfLivingInstagram, broteConfig } from "@/data/brote";
import { collaboratorNameUrl, getInvitation } from "@/lib/brote-invitations";
import es from "@/dictionaries/es";

// Start hour derived from eventTime ("19:00 a 22:30" → "19") for day-of copy.
const startHour = broteConfig.eventTime.split(":")[0];

/**
 * The run of show, taken from the landing rather than retyped.
 *
 * The line-up blocks carry their time as `"20:00 · En vivo"`; only the clock
 * part is wanted here. This mail used to hardcode 19:45 and 21:30 against the
 * landing's 20:00 and 21:15 — so on the morning of the event every buyer would
 * have been told the music starts fifteen minutes before the page they bought
 * from says it does. Deriving both from `es.brote.lineup` means changing the
 * running order is one edit, and the two surfaces cannot disagree again.
 *
 * The tree moment has no line-up block of its own (it is a short beat before
 * the closing set), so it is the one time still written here.
 */
const clock = (blockTime: string) => blockTime.split("·")[0].trim();

const RUN_OF_SHOW = {
  doors: clock(es.brote.lineup.welcome.time),
  live: clock(es.brote.lineup.live.time),
  trees: "21:00",
  dj: clock(es.brote.lineup.dj.time),
};

/**
 * A collaborator's name as a link, for the email templates.
 *
 * Same registry the landing reads, so a handle corrected in one place is
 * corrected in the mail too. Everything interpolated is a repo constant —
 * these builders have no `escapeHtml` (see `tasks/lessons.md`), so nothing
 * user-supplied may be routed through here.
 */
function collaboratorLink(slug: string, color = "#2D4A3E"): string {
  const invitation = getInvitation(slug);
  if (!invitation) return "";

  const href = collaboratorNameUrl(invitation);
  if (!href) return invitation.name;

  return `<a href="${href}" style="color:${color};text-decoration:underline">${invitation.name}</a>`;
}

export function buildReminderEmailHtml(treesRemaining: number): string {
  const buyUrl = "https://www.harisolaas.com/es/brote";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<!-- Header -->
<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:36px;letter-spacing:3px;font-weight:700">BROTE</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">Fiesta de reforestaci&oacute;n</p>
</td></tr>

<!-- Main message -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:16px 0 4px;color:#2D4A3E;font-size:24px;font-weight:700">&iexcl;Hoy es el d&iacute;a!</h2>
  <p style="margin:8px 0 0;color:#666;font-size:15px;line-height:1.6">Te esperamos hoy a las <strong style="color:#2D4A3E">${startHour}h</strong> en Costa Rica 5644, Palermo.</p>
  <p style="margin:8px 0 0;color:#666;font-size:15px;line-height:1.6">No te olvides de llevar tu QR &mdash; est&aacute; en el mail que recibiste cuando compraste tu entrada.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<!-- Lineup -->
<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px;text-align:center">Lineup de la noche</h3>
  <!-- Los horarios salen de la landing (RUN_OF_SHOW), que es lo que la persona
       vio cuando compró. Antes decían 19:45 y 21:30 contra los 20:00 y 21:15 de
       la landing, o sea que este mail contradecía la página de venta el día
       mismo del evento. Si el orden real cambia, se cambia en el diccionario y
       las dos superficies se mueven juntas. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:60px;vertical-align:top"><strong style="color:#C4704B">${RUN_OF_SHOW.doors}</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">&#127869; Apertura y catering</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top"><strong style="color:#C4704B">${RUN_OF_SHOW.live}</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">&#127925; Ac&uacute;stico en vivo &mdash; ${collaboratorLink("jose")}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top"><strong style="color:#C4704B">${RUN_OF_SHOW.trees}</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">&#127795; Momento ${collaboratorLink("unarbol")}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:#C4704B">${RUN_OF_SHOW.dj}</strong></td>
        <td style="padding:10px 0">&#128131; Experiencia de baile &mdash; ${collaboratorLink("gian")}</td></tr>
  </table>
</td></tr>

<!-- Trees remaining CTA -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:20px;background:#FAF6F1;border-radius:12px;text-align:center">
    <p style="margin:0 0 4px;color:#2D4A3E;font-size:22px;font-weight:700">Faltan ${treesRemaining} &aacute;rboles para llegar a ${broteConfig.expectedAttendees}</p>
    <p style="margin:8px 0 16px;color:#666;font-size:14px;line-height:1.5">Si ten&eacute;s amigos que quieran venir, todav&iacute;a hay lugar. Cada entrada nueva es un &aacute;rbol m&aacute;s para el bosque.</p>
    <a href="${buyUrl}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.5px">Compart&iacute; con un amigo</a>
  </div>
</td></tr>

<!-- Rain notice -->
<tr><td style="padding:0 24px 24px;text-align:center">
  <p style="margin:0;color:#2D4A3E;font-size:14px;font-weight:600">&#9748; No se suspende por lluvia</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE &middot; <a href="${artOfLivingInstagram}" style="color:#aaa;text-decoration:underline">El Arte de Vivir</a></p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Extract raw base64 content from a data URL for use as an email attachment */
export function qrDataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

/** One ticket as the email renders it. `guestName` is optional (U5). */
export interface TicketForEmail {
  ticketId: string;
  treeNumber: number;
  guestName?: string;
}

/**
 * Escape anything user-supplied before it reaches the HTML.
 *
 * The buyer name arrives from MercadoPago's payer object and from the
 * /brote/success contact step; guest names are typed by the buyer outright.
 * `tasks/lessons.md` records that these builders interpolate unescaped —
 * this closes it for the ticket mail, which is the one that now carries two
 * uncontrolled strings per ticket.
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
 * `cid` for the Nth attachment. The FIRST stays `qr` rather than becoming
 * `qr1`: hundreds of one-ticket emails already went out referencing `cid:qr`,
 * and renaming it would change the single-ticket HTML for no benefit. Pinned
 * by the golden fixture in `brote-email.test.ts`.
 */
export function qrContentId(index: number): string {
  return index === 0 ? "qr" : `qr${index + 1}`;
}

export function buildTicketEmailHtml(
  tickets: TicketForEmail[],
  buyerName: string,
): string {
  const many = tickets.length > 1;

  // Heading over the tree illustration. Singular keeps the exact copy that
  // shipped; plural names the count so three QRs below don't read as a bug.
  const treeHeading = many
    ? `${tickets.length} &aacute;rboles`
    : `&Aacute;rbol #${tickets[0].treeNumber}`;

  const treeBlurb = many
    ? `Cada entrada planta un &aacute;rbol real. Ya tienen n&uacute;mero (#${tickets[0].treeNumber} a #${tickets[tickets.length - 1].treeNumber}) y van a crecer mucho despu&eacute;s de que termine la m&uacute;sica.`
    : `Cada entrada planta un &aacute;rbol real. El tuyo ya tiene n&uacute;mero y va a crecer mucho despu&eacute;s de que termine la m&uacute;sica.`;

  // One QR block per ticket. For a single ticket this has to render exactly
  // as it did before — the golden fixture asserts byte equality.
  const qrBlocks = tickets
    .map((ticket, i) => {
      const label = many
        ? `\n    <p style="margin:0 0 10px;color:#888;font-size:12px;letter-spacing:1px">ENTRADA ${i + 1} DE ${tickets.length}${ticket.guestName ? ` &middot; ${escapeHtml(ticket.guestName)}` : ""} &middot; &Aacute;rbol #${ticket.treeNumber}</p>`
        : ticket.guestName
          ? `\n    <p style="margin:0 0 10px;color:#888;font-size:12px;letter-spacing:1px">${escapeHtml(ticket.guestName)}</p>`
          : "";
      return `  <div style="text-align:center;padding:24px;background:#FAF6F1;border-radius:12px;margin-bottom:20px">${label}
    <img src="cid:${qrContentId(i)}" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto"/>
    <p style="margin:12px 0 0;color:#2D4A3E;font-size:13px;font-weight:700;letter-spacing:1.5px">${ticket.ticketId}</p>
  </div>`;
    })
    .join("\n\n");

  const forwardNote = many
    ? `
  <div style="margin:0 0 20px;padding:14px 16px;background:#FAF6F1;border-radius:8px;text-align:center">
    <p style="margin:0;color:#2D4A3E;font-size:13px">Reenvi&aacute; una a cada persona, o mostralas todas desde tu tel&eacute;fono en la puerta.</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<!-- Header -->
<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:36px;letter-spacing:3px;font-weight:700">BROTE</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">Fiesta de reforestaci&oacute;n</p>
</td></tr>

<!-- Tree highlight -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:16px 0 4px;color:#2D4A3E;font-size:26px;font-weight:700">${treeHeading}</h2>
  <p style="margin:0;color:#C4704B;font-size:15px;font-weight:600">${many ? "van" : "va"} a echar ra&iacute;ces en Argentina gracias a vos</p>
  <p style="margin:12px 0 0;color:#888;font-size:13px;line-height:1.5">${treeBlurb}</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<!-- Ticket info -->
<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px">${many ? `Tus ${tickets.length} entradas` : "Tu entrada"}</h3>
${forwardNote}
  <!-- QR Code -->
${qrBlocks}

  <!-- Details -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Nombre</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${escapeHtml(buyerName)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Fecha</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${broteConfig.eventDateDisplay}, ${broteConfig.eventTime}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Lugar</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">Costa Rica 5644, Palermo</td></tr>
  </table>

  <div style="margin:20px 0 0;padding:14px 16px;background:#FAF6F1;border-radius:8px;text-align:center">
    <p style="margin:0;color:#2D4A3E;font-size:13px">Mostr&aacute; este QR en la puerta para ingresar.</p>
  </div>
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
}
