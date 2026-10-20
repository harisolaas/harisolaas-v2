import { sql } from "drizzle-orm";

/**
 * Entradas a Hackeá participation stands for: `metadata.quantity` (group
 * purchase), 1 when absent — every row written before group purchases.
 * Expects the participations table aliased `pa`. Anything that counts
 * entradas (capacity, CRM, host mail) sums this instead of counting rows.
 */
export const quantitySql = sql`COALESCE((pa.metadata->>'quantity')::int, 1)`;
