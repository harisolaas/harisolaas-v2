import type { BroteTicket } from "./brote-types";

/** Extract raw base64 content from a data URL for use as an email attachment */
export function qrDataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export function buildTicketEmailHtml(
  ticket: BroteTicket,
  treeNumber: number,
): string {
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
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">La fiesta que deja raices</p>
</td></tr>

<!-- Tree highlight -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:16px 0 4px;color:#2D4A3E;font-size:26px;font-weight:700">Arbol #${treeNumber}</h2>
  <p style="margin:0;color:#C4704B;font-size:15px;font-weight:600">va a echar raices en Argentina gracias a vos</p>
  <p style="margin:12px 0 0;color:#888;font-size:13px;line-height:1.5">Cada entrada planta un arbol real. El tuyo ya tiene numero y va a crecer mucho despues de que termine la musica.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<!-- Ticket info -->
<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px">Tu entrada</h3>

  <!-- QR Code -->
  <div style="text-align:center;padding:24px;background:#FAF6F1;border-radius:12px;margin-bottom:20px">
    <img src="cid:qr" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto"/>
    <p style="margin:12px 0 0;color:#2D4A3E;font-size:13px;font-weight:700;letter-spacing:1.5px">${ticket.id}</p>
  </div>

  <!-- Details -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Nombre</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${ticket.buyerName}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Fecha</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">Sabado 28 de marzo, 14–19h</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Lugar</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">Costa Rica 5644, Palermo</td></tr>
  </table>

  <div style="margin:20px 0 0;padding:14px 16px;background:#FAF6F1;border-radius:8px;text-align:center">
    <p style="margin:0;color:#2D4A3E;font-size:13px">Mostra este QR en la puerta para ingresar.</p>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">BROTE · Sky Campus · El Arte de Vivir</p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/brote</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
