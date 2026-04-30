import type { WabaTemplateDefinition } from "../types";
import { SINERGIA_WEEKLY_REMINDER } from "./sinergia-weekly-reminder";

// Registry of every template the codebase is allowed to send. The
// `whatsapp_templates` row sync flow uses this list as the authoritative
// view of what should exist on Meta — entries here that have no DB row
// get submitted; rows in the DB that no longer appear here get flagged
// so a human can decide whether to delete them on Meta as well.
//
// To add a new template:
//   1. Create a new file under `src/lib/waba/templates/` exporting a
//      `WabaTemplateDefinition` and a typed `*Variables` alias.
//   2. Add it to TEMPLATE_REGISTRY below.
//   3. POST to `/api/admin/waba/templates` with `{action: "sync"}` to
//      submit it to Meta.
//   4. Wait for Meta's approval webhook (typically <24h) before sending.
export const TEMPLATE_REGISTRY: Record<string, WabaTemplateDefinition> = {
  [SINERGIA_WEEKLY_REMINDER.name]: SINERGIA_WEEKLY_REMINDER,
};

export function listTemplateDefinitions(): WabaTemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY);
}

export function getTemplateDefinition(
  name: string,
): WabaTemplateDefinition | undefined {
  return TEMPLATE_REGISTRY[name];
}

export { SINERGIA_WEEKLY_REMINDER };
export type { SinergiaWeeklyReminderVariables } from "./sinergia-weekly-reminder";
