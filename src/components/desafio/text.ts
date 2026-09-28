import { fillTokens } from "@/data/brote";

/**
 * Fill a "{a} · {b}" style template, dropping the separator next to an empty
 * value — e.g. "Tu próximo día · {duracion}" with no duración reads
 * "Tu próximo día", not "Tu próximo día · ".
 */
export function joinMeta(template: string, values: Record<string, string>): string {
  return fillTokens(template, values)
    .split(" · ")
    .filter((part) => part.trim() !== "")
    .join(" · ");
}
