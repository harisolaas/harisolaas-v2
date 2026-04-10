export function buildMagicLinkEmailHtml(loginUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

<tr><td style="background:#2D4A3E;padding:32px 24px;text-align:center">
  <h1 style="margin:0;color:#FAF6F1;font-size:28px;letter-spacing:2px;font-weight:700">BROTE Admin</h1>
</td></tr>

<tr><td style="padding:32px 28px;text-align:center">
  <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6">Hac&eacute; clic en el bot&oacute;n para entrar al dashboard.</p>
  <a href="${loginUrl}" style="display:inline-block;background:#C4704B;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">Entrar al admin</a>
  <p style="margin:24px 0 0;color:#aaa;font-size:12px">Este link expira en 10 minutos y solo se puede usar una vez.</p>
</td></tr>

<tr><td style="padding:16px 24px 24px;text-align:center;border-top:1px solid #f0f0f0">
  <p style="margin:0;color:#ccc;font-size:11px">harisolaas.com</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
