import { sql, type SQL } from "drizzle-orm";
import { phoneMatchCandidates } from "@/lib/community";
import { phoneDigits } from "@/lib/plant-types";

// Admin search by phone. People from phone-first flows (Hackeá tu mente)
// may have no email, so the WhatsApp number is how the operator finds
// them. Stored phones come in several shapes ("+5491112345678",
// "11 1234-5678"), so both sides are compared as digits, and a full AR
// number typed in one shape also finds it stored in the other.

// Only queries made of phone characters count as a phone search — a name
// with a digit in it ("Sala 2") must not turn into a digit match.
const PHONE_QUERY_RE = /^[\d\s\-()+.]+$/;
const MIN_DIGITS = 4;

/** The digit fragments to look for, or [] when `q` isn't a phone query. */
export function phoneSearchFragments(q: string): string[] {
  const trimmed = q.trim();
  if (!PHONE_QUERY_RE.test(trimmed)) return [];
  const digits = phoneDigits(trimmed);
  if (digits.length < MIN_DIGITS) return [];
  // phoneMatchCandidates adds the national / +549 / 0-prefixed spellings
  // of a full AR number; for a partial number it's just the digits.
  return [...new Set([digits, ...phoneMatchCandidates(trimmed)])].filter(
    (d) => d.length >= MIN_DIGITS,
  );
}

/**
 * `(digits(column) LIKE '%frag%' OR …)` for a phone-shaped query, else
 * null so the caller can leave the predicate out.
 */
export function phoneSearchClause(column: SQL, q: string): SQL | null {
  const fragments = phoneSearchFragments(q);
  if (fragments.length === 0) return null;
  const stored = sql`regexp_replace(COALESCE(${column}, ''), '[^0-9]', '', 'g')`;
  return sql`(${sql.join(
    fragments.map((f) => sql`${stored} LIKE ${`%${f}%`}`),
    sql` OR `,
  )})`;
}
