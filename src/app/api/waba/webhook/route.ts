import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { readWabaWebhookSecrets } from "@/lib/waba/config";
import {
  normalizeMetaCategory,
  normalizeMetaStatus,
} from "@/lib/waba/template-api";
import type { WabaQualityScore } from "@/lib/waba/types";

// Single endpoint for every WABA webhook field we subscribe to:
//   - `messages`                          (delivery status + inbound)
//   - `message_template_status_update`   (approved / rejected / paused / disabled)
//   - `message_template_quality_update`  (GREEN / YELLOW / RED)
//   - `template_category_update`         (auto-promotion UTILITY → MARKETING)
//
// Inbound messages (the `messages` field with a `messages[]` array) are
// accepted and ignored in v1 — outbound-only scope per the architecture
// plan. We never 4xx Meta on them; doing so tanks our quality score.

const ADMIN_ALERT_FROM_FALLBACK = "hola@harisolaas.com";
const ADMIN_ALERT_TO_FALLBACK = "h.solaas1@gmail.com";

// ---------------------------------------------------------------
// GET — Meta verification handshake
// ---------------------------------------------------------------

export async function GET(req: Request) {
  let secrets;
  try {
    secrets = readWabaWebhookSecrets();
  } catch {
    // Don't expose missing-config detail to Meta — just refuse.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === secrets.webhookVerifyToken &&
    challenge !== null
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------
// POST — event delivery
// ---------------------------------------------------------------

export async function POST(req: Request) {
  let secrets;
  try {
    secrets = readWabaWebhookSecrets();
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rawBody = await req.text();
  if (!verifyMetaSignature(req, rawBody, secrets.appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WabaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Process changes async-but-awaited so we still hit the <250ms
  // budget at this volume; if throughput ever grows enough that
  // serial processing risks the timeout, push the body into Redis
  // and ack 200 immediately.
  try {
    await handlePayload(payload);
  } catch (err) {
    // Don't surface 5xx on a partial failure — Meta would retry the
    // whole batch (up to 7 days) and re-trigger anything that already
    // succeeded. Log + 200, then sweep partial state by re-running
    // sync if needed.
    console.error("WABA webhook handler error (returning 200 to avoid retry storm):", err);
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------

function verifyMetaSignature(
  req: Request,
  rawBody: string,
  appSecret: string,
): boolean {
  const header = req.headers.get("x-hub-signature-256");
  if (!header || !header.startsWith("sha256=")) {
    console.warn("WABA webhook missing or malformed signature header");
    return false;
  }
  const provided = header.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Payload handling
// ---------------------------------------------------------------

interface WabaWebhookPayload {
  object?: string;
  entry?: WabaWebhookEntry[];
}

interface WabaWebhookEntry {
  id: string;
  changes?: WabaWebhookChange[];
}

interface WabaWebhookChange {
  field: string;
  value: Record<string, unknown>;
}

async function handlePayload(payload: WabaWebhookPayload): Promise<void> {
  if (!payload.entry) return;
  for (const entry of payload.entry) {
    if (!entry.changes) continue;
    for (const change of entry.changes) {
      await handleChange(change);
    }
  }
}

async function handleChange(change: WabaWebhookChange): Promise<void> {
  const field = change.field;
  const value = change.value;

  if (field === "messages") {
    await handleMessagesField(value);
    return;
  }

  if (field === "message_template_status_update") {
    await handleTemplateStatusUpdate(value);
    return;
  }

  if (field === "message_template_quality_update") {
    await handleTemplateQualityUpdate(value);
    return;
  }

  if (field === "template_category_update") {
    await handleTemplateCategoryUpdate(value);
    return;
  }

  // Unknown / unsubscribed field — log once at debug volume and move on.
  console.log("WABA webhook: ignoring field", field);
}

// --- messages (status + inbound) ---

interface MessagesValue {
  statuses?: Array<{
    id: string;
    status: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }>;
  messages?: Array<{ id: string }>; // inbound — ignored in v1
}

async function handleMessagesField(value: Record<string, unknown>): Promise<void> {
  const v = value as unknown as MessagesValue;

  if (v.statuses) {
    for (const s of v.statuses) {
      const dedupeKey = `whatsapp:status:${s.id}:${s.status}`;
      const isFresh = await acquireDedupeLock(dedupeKey);
      if (!isFresh) continue;

      const normalized = normalizeMessageStatus(s.status);
      const errorCode = s.errors?.[0]?.code != null ? String(s.errors[0].code) : null;
      const errorMessage = s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null;

      await db
        .update(schema.whatsappMessages)
        .set({
          status: normalized,
          errorCode,
          errorMessage,
          lastStatusAt: new Date(),
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.whatsappMessages.messageId, s.id));
    }
  }

  // Inbound messages are explicitly ignored in v1 — accept and drop.
  // Don't 4xx; Meta would retry and tank quality score.
}

function normalizeMessageStatus(raw: string): "sent" | "delivered" | "read" | "failed" {
  switch (raw.toLowerCase()) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "sent";
  }
}

// --- template lifecycle events ---

interface TemplateStatusUpdateValue {
  event: string;
  message_template_id: number | string;
  message_template_name: string;
  message_template_language?: string;
  reason?: string | null;
}

async function handleTemplateStatusUpdate(
  value: Record<string, unknown>,
): Promise<void> {
  const v = value as unknown as TemplateStatusUpdateValue;
  const status = normalizeMetaStatus(v.event);
  const dedupeKey = `whatsapp:tpl-status:${v.message_template_id}:${v.event}`;
  if (!(await acquireDedupeLock(dedupeKey))) return;

  await db
    .update(schema.whatsappTemplates)
    .set({
      status,
      rejectionReason: status === "rejected" ? v.reason ?? null : null,
      lastStatusAt: new Date(),
      metaTemplateId: String(v.message_template_id),
      updatedAt: sql`NOW()`,
    })
    .where(eq(schema.whatsappTemplates.name, v.message_template_name));

  if (status === "rejected" || status === "paused" || status === "disabled") {
    void notifyAdminOfTemplateEvent({
      templateName: v.message_template_name,
      event: v.event,
      reason: v.reason ?? null,
    });
  }
}

interface TemplateQualityUpdateValue {
  message_template_id: number | string;
  message_template_name: string;
  previous_quality_score?: WabaQualityScore;
  new_quality_score?: WabaQualityScore;
}

async function handleTemplateQualityUpdate(
  value: Record<string, unknown>,
): Promise<void> {
  const v = value as unknown as TemplateQualityUpdateValue;
  if (!v.new_quality_score) return;
  const dedupeKey = `whatsapp:tpl-quality:${v.message_template_id}:${v.new_quality_score}:${Date.now()}`;
  // Use a coarse window for quality updates — same score firing
  // twice in quick succession is unusual but harmless to record.
  if (!(await acquireDedupeLock(dedupeKey, 10))) return;

  await db
    .update(schema.whatsappTemplates)
    .set({
      qualityScore: v.new_quality_score,
      lastStatusAt: new Date(),
      updatedAt: sql`NOW()`,
    })
    .where(eq(schema.whatsappTemplates.name, v.message_template_name));

  if (v.new_quality_score === "RED" || v.new_quality_score === "YELLOW") {
    void notifyAdminOfTemplateEvent({
      templateName: v.message_template_name,
      event: `quality:${v.new_quality_score}`,
      reason: `Previous: ${v.previous_quality_score ?? "UNKNOWN"}`,
    });
  }
}

interface TemplateCategoryUpdateValue {
  message_template_id: number | string;
  message_template_name: string;
  previous_category?: string;
  new_category?: string;
  correct_category?: string;
}

async function handleTemplateCategoryUpdate(
  value: Record<string, unknown>,
): Promise<void> {
  const v = value as unknown as TemplateCategoryUpdateValue;
  const newCategory = v.new_category ?? v.correct_category;
  if (!newCategory) return;
  const dedupeKey = `whatsapp:tpl-cat:${v.message_template_id}:${newCategory}`;
  if (!(await acquireDedupeLock(dedupeKey))) return;

  await db
    .update(schema.whatsappTemplates)
    .set({
      category: normalizeMetaCategory(newCategory),
      lastStatusAt: new Date(),
      updatedAt: sql`NOW()`,
    })
    .where(eq(schema.whatsappTemplates.name, v.message_template_name));

  void notifyAdminOfTemplateEvent({
    templateName: v.message_template_name,
    event: `category:${newCategory}`,
    reason: `Previous: ${v.previous_category ?? "UNKNOWN"}`,
  });
}

// ---------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------

async function acquireDedupeLock(
  key: string,
  ttlDays = 8,
): Promise<boolean> {
  // Meta retries failed webhooks for up to 7 days, so the dedupe
  // window has to outlive that. 8 days gives a small safety margin.
  const redis = await getRedis();
  const existing = await redis.get(key);
  if (existing) return false;
  await redis.set(key, "1", { EX: ttlDays * 24 * 60 * 60 });
  return true;
}

// ---------------------------------------------------------------
// Admin notification
// ---------------------------------------------------------------

async function notifyAdminOfTemplateEvent(input: {
  templateName: string;
  event: string;
  reason: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const from = process.env.RESEND_FROM_EMAIL || ADMIN_ALERT_FROM_FALLBACK;
    const to = process.env.ADMIN_ALERT_EMAIL || ADMIN_ALERT_TO_FALLBACK;
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `Harisolaas alerts <${from}>`,
      to,
      subject: `[waba] ${input.templateName}: ${input.event}`,
      html: `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;background:#FAF6F1;color:#2C2C2C">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
          <h1 style="font-size:18px;color:#2D4A3E;margin:0 0 12px">Template event: ${escapeHtml(input.templateName)}</h1>
          <p style="margin:0 0 8px"><strong>Event:</strong> ${escapeHtml(input.event)}</p>
          ${input.reason ? `<p style="margin:0 0 8px;color:#666"><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>` : ""}
          <p style="margin:16px 0 0;color:#666;font-size:13px">Edit the local definition in <code>src/lib/waba/templates/</code> and POST <code>{action: "resubmit", name: "${escapeHtml(input.templateName)}"}</code> to <code>/api/admin/waba/templates</code>.</p>
        </div>
      </body></html>`,
    });
  } catch (err) {
    console.error("WABA template alert email failed:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
