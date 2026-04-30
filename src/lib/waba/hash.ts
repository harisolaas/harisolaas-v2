import { createHash } from "crypto";
import type { WabaTemplateDefinition } from "./types";

/**
 * Stable hash of a template definition.
 *
 * The hash answers exactly one question: "did this local definition
 * change since we last submitted it to Meta?". When it differs from
 * the row's `localDefinitionHash` in `whatsapp_templates`, the sync
 * endpoint knows to edit (or recreate) the template upstream.
 *
 * Stability matters: keys are sorted, so a cosmetic re-ordering of
 * properties in the source file does not produce a false-positive
 * "definition changed" signal that would burn through Meta's edit
 * quota (10/30d on approved templates).
 */
export function hashTemplateDefinition(
  def: WabaTemplateDefinition,
): string {
  const canonical = canonicalize(def);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

/**
 * Extract the named placeholder list (in declaration order, deduped)
 * from a template definition. Used by the runtime validator that
 * makes sure the caller's `variables` object has every key the
 * template expects before we hit Meta.
 */
export function extractVariableNames(
  def: WabaTemplateDefinition,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const re = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

  for (const c of def.components) {
    if (c.type === "BODY" || c.type === "HEADER") {
      let m: RegExpExecArray | null;
      const text = c.text ?? "";
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (!seen.has(name)) {
          seen.add(name);
          ordered.push(name);
        }
      }
    }
  }

  return ordered;
}
