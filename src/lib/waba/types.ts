// Shared types for the WABA (WhatsApp Business API) integration.
//
// Templates are defined in code under `src/lib/waba/templates/` and
// mirrored in the `whatsapp_templates` table once submitted to Meta.
// Send call sites build a `WabaSendRequest` against an APPROVED
// template; the client refuses to send anything else.

export type WabaTemplateCategory =
  | "utility"
  | "marketing"
  | "authentication";

// Mirrors Meta's `status` enum, plus the local-only `draft` state we
// use before a template has ever been submitted.
export type WabaTemplateStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled"
  | "in_appeal"
  | "flagged"
  | "locked"
  | "pending_deletion";

export type WabaQualityScore = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

// ---------------------------------------------------------------
// Template definition (the artifact submitted to Meta)
// ---------------------------------------------------------------

// We use NAMED parameters everywhere — readable in the source
// and unambiguous in the send payload.
export interface NamedParam {
  param_name: string;
  example: string;
}

export interface WabaBodyComponent {
  type: "BODY";
  text: string;
  example?: { body_text_named_params: NamedParam[] };
}

export interface WabaHeaderTextComponent {
  type: "HEADER";
  format: "TEXT";
  text: string;
  example?: { header_text_named_params: NamedParam[] };
}

export interface WabaFooterComponent {
  type: "FOOTER";
  text: string;
}

export type WabaButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

export interface WabaButtonsComponent {
  type: "BUTTONS";
  buttons: WabaButton[];
}

export type WabaComponent =
  | WabaBodyComponent
  | WabaHeaderTextComponent
  | WabaFooterComponent
  | WabaButtonsComponent;

// What lives in `src/lib/waba/templates/*.ts`.
export interface WabaTemplateDefinition {
  name: string;
  category: WabaTemplateCategory;
  // BCP-47 / Meta language code, e.g. "es_AR", "en", "es".
  language: string;
  components: WabaComponent[];
}

// ---------------------------------------------------------------
// Send-time payload
// ---------------------------------------------------------------

// Variables are stringified at the call site — keeping the type
// narrow makes accidental object/number params surface as type
// errors before they hit Meta (which would 400 anyway).
export type WabaTemplateVariables = Record<string, string>;

export interface WabaSendRequest<
  V extends WabaTemplateVariables = WabaTemplateVariables,
> {
  // E.164 digits-only (no leading +), e.g. "5491122555110".
  // Use `phoneToWaMe(...)` from src/lib/plant-types.ts to produce this.
  to: string;
  template: WabaTemplateDefinition;
  variables: V;
  // Optional URL button parameters keyed by index — only for templates
  // that declare URL buttons with a runtime variable in the URL.
  urlButtonParams?: Array<{ index: number; param: string }>;
  // Optional grouping label persisted on the message row, e.g.
  // "sinergia-reminder-2026-05-06" or "broadcast-2026-05-01".
  campaign?: string;
  // Optional foreign key into `people`. Set when the recipient is a
  // known person — the row in `whatsapp_messages` then joins back so
  // admin views can show "messages sent to Ana".
  personId?: number | null;
}

export interface WabaSendResult {
  // Meta's `wamid.HBg...` id. Persisted as the PK in whatsapp_messages.
  messageId: string;
}

// ---------------------------------------------------------------
// Errors
// ---------------------------------------------------------------

// Thrown by client functions when a Graph call fails. Callers in
// loop senders should catch and convert to a per-recipient failure
// rather than aborting the whole batch.
export class WabaClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly metaErrorCode: string | null,
    public readonly metaErrorSubcode: string | null,
    public readonly raw: unknown,
  ) {
    super(message);
    this.name = "WabaClientError";
  }
}

// Thrown when the caller asks to send a template whose local row is
// not in 'approved' state. Surfacing this early (before the Graph
// call) keeps the failure obvious and avoids a useless API call.
export class WabaTemplateNotApprovedError extends Error {
  constructor(
    public readonly templateName: string,
    public readonly status: WabaTemplateStatus | "unknown",
  ) {
    super(
      `Template "${templateName}" is not approved (status: ${status}). ` +
        `Run /api/admin/waba/templates/sync and wait for Meta approval.`,
    );
    this.name = "WabaTemplateNotApprovedError";
  }
}
