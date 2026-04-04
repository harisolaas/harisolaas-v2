import { plantConfig } from "@/data/brote";

export function buildPlantConfirmationEmailHtml(name: string): string {
  const { eventDateDisplay, exactAddress, exactAddressMapLink } = plantConfig;

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
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:14px;letter-spacing:1px">Plantaci&oacute;n de &aacute;rboles</p>
</td></tr>

<!-- Main message -->
<tr><td style="padding:32px 24px 0;text-align:center">
  <div style="display:inline-block;background:#2D4A3E;border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;text-align:center">🌱</div>
  <h2 style="margin:16px 0 4px;color:#2D4A3E;font-size:24px;font-weight:700">&iexcl;Te esperamos, ${name}!</h2>
  <p style="margin:8px 0 0;color:#666;font-size:15px;line-height:1.6">Est&aacute;s anotado/a para la plantaci&oacute;n colectiva de &aacute;rboles. 100 &aacute;rboles nacieron en BROTE y ahora los vamos a plantar juntos.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<!-- Event details -->
<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px">Detalles del evento</h3>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Fecha</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${eventDateDisplay}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><strong style="color:#2D4A3E">Direcci&oacute;n</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right"><a href="${exactAddressMapLink}" style="color:#C4704B;text-decoration:underline">${exactAddress}</a></td></tr>
    <tr><td style="padding:10px 0"><strong style="color:#2D4A3E">Costo</strong></td>
        <td style="padding:10px 0;text-align:right">Gratuito</td></tr>
  </table>
</td></tr>

<!-- What to bring -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">Qu&eacute; llevar</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Ropa c&oacute;moda &middot; Protector solar &middot; Agua &middot; Gorra o sombrero &middot; Zapatillas que se puedan ensuciar</p>
  </div>
</td></tr>

<!-- How to get there -->
<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">C&oacute;mo llegar</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Tren San Mart&iacute;n hasta San Miguel + corta distancia. En auto ~1h desde Capital por Acceso Norte.</p>
    <p style="margin:8px 0 0"><a href="${exactAddressMapLink}" style="color:#C4704B;font-size:13px;font-weight:600;text-decoration:underline">Ver en Google Maps &rarr;</a></p>
  </div>
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
