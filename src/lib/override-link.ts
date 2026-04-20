import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export interface OverrideLinkResolution {
  /** True when the slug resolves to an active link with bypassCapacity=true. */
  bypassCapacity: boolean;
  /** Set when the link is both active AND has a referrer configured. */
  referredByPersonId: number | undefined;
  /** True when the slug pointed at a real link row (even if without overrides). */
  linkExists: boolean;
}

const EMPTY: OverrideLinkResolution = {
  bypassCapacity: false,
  referredByPersonId: undefined,
  linkExists: false,
};

/**
 * Resolve an override-link slug to its bypass + referrer settings.
 *
 * Used by signup endpoints and capacity-state endpoints to answer two
 * questions in one hop:
 * 1. Should this signup skip the capacity check?
 * 2. Should a referrer be stamped onto the resulting participation?
 *
 * Safe for any caller — returns all-false for null/missing/unknown/archived
 * slugs so the non-override path is the default.
 */
export async function resolveOverrideLink(
  slug: string | null | undefined,
): Promise<OverrideLinkResolution> {
  if (!slug) return EMPTY;

  const rows = await db
    .select({
      status: schema.links.status,
      bypassCapacity: schema.links.bypassCapacity,
      referredByPersonId: schema.links.referredByPersonId,
    })
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1);

  if (rows.length === 0) return EMPTY;
  const link = rows[0];
  // Archived/disabled links should stop granting bypass even if the flag
  // is still set on the row — treats status as the kill-switch.
  if (link.status !== "active") {
    return {
      bypassCapacity: false,
      referredByPersonId: undefined,
      linkExists: true,
    };
  }
  return {
    bypassCapacity: Boolean(link.bypassCapacity),
    referredByPersonId: link.referredByPersonId ?? undefined,
    linkExists: true,
  };
}
