/**
 * Tracked links for the BROTE collaborator invitations.
 *
 *   npx tsx scripts/seed-brote-invitation-links.ts              # dry run
 *   npx tsx scripts/seed-brote-invitation-links.ts --execute
 *   npx tsx scripts/seed-brote-invitation-links.ts --execute \
 *     --referrer-jose=jose@example.com --referrer-gian=gian@example.com
 *
 * One `links` row per collaborator, with a stable readable slug rather than
 * the `{channel}-{date}-{nanoid}` the admin UI generates: the checkout falls
 * back to this exact string when someone arrives through the pretty URL
 * instead of `/go/`, so it has to be a constant the code can name.
 *
 * What the rows buy, without any new reporting UI:
 *   · `/go/inv-jose` works as a short link — counts clicks, stamps UTMs, sets
 *     the 30-day `haris_link` cookie.
 *   · `/admin/links/inv-jose` shows clicks, signups and the attributed
 *     people. **That signup count is what a collaborator's fee is paid from.**
 *
 * Without these rows nothing breaks: `sanitizeAttribution` drops a link_slug
 * whose row is missing, and the sale is still recorded via
 * `participations.metadata.invite`. It just won't be counted in the admin.
 *
 * `--referrer-*` is optional and only meaningful for the two artists: it
 * stamps `participations.referred_by_person_id` on every sale through that
 * link, via `recordParticipation`'s `bypassLinkSlug` path. It needs a
 * `people` row to already exist for that email.
 *
 * IMPORTANT: check the DB host it prints before passing --execute.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { INVITATION_SLUGS, getInvitation } from "../src/lib/brote-invitations";

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function value(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return hit?.slice(prefix.length + 1) || undefined;
}

const DRY_RUN = !flag("--execute");

function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

interface PlannedLink {
  slug: string;
  destination: string;
  label: string;
  referrerEmail?: string;
}

function plan(): PlannedLink[] {
  return INVITATION_SLUGS.map((slug) => {
    const invitation = getInvitation(slug)!;
    return {
      slug: invitation.linkSlug,
      destination: `/es/brote/invitacion/${invitation.slug}`,
      label: `Invitación · ${invitation.name}`,
      referrerEmail: value(`--referrer-${invitation.slug}`),
    };
  });
}

async function main() {
  const links = plan();

  console.log(`\nDB host: ${dbHost()}`);
  console.log(`Mode:    ${DRY_RUN ? "DRY RUN" : "EXECUTE"}\n`);
  console.log(`${links.length} tracked links:`);
  for (const l of links) {
    const referrer = l.referrerEmail ? ` · referrer=${l.referrerEmail}` : "";
    console.log(`  ${l.slug.padEnd(14)} → ${l.destination}${referrer}`);
    console.log(
      `  ${" ".repeat(14)}   https://www.harisolaas.com/go/${l.slug}`,
    );
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written. Pass --execute to insert.\n");
    return;
  }

  // Imported lazily, after the dry-run guard, so a dry run never opens a
  // connection (and never throws when DATABASE_URL is absent).
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  for (const l of links) {
    // `channel`/`source`/`medium` match the `partner` entry in
    // `src/lib/links.ts`, so these rows roll up with any other partner links
    // in the admin's by-channel view instead of forming their own bucket.
    await db.execute(sql`
      INSERT INTO links (
        slug, destination, label, channel, source, medium, campaign,
        created_date, created_by, status, bypass_capacity,
        referred_by_person_id
      )
      SELECT
        ${l.slug}, ${l.destination}, ${l.label},
        'partner', 'partner', 'referral', 'brote-invitacion',
        ${new Date().toISOString().slice(0, 10)},
        'seed-brote-invitation-links', 'active', false,
        ${l.referrerEmail ? sql`(SELECT id FROM people WHERE email = ${l.referrerEmail})` : sql`NULL`}
      ON CONFLICT (slug) DO NOTHING
    `);

    if (l.referrerEmail) {
      const check = await db.execute(sql`
        SELECT referred_by_person_id FROM links WHERE slug = ${l.slug}
      `);
      const row = check.rows[0] as
        | { referred_by_person_id: number | null }
        | undefined;
      if (!row?.referred_by_person_id) {
        // Loud, because a silent null here means the artist's sales are
        // counted but never attributed to them as a person.
        console.warn(
          `  ⚠ ${l.slug}: no people row for ${l.referrerEmail} — link created without a referrer`,
        );
      }
    }
  }

  console.log(`\n✓ ${links.length} links upserted (existing rows untouched)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
