import { Resend } from "resend";
import type { BulkEmailFailure, BulkEmailWarning } from "./bulk-email";

// Override via ADMIN_ALERT_EMAIL env var. Fallback preserves the current
// behavior for the existing production deployment; forks should set the env.
const DEFAULT_ADMIN_EMAIL = "h.solaas1@gmail.com";

export interface CampaignAlertInput {
  campaign: string; // e.g. "plant-day-of-reminder-2026-04-19"
  audienceSize: number;
  sent: number;
  skipped: number;
  failed: BulkEmailFailure[];
  warnings?: BulkEmailWarning[];
  // Optional extras surfaced in the body so the runbook has context.
  note?: string;
}

/**
 * Email the admin when a bulk campaign ends with failures, warnings, or a
 * reconciliation gap.
 *
 * Called at the end of every cron-driven send so that a silent Resend error
 * (e.g. rate limit, domain issue) never goes unnoticed again — see
 * docs/ops/mass-email-sends.md. Best-effort: never throws, so campaign routes
 * can fire it without extra try/catch and the caller's response still reflects
 * the underlying send result.
 */
export async function notifyAdminOfCampaign(
  input: CampaignAlertInput,
): Promise<{ notified: boolean; reason?: string }> {
  const warnings = input.warnings ?? [];
  // Reconciliation gap: every recipient should land in exactly one bucket
  // (sent, skipped, or failed). `gap > 0` means the helper lost track of
  // someone — a real bug, distinct from explicit API failures.
  const gap = input.audienceSize - input.sent - input.skipped - input.failed.length;
  const hasFailures = input.failed.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasGap = gap > 0;

  if (!hasFailures && !hasWarnings && !hasGap) {
    return { notified: false, reason: "no failures, no warnings, no gap" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("notifyAdminOfCampaign: RESEND_API_KEY missing");
    return { notified: false, reason: "RESEND_API_KEY missing" };
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL || DEFAULT_ADMIN_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
  const resend = new Resend(apiKey);
  const subjectBits: string[] = [];
  if (hasFailures) subjectBits.push(`${input.failed.length} fallos`);
  if (hasWarnings) subjectBits.push(`${warnings.length} warnings`);
  if (hasGap) subjectBits.push(`${gap} sin cuenta`);
  const subject = `[alerta] ${input.campaign}: ${subjectBits.join(", ")}`;

  try {
    const result = await resend.emails.send({
      from: `Harisolaas alerts <${from}>`,
      to: adminEmail,
      subject,
      html: buildAlertHtml(input, warnings, gap),
    });
    if (result.error) {
      console.error(
        `notifyAdminOfCampaign: Resend returned error — ${result.error.name}: ${result.error.message}`,
      );
      return { notified: false, reason: result.error.name };
    }
    return { notified: true };
  } catch (err) {
    console.error("notifyAdminOfCampaign threw:", err);
    return {
      notified: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildAlertHtml(
  input: CampaignAlertInput,
  warnings: BulkEmailWarning[],
  gap: number,
): string {
  const failedRows = input.failed
    .slice(0, 50)
    .map(
      (f) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(f.email)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(f.error.name)}${
          f.error.statusCode ? ` (${f.error.statusCode})` : ""
        }</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666">${escapeHtml(f.error.message)}</td></tr>`,
    )
    .join("");
  const extraFailed =
    input.failed.length > 50
      ? `<p style="color:#888;font-size:12px">…y ${input.failed.length - 50} más. Ver logs de Vercel.</p>`
      : "";

  const warningRows = warnings
    .slice(0, 50)
    .map(
      (w) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(w.email)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666">${escapeHtml(w.reason)}</td></tr>`,
    )
    .join("");
  const extraWarnings =
    warnings.length > 50
      ? `<p style="color:#888;font-size:12px">…y ${warnings.length - 50} más. Ver logs de Vercel.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif;color:#2C2C2C">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
  <h1 style="margin:0 0 8px;font-size:20px;color:#2D4A3E">Campaign: ${escapeHtml(input.campaign)}</h1>
  <p style="margin:0 0 20px;color:#666;font-size:13px">Un envío masivo terminó con incidencias. Revisalas abajo y seguí el runbook en <code>docs/ops/mass-email-sends.md</code>.</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
    <tr><td style="padding:4px 12px 4px 0;color:#888">Audiencia</td><td><strong>${input.audienceSize}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Enviados</td><td><strong>${input.sent}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Skipped (ya enviados)</td><td>${input.skipped}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Fallos de envío</td><td style="color:${input.failed.length > 0 ? "#C4704B" : "#2D4A3E"}"><strong>${input.failed.length}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Warnings (entregados, flag sin setear)</td><td style="color:${warnings.length > 0 ? "#C4704B" : "#2D4A3E"}"><strong>${warnings.length}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Gap de reconciliación</td><td style="color:${gap > 0 ? "#C4704B" : "#2D4A3E"}"><strong>${gap}</strong></td></tr>
  </table>
  ${input.note ? `<p style="margin:0 0 16px;color:#444;font-size:13px">${escapeHtml(input.note)}</p>` : ""}
  ${
    input.failed.length > 0
      ? `<h2 style="margin:20px 0 8px;font-size:15px;color:#2D4A3E">Fallos de envío</h2>
         <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
           <thead><tr style="background:#F5EFE7"><th style="padding:6px 8px;text-align:left">Email</th><th style="padding:6px 8px;text-align:left">Error</th><th style="padding:6px 8px;text-align:left">Mensaje</th></tr></thead>
           <tbody>${failedRows}</tbody>
         </table>${extraFailed}`
      : ""
  }
  ${
    warnings.length > 0
      ? `<h2 style="margin:20px 0 8px;font-size:15px;color:#2D4A3E">Warnings post-entrega</h2>
         <p style="color:#666;font-size:12px;margin:0 0 8px">Estos recipients recibieron el email pero el flag de idempotencia no se seteó. <strong>No borres flags ni hagas retry a ciegas</strong> — se duplicaría el envío. Seteá el flag manualmente si querés evitar el reenvío en la próxima corrida.</p>
         <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
           <thead><tr style="background:#F5EFE7"><th style="padding:6px 8px;text-align:left">Email</th><th style="padding:6px 8px;text-align:left">Detalle</th></tr></thead>
           <tbody>${warningRows}</tbody>
         </table>${extraWarnings}`
      : ""
  }
  ${
    gap > 0
      ? `<p style="color:#C4704B;font-size:13px"><strong>Gap ${gap}</strong>: hay recipients que no terminaron en ninguna categoría. Revisá los logs del cron; puede ser un bug en el helper.</p>`
      : ""
  }
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
