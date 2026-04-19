import { plantConfig } from "@/data/brote";

const FOOTER_HTML = `<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE &middot; Un &Aacute;rbol &middot; El Arte de Vivir</p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>`;

function shellOpen(subtitle: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:36px;letter-spacing:3px;font-weight:700">BROTE</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">${subtitle}</p>
</td></tr>`;
}

const SHELL_CLOSE = `${FOOTER_HTML}</table></td></tr></table></body></html>`;

/* ─── Plant invite — Email 1 (reverse-psychology) ─── */
export function buildPlantInvite1Html(): string {
  const ctaUrl =
    "https://harisolaas.com/es/brote?utm_source=email&utm_medium=brote_buyers&utm_campaign=plantacion_email1";
  return `${shellOpen("El segundo movimiento", "En serio, mejor seguí con tu domingo. Pero si lo abriste, ya fuiste.")}
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:20px 0 0;color:#2D4A3E;font-size:26px;font-weight:700;line-height:1.2">Ya fuiste. Abriste el mail.</h2>
</td></tr>

<tr><td style="padding:24px 28px 0">
  <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.65">Ya compraste tu entrada para la fiesta del 28 de marzo. Plantaste con tu donaci&oacute;n y la pasaste hermoso. Ahora llega el segundo movimiento: el <strong style="color:#2D4A3E">domingo 19 de abril a las 14:30</strong> nos encontramos en una reserva natural en San Miguel con Un &Aacute;rbol a meter las manos en la tierra y cerrar el ciclo.</p>
  <p style="margin:0;color:#444;font-size:15px;line-height:1.65">No es jornada de trabajo. Es tarde de domingo: meditaci&oacute;n guiada, plantaci&oacute;n simb&oacute;lica, food trucks en la reserva y sobremesa con la comunidad. Gratis, pero son 40 lugares y la direcci&oacute;n exacta la mandamos por mail solo a los que est&aacute;n anotados.</p>
</td></tr>

<tr><td style="padding:24px 28px 0">
  <div style="padding:14px 20px;background:#FAF6F1;border-radius:12px;text-align:center">
    <p style="margin:0;color:#2D4A3E;font-size:13px;font-weight:600">Domingo 19 de abril &middot; desde las 14:30 &middot; Reserva en San Miguel &middot; Gratis con cupo</p>
  </div>
</td></tr>

<tr><td style="padding:28px 28px 0;text-align:center">
  <a href="${ctaUrl}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Reserv&aacute; tu pala 🌱</a>
</td></tr>

<tr><td style="padding:24px 28px 28px;text-align:center">
  <p style="margin:0;color:#888;font-size:13px;font-style:italic">Nos vemos el 19 con las manos listas.</p>
</td></tr>

${SHELL_CLOSE}`;
}

/* ─── Plant invite — Email 2 (straight, scarcity) ─── */
export function buildPlantInvite2Html(remaining?: number): string {
  const ctaUrl =
    "https://harisolaas.com/es/brote?utm_source=email&utm_medium=brote_buyers&utm_campaign=plantacion_email2";
  const seatsLine =
    typeof remaining === "number"
      ? `Quedan <strong style="color:#C4704B">${remaining}</strong> de 40 lugares.`
      : "Son 40 lugares.";
  return `${shellOpen("El segundo movimiento", "Gratis, con cupo, y la dirección va por mail.")}
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:20px 0 0;color:#2D4A3E;font-size:26px;font-weight:700;line-height:1.2">El 19 plantamos lo que BROTE hizo brotar.</h2>
</td></tr>

<tr><td style="padding:24px 28px 0">
  <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.65">La fiesta del 28 de marzo financi&oacute; &aacute;rboles nativos que Un &Aacute;rbol va a plantar por todo el pa&iacute;s. El <strong style="color:#2D4A3E">domingo 19 de abril</strong> vamos a una reserva en San Miguel a plantar una parte juntos, con las manos, en una tarde de meditaci&oacute;n, food trucks y sobremesa. Arrancamos 14:30 y la reserva queda abierta hasta las 19 &mdash; te qued&aacute;s lo que quieras.</p>
  <p style="margin:0;color:#444;font-size:15px;line-height:1.65">Los primeros lugares se los llevaron quienes vinieron a la fiesta. Si quer&eacute;s cerrar el ciclo con nosotros, anotate &mdash; ${seatsLine} La direcci&oacute;n la mandamos por mail solo a quienes est&aacute;n en la lista.</p>
</td></tr>

<tr><td style="padding:24px 28px 0">
  <div style="padding:14px 20px;background:#FAF6F1;border-radius:12px;text-align:center">
    <p style="margin:0;color:#2D4A3E;font-size:13px;font-weight:600">Domingo 19 de abril &middot; desde las 14:30 &middot; Reserva en San Miguel &middot; Gratis con cupo</p>
  </div>
</td></tr>

<tr><td style="padding:28px 28px 0;text-align:center">
  <a href="${ctaUrl}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Reserv&aacute; tu pala 🌱</a>
</td></tr>

<tr><td style="padding:24px 28px 28px;text-align:center">
  <p style="margin:0;color:#888;font-size:13px;font-style:italic">Te esperamos.</p>
</td></tr>

${SHELL_CLOSE}`;
}

/* ─── Day-of reminder for confirmed plant registrants ─── */
export function buildPlantReminderEmailHtml(
  name: string,
  waUrl: string,
): string {
  const { exactAddress, exactAddressMapLink } = plantConfig;
  const firstName = name.trim().split(/\s+/)[0] || name;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">Hoy plantamos. 14:30 en la Reserva El Corredor, San Miguel.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<!-- Header -->
<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:36px;letter-spacing:3px;font-weight:700">BROTE</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">Hoy plantamos</p>
</td></tr>

<!-- Hero -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:20px 0 0;color:#2D4A3E;font-size:26px;font-weight:700;line-height:1.2">Llegó el d&iacute;a, ${firstName}.</h2>
</td></tr>

<tr><td style="padding:20px 28px 0">
  <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.65">Hoy <strong style="color:#2D4A3E">domingo 19 de abril a las 14:30</strong> nos encontramos en la Reserva Natural Urbana El Corredor, junto con Un &Aacute;rbol, la Municipalidad de San Miguel y la Fundaci&oacute;n Vida Silvestre. Va a estar lindo &mdash; lleg&aacute; con tiempo y qued&aacute;te lo que puedas.</p>
  <p style="margin:0;color:#444;font-size:15px;line-height:1.65"><strong style="color:#2D4A3E">Cuando llegues:</strong> acercate a la cuadrilla de Un &Aacute;rbol (van a estar identificados) o busc&aacute;me a m&iacute; directamente. Desde ah&iacute; te sumamos a todo.</p>
</td></tr>

<!-- Schedule -->
<tr><td style="padding:24px 28px 0">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 12px;color:#2D4A3E;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">Cronograma</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#444">
      <tr><td style="padding:4px 0;width:70px;color:#2D4A3E;font-weight:600">15:15</td><td style="padding:4px 0">Bienvenida</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">15:30</td><td style="padding:4px 0">Plantaci&oacute;n de especies nativas</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">16:00</td><td style="padding:4px 0">Actividades para chicos</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">16:30</td><td style="padding:4px 0">Limpieza del r&iacute;o &middot; Safari de bichos</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">16:45</td><td style="padding:4px 0">Segunda plantaci&oacute;n</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">17:40</td><td style="padding:4px 0">Show de circo</td></tr>
      <tr><td style="padding:4px 0;color:#2D4A3E;font-weight:600">18:10</td><td style="padding:4px 0">Sorteos &middot; Cierre con fog&oacute;n</td></tr>
    </table>
    <p style="margin:12px 0 0;color:#666;font-size:12px;line-height:1.5">Durante toda la jornada: kits, stand de Vida Silvestre, patio de comidas y feria de emprendedores.</p>
  </div>
</td></tr>

<!-- Address CTA -->
<tr><td style="padding:24px 28px 0">
  <p style="margin:0 0 6px;color:#2D4A3E;font-size:13px;font-weight:600">D&oacute;nde</p>
  <p style="margin:0 0 14px;color:#666;font-size:13px;line-height:1.5">${exactAddress}</p>
  <div style="text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:#2D4A3E;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Abrir en Google Maps</a>
  </div>
</td></tr>

<!-- What to bring -->
<tr><td style="padding:20px 28px 0">
  <div style="padding:14px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 6px;color:#2D4A3E;font-size:13px;font-weight:600">Qu&eacute; llevar</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.55">Ropa que no te importe ensuciar &middot; Zapatillas cerradas &middot; Gorra &middot; Agua &middot; Guantes de jard&iacute;n si ten&eacute;s &middot; Plata o tarjeta para el patio de comidas</p>
  </div>
</td></tr>

<!-- WhatsApp CTA -->
<tr><td style="padding:24px 28px 0;text-align:center">
  <p style="margin:0 0 12px;color:#444;font-size:14px;line-height:1.55">&iquest;Dudas, se te complic&oacute; algo o necesit&aacute;s coordinar para llegar?</p>
  <a href="${waUrl}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Escrib&iacute;me por WhatsApp</a>
</td></tr>

<tr><td style="padding:24px 28px 28px;text-align:center">
  <p style="margin:0;color:#888;font-size:13px;font-style:italic">Nos vemos en la reserva. 🌳</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE &middot; Un &Aacute;rbol &middot; El Arte de Vivir</p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildPlantConfirmationEmailHtml(name: string): string {
  const { eventDateDisplay, eventTime, exactAddress, exactAddressMapLink } =
    plantConfig;

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
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">El segundo movimiento</p>
</td></tr>

<!-- Main message -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:16px 0 4px;color:#2D4A3E;font-size:24px;font-weight:700">Listo, ${name}.</h2>
  <p style="margin:8px 0 0;color:#666;font-size:15px;line-height:1.6">Est&aacute;s en la lista para el 19. La fiesta plant&oacute; &aacute;rboles en una planilla; ahora nos encontramos a meter las manos en la tierra con Un &Aacute;rbol.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<!-- Event details -->
<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px">Detalles del evento</h3>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:90px;vertical-align:top"><strong style="color:#2D4A3E">Fecha</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${eventDateDisplay}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top"><strong style="color:#2D4A3E">Horario</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${eventTime}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top"><strong style="color:#2D4A3E">Lugar</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;line-height:1.5">${exactAddress}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:#2D4A3E">Costo</strong></td>
        <td style="padding:10px 0;text-align:right">Gratis (con cupo)</td></tr>
  </table>

  <div style="margin-top:20px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Abrir en Google Maps</a>
  </div>
</td></tr>

<!-- What to bring -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">Qu&eacute; llevar</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Ropa que no te importe ensuciar &middot; Zapatillas cerradas &middot; Gorra &middot; Agua &middot; Si ten&eacute;s guantes de jard&iacute;n, mejor</p>
  </div>
</td></tr>

<!-- How to get there -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">C&oacute;mo llegar</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Tren San Mart&iacute;n hasta Bella Vista &middot; En auto ~1h desde Capital por Acceso Norte. Hay food trucks en la reserva &mdash; llev&aacute; plata o tarjeta si quer&eacute;s comer algo.</p>
  </div>
</td></tr>

<!-- What to expect -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">Qu&eacute; va a pasar esa tarde</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Meditaci&oacute;n guiada, plantaci&oacute;n simb&oacute;lica con Un &Aacute;rbol y sobremesa con la comunidad. No es jornada de trabajo &mdash; es tarde de domingo.</p>
  </div>
</td></tr>

<!-- Rain notice -->
<tr><td style="padding:0 24px 24px;text-align:center">
  <p style="margin:0;color:#2D4A3E;font-size:13px;font-weight:600">&#9748; Si llueve reprogramamos &mdash; te avisamos por mail con 24h de anticipaci&oacute;n.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE &middot; Un &Aacute;rbol &middot; El Arte de Vivir</p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
