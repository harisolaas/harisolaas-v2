import { graphFetch } from "./client";
import { extractVariableNames } from "./hash";
import type {
  WabaQualityScore,
  WabaTemplateCategory,
  WabaTemplateDefinition,
  WabaTemplateStatus,
} from "./types";
import { readWabaConfig } from "./config";

// Wrappers around Meta's template-management API. Higher-level sync
// + reconciliation logic lives in `sync.ts`; these are pure HTTP.

// What Meta returns from GET /{WABA_ID}/message_templates and from
// POST /{WABA_ID}/message_templates (subset — we only persist what
// the sync flow consumes).
export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string; // upper-case Meta enum, normalize before comparing
  category: string;
  components?: unknown;
  quality_score?: { score?: WabaQualityScore } | null;
  rejected_reason?: string | null;
}

export interface MetaTemplateListResponse {
  data: MetaTemplate[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

export async function listMetaTemplates(): Promise<MetaTemplate[]> {
  const config = readWabaConfig();
  const all: MetaTemplate[] = [];
  let after: string | undefined;

  // Paginate. The list is small enough for this site's volume that
  // we always fetch the full set rather than a partial view.
  for (let i = 0; i < 20; i++) {
    const res = await graphFetch<MetaTemplateListResponse>({
      method: "GET",
      path: `/${config.businessAccountId}/message_templates`,
      query: {
        fields:
          "id,name,language,status,category,components,quality_score,rejected_reason",
        limit: 100,
        ...(after && { after }),
      },
      config,
    });
    all.push(...(res.data ?? []));
    after = res.paging?.cursors?.after;
    if (!after) break;
  }

  return all;
}

export interface SubmitTemplateResult {
  id: string;
  status: string; // PENDING / APPROVED / REJECTED depending on Meta
  category: string;
}

/**
 * Submit a brand-new template to Meta for review.
 *
 * Use this when there's no existing `meta_template_id` for `def.name`.
 * For an existing template that just had its body edited locally,
 * call `editTemplate(metaTemplateId, def)` instead — Meta keeps the
 * id stable across edits and forces a re-review on each change.
 */
export async function submitTemplate(
  def: WabaTemplateDefinition,
): Promise<SubmitTemplateResult> {
  const config = readWabaConfig();
  const body = buildSubmitBody(def);
  return graphFetch<SubmitTemplateResult>({
    method: "POST",
    path: `/${config.businessAccountId}/message_templates`,
    body,
    config,
  });
}

/**
 * Edit an existing template by Meta id. Triggers a re-review.
 *
 * Approved templates: max 10 edits / 30d, or 1 / 24h. Rejected and
 * paused templates: unlimited. Cannot change the category of an
 * APPROVED template — only category-edits on REJECTED are accepted.
 */
export async function editTemplate(
  metaTemplateId: string,
  def: WabaTemplateDefinition,
): Promise<{ success: boolean }> {
  const config = readWabaConfig();
  // Meta's edit endpoint accepts a subset of the create payload.
  // `name`/`language` are immutable; we only ever push components +
  // (for REJECTED templates) a corrected category.
  const body = {
    components: def.components,
    parameter_format: "NAMED",
    category: def.category.toUpperCase(),
  };
  return graphFetch<{ success: boolean }>({
    method: "POST",
    path: `/${metaTemplateId}`,
    body,
    config,
  });
}

/**
 * Delete a template by name. After delete, the name is locked for
 * 30 days — re-creating immediately will fail. Be intentional.
 */
export async function deleteTemplate(
  name: string,
): Promise<{ success: boolean }> {
  const config = readWabaConfig();
  return graphFetch<{ success: boolean }>({
    method: "DELETE",
    path: `/${config.businessAccountId}/message_templates`,
    query: { name },
    config,
  });
}

function buildSubmitBody(def: WabaTemplateDefinition) {
  return {
    name: def.name,
    language: def.language,
    category: def.category.toUpperCase(),
    parameter_format: "NAMED",
    components: def.components,
  };
}

// ---------------------------------------------------------------
// Status / category normalization between Meta + our local enum
// ---------------------------------------------------------------

const META_STATUS_MAP: Record<string, WabaTemplateStatus> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAUSED: "paused",
  DISABLED: "disabled",
  IN_APPEAL: "in_appeal",
  FLAGGED: "flagged",
  LOCKED: "locked",
  PENDING_DELETION: "pending_deletion",
};

export function normalizeMetaStatus(raw: string): WabaTemplateStatus {
  const upper = raw.toUpperCase();
  return META_STATUS_MAP[upper] ?? "pending";
}

export function normalizeMetaCategory(raw: string): WabaTemplateCategory {
  const lower = raw.toLowerCase();
  if (lower === "utility" || lower === "marketing" || lower === "authentication") {
    return lower;
  }
  return "utility";
}

export function variableNamesFor(def: WabaTemplateDefinition): string[] {
  return extractVariableNames(def);
}
