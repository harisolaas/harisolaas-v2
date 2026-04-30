import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { graphFetch } from "./client";
import { readWabaConfig } from "./config";
import { extractVariableNames } from "./hash";
import {
  WabaClientError,
  WabaTemplateNotApprovedError,
  type WabaSendRequest,
  type WabaSendResult,
  type WabaTemplateDefinition,
  type WabaTemplateStatus,
  type WabaTemplateVariables,
} from "./types";

// Send one template message. Mirrors the shape of `Resend#emails.send`
// (one recipient, one call) — the bulk fan-out helper builds on top.

interface MessagesApiResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export async function sendWabaTemplate<
  V extends WabaTemplateVariables = WabaTemplateVariables,
>(req: WabaSendRequest<V>): Promise<WabaSendResult> {
  validateVariables(req.template, req.variables);

  const localStatus = await getLocalTemplateStatus(req.template.name);
  if (localStatus !== "approved") {
    throw new WabaTemplateNotApprovedError(req.template.name, localStatus);
  }

  const config = readWabaConfig();
  const components = buildSendComponents(req);

  const body = {
    messaging_product: "whatsapp",
    to: req.to,
    type: "template",
    template: {
      name: req.template.name,
      language: { code: req.template.language },
      ...(components.length > 0 && { components }),
    },
  };

  const res = await graphFetch<MessagesApiResponse>({
    method: "POST",
    path: `/${config.phoneNumberId}/messages`,
    body,
    config,
  });

  const messageId = res.messages?.[0]?.id;
  if (!messageId) {
    throw new WabaClientError(
      "WABA send: response did not include a message id",
      null,
      null,
      null,
      res,
    );
  }

  // Persist the row as 'sent'. The webhook flips it to delivered/
  // read/failed as Meta reports back. PersonId is best-effort: pass
  // it via the bulk wrapper when known; one-off sends can omit it.
  await db
    .insert(schema.whatsappMessages)
    .values({
      messageId,
      personId: req.personId ?? null,
      templateName: req.template.name,
      languageCode: req.template.language,
      toPhone: req.to,
      variables: req.variables,
      status: "sent",
      campaign: req.campaign ?? null,
      lastStatusAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.whatsappMessages.messageId,
      set: {
        templateName: req.template.name,
        languageCode: req.template.language,
        toPhone: req.to,
        variables: req.variables,
        campaign: req.campaign ?? null,
        updatedAt: sql`NOW()`,
      },
    });

  return { messageId };
}

/**
 * Read the local template status from `whatsapp_templates`. Returns
 * 'unknown' when the row doesn't exist (template was never synced).
 *
 * Exported because both `sendWabaTemplate` (gating) and the bulk
 * sender's pre-flight check need it.
 */
export async function getLocalTemplateStatus(
  templateName: string,
): Promise<WabaTemplateStatus | "unknown"> {
  const row = await db
    .select({ status: schema.whatsappTemplates.status })
    .from(schema.whatsappTemplates)
    .where(eq(schema.whatsappTemplates.name, templateName))
    .limit(1);
  if (row.length === 0) return "unknown";
  return row[0].status as WabaTemplateStatus;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function validateVariables(
  template: WabaTemplateDefinition,
  variables: WabaTemplateVariables,
): void {
  const expected = extractVariableNames(template);
  const missing = expected.filter((k) => !(k in variables));
  if (missing.length > 0) {
    throw new WabaClientError(
      `Missing template variables for "${template.name}": ${missing.join(", ")}`,
      null,
      null,
      null,
      { expected, provided: Object.keys(variables) },
    );
  }
  for (const k of expected) {
    if (typeof variables[k] !== "string" || variables[k].length === 0) {
      throw new WabaClientError(
        `Template variable "${k}" must be a non-empty string`,
        null,
        null,
        null,
        { variables },
      );
    }
  }
}

interface SendComponent {
  type: "header" | "body" | "button";
  sub_type?: "url" | "quick_reply";
  index?: string;
  parameters: Array<{
    type: "text";
    parameter_name?: string;
    text: string;
  }>;
}

function buildSendComponents<V extends WabaTemplateVariables>(
  req: WabaSendRequest<V>,
): SendComponent[] {
  const out: SendComponent[] = [];

  for (const c of req.template.components) {
    if (c.type === "BODY") {
      const params = extractVariableNames({
        ...req.template,
        components: [c],
      });
      if (params.length === 0) continue;
      out.push({
        type: "body",
        parameters: params.map((p) => ({
          type: "text",
          parameter_name: p,
          text: req.variables[p],
        })),
      });
    } else if (c.type === "HEADER" && c.format === "TEXT") {
      const params = extractVariableNames({
        ...req.template,
        components: [c],
      });
      if (params.length === 0) continue;
      out.push({
        type: "header",
        parameters: params.map((p) => ({
          type: "text",
          parameter_name: p,
          text: req.variables[p],
        })),
      });
    }
    // FOOTER is always literal text — no parameters block needed.
    // BUTTONS only need a parameters block when the URL has a runtime
    // variable (URL template buttons). Caller passes urlButtonParams
    // when that's the case.
  }

  if (req.urlButtonParams) {
    for (const b of req.urlButtonParams) {
      out.push({
        type: "button",
        sub_type: "url",
        index: String(b.index),
        parameters: [{ type: "text", text: b.param }],
      });
    }
  }

  return out;
}
