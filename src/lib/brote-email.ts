import type { BroteTicket } from "./brote-types";

export function buildTicketEmailHtml(
  ticket: BroteTicket,
  qrDataUrl: string,
): string {
  const isTicket = ticket.type === "ticket";
  const heading = isTicket
    ? "Tu entrada para BROTE"
    : "Gracias por sumarte a la plantacion";
  const subtitle = isTicket
    ? "Sabado 28 de marzo · 14 a 19h · Palermo, Buenos Aires"
    : "Tu donacion planta un arbol real en Buenos Aires";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">

<!-- Header -->
<tr><td style="background:#2D4A3E;padding:32px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:28px;letter-spacing:2px">BROTE</h1>
  <p style="margin:8px 0 0;color:#FAF6F1;opacity:0.7;font-size:14px">La fiesta que deja raices</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 24px">
  <h2 style="margin:0 0 8px;color:#2D4A3E;font-size:22px">${heading}</h2>
  <p style="margin:0 0 24px;color:#666;font-size:14px">${subtitle}</p>

  <!-- QR Code -->
  <div style="text-align:center;padding:24px;background:#FAF6F1;border-radius:12px;margin-bottom:24px">
    <img src="${qrDataUrl}" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto"/>
    <p style="margin:12px 0 0;color:#2D4A3E;font-size:12px;font-weight:600;letter-spacing:1px">${ticket.id}</p>
  </div>

  <!-- Details -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Nombre</strong></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${ticket.buyerName}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Tipo</strong></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${isTicket ? "Entrada" : "Donacion (arbol)"}</td></tr>
    ${isTicket ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Fecha</strong></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">Sabado 28 de marzo, 14–19h</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Lugar</strong></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">Costa Rica 5644, Palermo</td></tr>` : ""}
  </table>

  ${isTicket ? `<p style="margin:24px 0 0;padding:16px;background:#FAF6F1;border-radius:8px;color:#2D4A3E;font-size:13px;text-align:center">
    Mostra este QR en la puerta para ingresar.
  </p>` : `<p style="margin:24px 0 0;padding:16px;background:#FAF6F1;border-radius:8px;color:#2D4A3E;font-size:13px;text-align:center">
    Gracias por ser parte. Tu arbol va a crecer mucho despues de que termine la musica.
  </p>`}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px;text-align:center;border-top:1px solid #eee">
  <p style="margin:0;color:#999;font-size:12px">BROTE · Sky Campus · El Arte de Vivir</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
