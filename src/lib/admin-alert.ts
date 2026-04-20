import { Resend } from "resend";
import type { BulkEmailFailure } from "./bulk-email";

const ADMIN_EMAIL = "h.solaas1@gmail.com";

export interface CampaignAlertInput {
  campaign: string; // e.g. "plant-day-of-reminder-2026-04-19"
  audienceSize: number;
  sent: number;
  skipped: number;
  failed: BulkEmailFailure[];
  // Optional extras surfaced in the body so the runbook has context.
  note?: string;
}

/**
 * Email the admin when a bulk campaign ends with failures or partial delivery.
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
  const undelivered = input.audienceSize - input.sent - input.skipped;
  const hasFailures = input.failed.length > 0;
  const partialDelivery = undelivered > 0;

  if (!hasFailures && !partialDelivery) {
    return { notified: false, reason: "no failures, no partial delivery" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("notifyAdminOfCampaign: RESEND_API_KEY missing");
    return { notified: false, reason: "RESEND_API_KEY missing" };
  }

  const from = process.env.RESEND_FROM_EMAIL || "hola@harisolaas.com";
  const resend = new Resend(apiKey);
  const subject = `[alerta] ${input.campaign}: ${input.failed.length} fallos, ${undelivered} sin entregar`;

  try {
    const result = await resend.emails.send({
      from: `Harisolaas alerts <${from}>`,
      to: ADMIN_EMAIL,
      subject,
      html: buildAlertHtml(input, undelivered),
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

function buildAlertHtml(input: CampaignAlertInput, undelivered: number): string {
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

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#FAF6F1;font-family:system-ui,-apple-system,sans-serif;color:#2C2C2C">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
  <h1 style="margin:0 0 8px;font-size:20px;color:#2D4A3E">Campaign: ${escapeHtml(input.campaign)}</h1>
  <p style="margin:0 0 20px;color:#666;font-size:13px">Un envío masivo terminó con incidencias. Revisalas abajo y seguí el runbook en <code>docs/ops/mass-email-sends.md</code>.</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
    <tr><td style="padding:4px 12px 4px 0;color:#888">Audiencia</td><td><strong>${input.audienceSize}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Enviados</td><td><strong>${input.sent}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Skipped (ya enviados)</td><td>${input.skipped}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Fallos registrados</td><td style="color:#C4704B"><strong>${input.failed.length}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#888">Sin entregar (gap)</td><td style="color:${undelivered > 0 ? "#C4704B" : "#2D4A3E"}"><strong>${undelivered}</strong></td></tr>
  </table>
  ${input.note ? `<p style="margin:0 0 16px;color:#444;font-size:13px">${escapeHtml(input.note)}</p>` : ""}
  ${
    input.failed.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
           <thead><tr style="background:#F5EFE7"><th style="padding:6px 8px;text-align:left">Email</th><th style="padding:6px 8px;text-align:left">Error</th><th style="padding:6px 8px;text-align:left">Mensaje</th></tr></thead>
           <tbody>${failedRows}</tbody>
         </table>${extraFailed}`
      : `<p style="color:#666">No hay fallos explícitos, pero faltan ${undelivered} por entregar. Revisá los logs del cron.</p>`
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
