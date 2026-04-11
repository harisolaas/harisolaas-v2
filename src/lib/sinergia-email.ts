import { sinergiaConfig } from "@/data/sinergia";
import { formatSessionDateEs } from "@/lib/sinergia-types";

interface Params {
  name: string;
  sessionDate: string;
  staysForDinner: boolean;
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
        <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
          <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">Te quedás a cenar</p>
          <p style="margin:0;color:#666;font-size:13px;line-height:1.6">Tra&eacute; algo simple para sumar a la mesa &mdash; pan, fruta, vino, lo que tengas a mano. No hace falta cocinar.</p>
        </div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<tr><td style="background:#2D4A3E;padding:40px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:32px;letter-spacing:3px;font-weight:700">SINERGIA</h1>
  <p style="margin:10px 0 0;color:#A8B5A0;font-size:13px;letter-spacing:1px">Un mi&eacute;rcoles por semana, volv&eacute;s a vos</p>
</td></tr>

<tr><td style="padding:32px 24px 0;text-align:center">
  <h2 style="margin:0 0 6px;color:#2D4A3E;font-size:24px;font-weight:700">Qu&eacute; bueno tenerte, ${name}.</h2>
  <p style="margin:8px 0 0;color:#666;font-size:15px;line-height:1.6">Te esperamos el mi&eacute;rcoles en la mesa.</p>
</td></tr>

<tr><td style="padding:24px 24px 0"><div style="height:1px;background:#eee"></div></td></tr>

<tr><td style="padding:24px">
  <h3 style="margin:0 0 16px;color:#2D4A3E;font-size:18px">El encuentro</h3>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#444">
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:90px;vertical-align:top"><strong style="color:#2D4A3E">Cu&aacute;ndo</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">${dateLabel} &middot; ${time}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top"><strong style="color:#2D4A3E">D&oacute;nde</strong></td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;line-height:1.5">${venueName}<br>${exactAddress}</td></tr>
    <tr><td style="padding:10px 0;vertical-align:top"><strong style="color:#2D4A3E">Aporte</strong></td>
        <td style="padding:10px 0;text-align:right">A colaboraci&oacute;n</td></tr>
  </table>

  <div style="margin-top:20px;text-align:center">
    <a href="${exactAddressMapLink}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Abrir en Google Maps</a>
  </div>
</td></tr>

<tr><td style="padding:0 24px 24px">
  <div style="padding:16px 20px;background:#FAF6F1;border-radius:12px">
    <p style="margin:0 0 8px;color:#2D4A3E;font-size:14px;font-weight:600">La forma del encuentro</p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.6">
      19:30 &middot; Meditaci&oacute;n y pranayama<br>
      20:00 &middot; Lectura o escritura<br>
      20:30 &middot; Compartimos y escuchamos<br>
      21:00 &middot; Cena libre (opcional)
    </p>
  </div>
</td></tr>

${dinnerBlock}

<tr><td style="padding:0 24px 24px;text-align:center">
  <p style="margin:0;color:#2D4A3E;font-size:13px;font-weight:600">&#9728; Te mandamos un recordatorio el mi&eacute;rcoles a la ma&ntilde;ana.</p>
</td></tr>

<tr><td style="padding:20px 24px 28px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0 0 4px;color:#aaa;font-size:12px">Sinergia &middot; Hari &amp; Coni &middot; Sky Campus</p>
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com/sinergia</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
