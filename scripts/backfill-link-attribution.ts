/**
 * Spec 03 — one-shot backfill: create retroactive `links` rows for known
 * campaigns that predate the link builder, and stamp matching
 * `participations.link_slug` so historical attribution is queryable.
 *
 * Usage:
 *   npx tsx scripts/backfill-link-attribution.ts --dry-run
 *   npx tsx scripts/backfill-link-attribution.ts --execute
 *
 * Logic:
 *   1. Group existing participations by (attribution->>'source',
 *      attribution->>'medium', attribution->>'campaign').
 *   2. For each distinct combo, create a synthetic link row with a
 *      stable, human-readable slug `backfill-{source}-{medium}-{campaign}`.
 *   3. UPDATE participations.link_slug for rows in that group that don't
 *      yet have a link_slug.
 *
 * Idempotent: re-running adds zero new rows and zero new stamps.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { sql } from "drizzle-orm";

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--execute");

if (!args.has("--dry-run") && !args.has("--execute")) {
  console.error("Pass --dry-run or --execute explicitly.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const BACKFILL_USER = "backfill@harisolaas.com";

type Combo = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  participations: number;
  earliest_created: string;
  [key: string]: unknown;
};

function sanitize(s: string | null | undefined): string {
  if (!s) return "x";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "x";
}

function buildSlug(c: Combo): string {
  const src = sanitize(c.source);
  const med = sanitize(c.medium);
  const camp = sanitize(c.campaign);
  return `backfill-${src}-${med}-${camp}`.slice(0, 80);
}

function chooseChannel(source: string | null, medium: string | null): string {
  const s = (source ?? "").toLowerCase();
  const m = (medium ?? "").toLowerCase();
  if (s === "instagram") {
    if (m === "story") return "ig-story";
    if (m === "post") return "ig-post";
    if (m === "reel") return "ig-reel";
    if (m === "ad") return "ig-ad";
    if (m === "dm") return "ig-dm";
    if (m === "bio") return "ig-bio";
    return "ig-post";
  }
  if (s === "email") return m === "personal" ? "email-personal" : "email-campaign";
  if (s === "whatsapp") {
    if (m === "group") return "wa-group";
    if (m === "broadcast") return "wa-broadcast";
    return "wa-personal";
  }
  if (s === "press") return "press";
  if (s === "partner") return "partner";
  if (s === "direct") return "direct";
  return "other";
}

async function main() {
  const { db, schema } = await import("@/db");

  console.log(
    `\n== Spec 03 link backfill — ${DRY_RUN ? "DRY RUN" : "EXECUTE"} ==\n`,
  );

  const combosRes = await db.execute<Combo>(sql`
    SELECT
      attribution->>'source'   AS source,
      attribution->>'medium'   AS medium,
      attribution->>'campaign' AS campaign,
      COUNT(*)::int            AS participations,
      MIN(created_at)::text    AS earliest_created
    FROM participations
    WHERE attribution IS NOT NULL
      AND link_slug IS NULL
      AND (
        attribution->>'source'   IS NOT NULL
        OR attribution->>'medium'   IS NOT NULL
        OR attribution->>'campaign' IS NOT NULL
      )
    GROUP BY 1, 2, 3
    ORDER BY participations DESC
  `);

  const combos = combosRes.rows ?? [];
  if (combos.length === 0) {
    console.log("No un-attributed utm combos found. Nothing to backfill.\n");
    return;
  }

  console.log(`Found ${combos.length} distinct (source, medium, campaign) combos:\n`);
  for (const c of combos) {
    console.log(
      `  [${c.participations}x] source=${c.source ?? "-"} medium=${c.medium ?? "-"} campaign=${c.campaign ?? "-"}`,
    );
  }
  console.log();

  if (DRY_RUN) {
    console.log("Planned actions:");
    for (const c of combos) {
      const slug = buildSlug(c);
      const channel = chooseChannel(c.source, c.medium);
      console.log(
        `  CREATE link slug=${slug} channel=${channel} → stamp ${c.participations} participations`,
      );
    }
    console.log("\nDry-run only. Re-run with --execute to apply.\n");
    return;
  }

  let totalLinksCreated = 0;
  let totalStamps = 0;

  await db.transaction(async (tx) => {
    for (const c of combos) {
      const slug = buildSlug(c);
      const channel = chooseChannel(c.source, c.medium);
      const source = c.source ?? "other";
      const medium = c.medium ?? "other";
      const campaign = c.campaign ?? null;
      const earliest = c.earliest_created
        ? c.earliest_created.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const inserted = await tx
        .insert(schema.links)
        .values({
          slug,
          destination: "/",
          label: `Backfill — ${source}/${medium}${campaign ? "/" + campaign : ""}`,
          channel,
          source,
          medium,
          campaign,
          resourceUrl: null,
          note: "Retroactive link created by backfill script.",
          createdDate: earliest,
          createdBy: BACKFILL_USER,
          status: "archived",
          version: 1,
        })
        .onConflictDoNothing({ target: schema.links.slug })
        .returning();

      if (inserted.length > 0) totalLinksCreated += 1;

      const stamped = await tx.execute<{ n: number }>(sql`
        WITH updated AS (
          UPDATE participations
          SET link_slug = ${slug}
          WHERE link_slug IS NULL
            AND COALESCE(attribution->>'source',   '') = COALESCE(${c.source ?? ""}::text, '')
            AND COALESCE(attribution->>'medium',   '') = COALESCE(${c.medium ?? ""}::text, '')
            AND COALESCE(attribution->>'campaign', '') = COALESCE(${c.campaign ?? ""}::text, '')
          RETURNING 1
        )
        SELECT COUNT(*)::int AS n FROM updated
      `);

      const n = Number(stamped.rows?.[0]?.n ?? 0);
      totalStamps += n;
      console.log(
        `  ✓ slug=${slug}: ${inserted.length > 0 ? "link created" : "link exists"}, stamped ${n} participations`,
      );
    }
  });

  console.log(
    `\nDone. Created ${totalLinksCreated} links, stamped ${totalStamps} participations.\n`,
  );
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
