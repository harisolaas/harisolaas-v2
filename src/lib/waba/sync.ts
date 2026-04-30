import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { extractVariableNames, hashTemplateDefinition } from "./hash";
import {
  editTemplate,
  listMetaTemplates,
  normalizeMetaCategory,
  normalizeMetaStatus,
  submitTemplate,
  type MetaTemplate,
} from "./template-api";
import { listTemplateDefinitions } from "./templates";
import type { WabaTemplateDefinition, WabaTemplateStatus } from "./types";

// Reconciles the local `whatsapp_templates` rows with both:
//   1. the in-code template registry (source of truth for content)
//   2. Meta's current view of the WABA templates (source of truth for
//      approval status, category locks, quality scores, rejection reason)
//
// Triggered manually from the admin endpoint — never on the request
// path. Kept idempotent so an operator can re-run after fixing a
// rejected definition without worrying about double-submitting.

export type SyncAction =
  | "submitted" // brand-new template uploaded to Meta
  | "edited" // existing template re-uploaded with new components
  | "metadata_updated" // local row caught up to Meta status / quality / id
  | "no_change" // hash matches and Meta state matches
  | "missing_locally" // template exists on Meta but not in code
  | "skipped"; // intentionally left alone (e.g. PENDING already)

export interface SyncReportEntry {
  name: string;
  action: SyncAction;
  localStatus: WabaTemplateStatus | "unknown";
  metaStatus: WabaTemplateStatus | "unknown";
  metaTemplateId: string | null;
  hashChanged: boolean;
  note?: string;
  error?: string;
}

export interface SyncReport {
  ok: boolean;
  entries: SyncReportEntry[];
}

/**
 * Walk the registry, push anything new or changed to Meta, and pull
 * Meta's current state down into the local rows.
 *
 * The two-direction sync handles every realistic state:
 *   - Definition added in code → POST + insert row.
 *   - Definition edited in code → POST edit + update row.
 *   - Meta-side state changed (approved, paused, quality drop) →
 *     local row catches up.
 *   - Template exists on Meta but not in code → flagged in the
 *     report (operator decides: add a definition or delete on Meta).
 */
export async function syncWabaTemplates(): Promise<SyncReport> {
  const definitions = listTemplateDefinitions();
  const meta = await listMetaTemplates();
  const metaByKey = indexMetaTemplates(meta);

  const entries: SyncReportEntry[] = [];

  for (const def of definitions) {
    try {
      entries.push(await syncOne(def, metaByKey));
    } catch (err) {
      entries.push({
        name: def.name,
        action: "skipped",
        localStatus: "unknown",
        metaStatus: "unknown",
        metaTemplateId: null,
        hashChanged: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Surface anything that exists on Meta but not in code so the
  // operator can decide whether to add it to the registry or delete
  // it upstream. Don't act on it automatically.
  const knownNames = new Set(definitions.map((d) => d.name));
  for (const m of meta) {
    if (knownNames.has(m.name)) continue;
    entries.push({
      name: m.name,
      action: "missing_locally",
      localStatus: "unknown",
      metaStatus: normalizeMetaStatus(m.status),
      metaTemplateId: m.id,
      hashChanged: false,
      note: "Template exists on Meta but no local definition. Add one to the registry, or DELETE on Meta if abandoned.",
    });
  }

  return { ok: entries.every((e) => !e.error), entries };
}

async function syncOne(
  def: WabaTemplateDefinition,
  metaByKey: Map<string, MetaTemplate>,
): Promise<SyncReportEntry> {
  const hash = hashTemplateDefinition(def);
  const variableNames = extractVariableNames(def);

  const local = await readLocalRow(def.name);
  const remote = metaByKey.get(metaKey(def.name, def.language));

  // Case 1: never submitted.
  if (!remote) {
    const result = await submitTemplate(def);
    await upsertLocalRow({
      def,
      hash,
      variableNames,
      metaTemplateId: result.id,
      status: normalizeMetaStatus(result.status),
      qualityScore: null,
      rejectionReason: null,
      submittedAt: new Date(),
      lastStatusAt: new Date(),
    });
    return {
      name: def.name,
      action: "submitted",
      localStatus: normalizeMetaStatus(result.status),
      metaStatus: normalizeMetaStatus(result.status),
      metaTemplateId: result.id,
      hashChanged: true,
    };
  }

  const remoteStatus = normalizeMetaStatus(remote.status);
  const localHash = local?.localDefinitionHash ?? null;
  const hashChanged = localHash !== hash;

  // Case 2: hash changed — push edit upstream. Skip when the upstream
  // is already PENDING (Meta is mid-review) to avoid wasting an edit
  // slot on a no-op race.
  if (hashChanged && remoteStatus !== "pending") {
    await editTemplate(remote.id, def);
    await upsertLocalRow({
      def,
      hash,
      variableNames,
      metaTemplateId: remote.id,
      // After an edit Meta moves the template back to PENDING.
      status: "pending",
      qualityScore: remote.quality_score?.score ?? null,
      rejectionReason: null,
      submittedAt: new Date(),
      lastStatusAt: new Date(),
    });
    return {
      name: def.name,
      action: "edited",
      localStatus: "pending",
      metaStatus: remoteStatus,
      metaTemplateId: remote.id,
      hashChanged: true,
    };
  }

  // Case 3: hash unchanged but Meta-side state may have moved (approval,
  // pause, category change, quality drop). Pull it down.
  const wantsLocalUpdate =
    !local ||
    local.status !== remoteStatus ||
    local.metaTemplateId !== remote.id ||
    (local.qualityScore ?? null) !== (remote.quality_score?.score ?? null) ||
    (local.rejectionReason ?? null) !== (remote.rejected_reason ?? null) ||
    local.category !== normalizeMetaCategory(remote.category);

  if (wantsLocalUpdate) {
    await upsertLocalRow({
      def: { ...def, category: normalizeMetaCategory(remote.category) },
      hash: localHash ?? hash,
      variableNames,
      metaTemplateId: remote.id,
      status: remoteStatus,
      qualityScore: remote.quality_score?.score ?? null,
      rejectionReason: remote.rejected_reason ?? null,
      submittedAt: local?.submittedAt ?? new Date(),
      lastStatusAt: new Date(),
    });
    return {
      name: def.name,
      action: "metadata_updated",
      localStatus: remoteStatus,
      metaStatus: remoteStatus,
      metaTemplateId: remote.id,
      hashChanged: false,
    };
  }

  return {
    name: def.name,
    action: hashChanged ? "skipped" : "no_change",
    localStatus: remoteStatus,
    metaStatus: remoteStatus,
    metaTemplateId: remote.id,
    hashChanged,
    note: hashChanged
      ? "Local definition changed but Meta is still PENDING — wait for the current review to land before editing again."
      : undefined,
  };
}

/**
 * Force a re-submit of a rejected template after the operator has
 * edited the definition in code. Useful as a manual escape hatch
 * when sync would otherwise no-op (e.g. the upstream is REJECTED
 * and the local hash matches the rejected version).
 */
export async function resubmitTemplate(
  name: string,
): Promise<SyncReportEntry> {
  const definitions = listTemplateDefinitions();
  const def = definitions.find((d) => d.name === name);
  if (!def) {
    return {
      name,
      action: "skipped",
      localStatus: "unknown",
      metaStatus: "unknown",
      metaTemplateId: null,
      hashChanged: false,
      error: `No local definition found for "${name}"`,
    };
  }
  const hash = hashTemplateDefinition(def);
  const local = await readLocalRow(name);
  const variableNames = extractVariableNames(def);

  if (local?.metaTemplateId) {
    await editTemplate(local.metaTemplateId, def);
    await upsertLocalRow({
      def,
      hash,
      variableNames,
      metaTemplateId: local.metaTemplateId,
      status: "pending",
      qualityScore: local.qualityScore ?? null,
      rejectionReason: null,
      submittedAt: new Date(),
      lastStatusAt: new Date(),
    });
    return {
      name,
      action: "edited",
      localStatus: "pending",
      metaStatus: "pending",
      metaTemplateId: local.metaTemplateId,
      hashChanged: true,
    };
  }

  const result = await submitTemplate(def);
  await upsertLocalRow({
    def,
    hash,
    variableNames,
    metaTemplateId: result.id,
    status: normalizeMetaStatus(result.status),
    qualityScore: null,
    rejectionReason: null,
    submittedAt: new Date(),
    lastStatusAt: new Date(),
  });
  return {
    name,
    action: "submitted",
    localStatus: normalizeMetaStatus(result.status),
    metaStatus: normalizeMetaStatus(result.status),
    metaTemplateId: result.id,
    hashChanged: true,
  };
}

// ---------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------

async function readLocalRow(name: string) {
  const rows = await db
    .select()
    .from(schema.whatsappTemplates)
    .where(eq(schema.whatsappTemplates.name, name))
    .limit(1);
  return rows[0] ?? null;
}

interface UpsertInput {
  def: WabaTemplateDefinition;
  hash: string;
  variableNames: string[];
  metaTemplateId: string;
  status: WabaTemplateStatus;
  qualityScore: string | null;
  rejectionReason: string | null;
  submittedAt: Date;
  lastStatusAt: Date;
}

async function upsertLocalRow(input: UpsertInput): Promise<void> {
  await db
    .insert(schema.whatsappTemplates)
    .values({
      name: input.def.name,
      metaTemplateId: input.metaTemplateId,
      category: input.def.category,
      language: input.def.language,
      status: input.status,
      qualityScore: input.qualityScore,
      rejectionReason: input.rejectionReason,
      components: input.def.components,
      variableNames: input.variableNames,
      submittedAt: input.submittedAt,
      lastStatusAt: input.lastStatusAt,
      localDefinitionHash: input.hash,
    })
    .onConflictDoUpdate({
      target: schema.whatsappTemplates.name,
      set: {
        metaTemplateId: input.metaTemplateId,
        category: input.def.category,
        language: input.def.language,
        status: input.status,
        qualityScore: input.qualityScore,
        rejectionReason: input.rejectionReason,
        components: input.def.components,
        variableNames: input.variableNames,
        submittedAt: input.submittedAt,
        lastStatusAt: input.lastStatusAt,
        localDefinitionHash: input.hash,
        updatedAt: sql`NOW()`,
      },
    });
}

function metaKey(name: string, language: string): string {
  return `${name}:${language}`;
}

function indexMetaTemplates(list: MetaTemplate[]): Map<string, MetaTemplate> {
  const out = new Map<string, MetaTemplate>();
  for (const m of list) out.set(metaKey(m.name, m.language), m);
  return out;
}
