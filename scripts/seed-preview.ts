/**
 * Seeds a Vercel preview / dev Neon branch with realistic test data so
 * the admin dashboard isn't empty when you're clicking around.
 *
 * Usage:
 *   vercel env pull .env.local --environment=preview
 *   npx tsx scripts/seed-preview.ts --dry-run      # print the plan
 *   npx tsx scripts/seed-preview.ts --execute      # write to the DB
 *
 * Everything is idempotent — IDs use a `preview-` prefix and every
 * insert is ON CONFLICT DO NOTHING, so re-running is safe. Add
 * `--admin-email=you@example.com` to also seed an owner/all admin_users
 * row so you can log in without the ADMIN_EMAILS env fallback.
 *
 * ⚠️  This prints the target DB host before writing. Eyeball it before
 * passing --execute — `NEXT_PUBLIC_BASE_URL` is pinned to the prod
 * domain on every Vercel env so it isn't a reliable discriminator.
 * Prefer `vercel env pull --environment=preview` and watch for a
 * preview-branch-named Neon host.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { sql } from "drizzle-orm";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (prefix: string): string | undefined => {
  const arg = args.find((a) => a.startsWith(`${prefix}=`));
  return arg?.slice(prefix.length + 1);
};

const DRY_RUN = !flag("--execute");
const ADMIN_EMAIL = value("--admin-email");

function dbHost(): string {
  // The db client in `@/db` connects via DATABASE_URL (pooled); the
  // unpooled URL is for drizzle-kit migrations. Read the pooled one first
  // so the printed host always matches what writes will hit. Fall back
  // to UNPOOLED so an operator with only the migration URL still sees
  // something meaningful.
  for (const url of [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ]) {
    if (!url) continue;
    try {
      return new URL(url).host;
    } catch {
      /* try the next one */
    }
  }
  return "(unparseable)";
}

// Fixture dataset. Realistic enough to populate each admin tab without
// being overwhelming. Emails are under @example.com so they never
// collide with real people.
interface EventFixture {
  id: string;
  type: "brote" | "plant" | "sinergia";
  series: string | null;
  name: string;
  date: string; // ISO
  capacity: number | null;
  status: "upcoming" | "live" | "past" | "cancelled";
}

interface ParticipationFixture {
  id: string;
  personEmail: string;
  eventId: string;
  role: string;
  status: "pending" | "confirmed" | "waitlist" | "cancelled" | "no_show" | "used";
  staysForDinner?: boolean;
  // Contribution fields. When `priceCents` is set, the seeder writes
  // `price_cents`/`currency`/`external_payment_id` on the participation
  // and (when `donation` is true) mirrors it into
  // `metadata.donation` so the row matches what
  // `recordSinergiaDonation` produces in prod. Without these the admin
  // "Aportes recaudados" panel won't render in preview.
  priceCents?: number;
  currency?: string;
  paymentId?: string;
  donation?: boolean;
}

interface LinkFixture {
  slug: string;
  destination: string;
  label: string;
  channel: string;
  source: string;
  medium: string;
  campaign: string | null;
  createdDate: string;
  bypassCapacity: boolean;
  referrerEmail: string | null;
}

const EVENTS: EventFixture[] = [
  {
    id: "preview-brote",
    type: "brote",
    series: null,
    name: "BROTE · Reforestación 2026 (preview)",
    date: "2026-03-28T20:00:00-03:00",
    capacity: 300,
    status: "past",
  },
  {
    id: "preview-plant",
    type: "plant",
    series: null,
    name: "Plantación 19 abr (preview)",
    date: "2027-04-19T14:30:00-03:00",
    capacity: 40,
    status: "upcoming",
  },
  {
    id: "preview-sinergia-full",
    type: "sinergia",
    series: "sinergia",
    name: "Sinergia — sold out (preview)",
    date: "2026-05-06T19:30:00-03:00",
    capacity: 15,
    status: "upcoming",
  },
  {
    id: "preview-sinergia-open",
    type: "sinergia",
    series: "sinergia",
    name: "Sinergia — open (preview)",
    date: "2026-05-13T19:30:00-03:00",
    capacity: 15,
    status: "upcoming",
  },
];

interface PersonFixture {
  email: string;
  name: string;
  // Optional so the WhatsApp fan-out paths exercise both branches
  // (with and without a contactable number) in preview.
  phone?: string;
}

const PEOPLE: PersonFixture[] = [
  // Most people get a phone — that's the production-realistic state
  // since RSVP forms have required it for a while now.
  { email: "preview-ana@example.com", name: "Ana Pérez", phone: "1122555101" },
  { email: "preview-beto@example.com", name: "Beto Ruiz", phone: "1122555102" },
  { email: "preview-carla@example.com", name: "Carla Gómez", phone: "1122555103" },
  { email: "preview-dani@example.com", name: "Dani Martínez", phone: "1122555104" },
  { email: "preview-eze@example.com", name: "Ezequiel Soto", phone: "1122555105" },
  { email: "preview-flor@example.com", name: "Flor Castro", phone: "1122555106" },
  { email: "preview-gabi@example.com", name: "Gabi Torres", phone: "1122555107" },
  { email: "preview-hugo@example.com", name: "Hugo Blanco", phone: "1122555108" },
  { email: "preview-ine@example.com", name: "Inés Morales", phone: "1122555109" },
  { email: "preview-javi@example.com", name: "Javi Romero", phone: "1122555110" },
  { email: "preview-kari@example.com", name: "Karina Díaz", phone: "1122555111" },
  { email: "preview-leo@example.com", name: "Leo Fernández", phone: "1122555112" },
  { email: "preview-mica@example.com", name: "Micaela Ríos", phone: "1122555113" },
  { email: "preview-nico@example.com", name: "Nico Álvarez", phone: "1122555114" },
  { email: "preview-oli@example.com", name: "Olivia Herrera", phone: "1122555115" },
  // Two without a phone — they're confirmed for a Sinergia session,
  // so the WhatsApp fan-out audience filter has to drop them. This
  // is what an older RSVP (pre-phone-required) looks like.
  { email: "preview-pau@example.com", name: "Pau Giménez" },
  { email: "preview-quin@example.com", name: "Quintín Ramos" },
  { email: "preview-rocio@example.com", name: "Rocío Vega", phone: "1122555118" },
  { email: "preview-santi@example.com", name: "Santi Núñez", phone: "1122555119" },
  { email: "preview-tomi@example.com", name: "Tomás Ibáñez", phone: "1122555120" },
  { email: "preview-vale@example.com", name: "Valeria Cruz", phone: "1122555121" },
  { email: "preview-host@example.com", name: "Host de Sinergia", phone: "1122555122" },
];

const PARTICIPATIONS: ParticipationFixture[] = [
  // Brote (past event) — mix of used + no_show + cancelled. Every
  // non-cancelled row carries the early-bird price ($18.650 ARS) so
  // the admin contributions panel reflects realistic ticket revenue.
  // Cancelled rows get no payment so the aggregate excludes them, the
  // way the prod webhook leaves refunded/cancelled rows.
  ...[
    "ana",
    "beto",
    "carla",
    "dani",
    "eze",
    "flor",
    "gabi",
    "hugo",
    "ine",
    "javi",
  ].map<ParticipationFixture>((k, i) => {
    const status = i < 7 ? "used" : i === 7 ? "no_show" : "cancelled";
    const isPaid = status !== "cancelled";
    return {
      id: `PREVIEW-BR-${String(i + 1).padStart(3, "0")}`,
      personEmail: `preview-${k}@example.com`,
      eventId: "preview-brote",
      role: "attendee",
      status,
      ...(isPaid && {
        priceCents: 1865000,
        currency: "ARS",
        paymentId: `PREVIEW-MP-BR-${String(i + 1).padStart(3, "0")}`,
      }),
    };
  }),
  // Plant (upcoming) — confirmed + a couple waitlist.
  ...[
    "ana",
    "carla",
    "flor",
    "gabi",
    "ine",
    "kari",
    "mica",
    "oli",
    "pau",
    "vale",
  ].map<ParticipationFixture>((k, i) => ({
    id: `PREVIEW-PL-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${k}@example.com`,
    eventId: "preview-plant",
    role: "planter",
    status: i < 8 ? "confirmed" : "waitlist",
  })),
  // Sinergia FULL — 15-seat cap, actually full: 15 confirmed + 1
  // cancelled (so the admin drawer demonstrates the "No vendrá /
  // Reactivar" toggle and the cancelled-row chip out of the box,
  // without dropping the headcount below capacity). 6 of the 15
  // confirmed attach a donation matching the live chip amounts
  // (5k / 10k / 20k ARS, two of each) so the "Aportes recaudados"
  // panel surfaces partial-coverage math (6/15 = 40%). The remaining
  // 9 confirmed RSVP without a donation, exercising the free-RSVP
  // path.
  ...[
    { k: "ana", donate: 500000, status: "confirmed" as const },
    { k: "beto", donate: 0, status: "confirmed" as const },
    { k: "carla", donate: 1000000, status: "confirmed" as const },
    { k: "dani", donate: 0, status: "confirmed" as const },
    { k: "eze", donate: 2000000, status: "confirmed" as const },
    { k: "flor", donate: 0, status: "confirmed" as const },
    { k: "gabi", donate: 500000, status: "confirmed" as const },
    { k: "hugo", donate: 0, status: "confirmed" as const },
    { k: "ine", donate: 1000000, status: "confirmed" as const },
    { k: "javi", donate: 0, status: "confirmed" as const },
    { k: "kari", donate: 2000000, status: "confirmed" as const },
    { k: "leo", donate: 0, status: "cancelled" as const },
    { k: "mica", donate: 0, status: "confirmed" as const },
    { k: "nico", donate: 0, status: "confirmed" as const },
    { k: "oli", donate: 0, status: "confirmed" as const },
    { k: "vale", donate: 0, status: "confirmed" as const },
  ].map<ParticipationFixture>(({ k, donate, status }, i) => ({
    id: `PREVIEW-SF-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${k}@example.com`,
    eventId: "preview-sinergia-full",
    role: "rsvp",
    status,
    staysForDinner: i % 3 !== 0,
    ...(donate > 0 && {
      priceCents: donate,
      currency: "ARS",
      paymentId: `PREVIEW-MP-SF-${String(i + 1).padStart(3, "0")}`,
      donation: true,
    }),
  })),
  // Sinergia OPEN — 5 confirmed, room for more. Intentionally no
  // donations so the admin drawer demonstrates the empty/hidden state
  // of the contributions panel for the same event type.
  ...["pau", "quin", "rocio", "santi", "tomi"].map<ParticipationFixture>(
    (k, i) => ({
      id: `PREVIEW-SO-${String(i + 1).padStart(3, "0")}`,
      personEmail: `preview-${k}@example.com`,
      eventId: "preview-sinergia-open",
      role: "rsvp",
      status: "confirmed",
      staysForDinner: i % 2 === 0,
    }),
  ),
];

const LINKS: LinkFixture[] = [
  {
    slug: "preview-instagram-story-20260420",
    destination: "/es/sinergia",
    label: "Preview · Story IG",
    channel: "ig-story",
    source: "instagram",
    medium: "story",
    campaign: "sinergia_preview",
    createdDate: "2026-04-20",
    bypassCapacity: false,
    referrerEmail: null,
  },
  {
    slug: "preview-host-invite-sinergia",
    destination: "/es/sinergia",
    label: "Preview · Invitación del host (override)",
    channel: "wa-personal",
    source: "whatsapp",
    medium: "invite",
    campaign: "sinergia_host_invite",
    createdDate: "2026-04-20",
    bypassCapacity: true,
    referrerEmail: "preview-host@example.com",
  },
];

async function main() {
  const host = dbHost();
  console.log(`Target DB host: ${host}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "EXECUTE"}`);
  console.log(
    `(eyeball the host above — make sure it's your preview/dev branch)`,
  );

  console.log(`\nPlan:`);
  console.log(`  ${EVENTS.length} events`);
  console.log(`  ${PEOPLE.length} people`);
  console.log(`  ${PARTICIPATIONS.length} participations`);
  console.log(`  ${LINKS.length} links`);
  console.log(`  2 whatsapp_templates (1 approved, 1 rejected)`);
  if (ADMIN_EMAIL) console.log(`  1 admin_users row (${ADMIN_EMAIL})`);

  if (DRY_RUN) {
    console.log("\nDry run — no writes. Pass --execute to apply.");
    return;
  }

  const { db } = await import("@/db");

  // Events.
  for (const e of EVENTS) {
    await db.execute(sql`
      INSERT INTO events (id, type, series, name, date, capacity, status)
      VALUES (
        ${e.id}, ${e.type}, ${e.series}, ${e.name},
        ${e.date}::timestamptz, ${e.capacity}, ${e.status}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  console.log(`✓ events`);

  // People.
  for (const p of PEOPLE) {
    await db.execute(sql`
      INSERT INTO people (email, name, phone)
      VALUES (${p.email}, ${p.name}, ${p.phone ?? null})
      ON CONFLICT (email) DO UPDATE
        SET phone = COALESCE(EXCLUDED.phone, people.phone)
    `);
  }
  console.log(`✓ people`);

  // WhatsApp templates — seed one APPROVED + one REJECTED row so
  // the admin templates view exercises both rendering paths in
  // preview without having to wait on Meta. Names align with the
  // codebase registry so a /sync run from preview will overwrite
  // them with the real Meta state when WABA env vars are wired up.
  await db.execute(sql`
    INSERT INTO whatsapp_templates (
      name, meta_template_id, category, language, status,
      quality_score, components, variable_names, submitted_at, last_status_at,
      local_definition_hash
    )
    VALUES (
      'sinergia_weekly_reminder',
      'preview-meta-tpl-1',
      'utility',
      'es_AR',
      'approved',
      'GREEN',
      ${JSON.stringify([
        {
          type: "BODY",
          text:
            "Hola {{name}}, te recordamos que esta noche es Sinergia: nos juntamos a las {{time}}. " +
            "Si no podés venir, respondé este mensaje y liberamos tu lugar para alguien de la lista de espera. ¡Te esperamos!",
        },
        { type: "FOOTER", text: "harisolaas.com · Sinergia" },
      ])}::jsonb,
      ARRAY['name','time']::text[],
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '4 days',
      'preview-hash-approved'
    )
    ON CONFLICT (name) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO whatsapp_templates (
      name, meta_template_id, category, language, status,
      rejection_reason, components, variable_names, submitted_at, last_status_at,
      local_definition_hash
    )
    VALUES (
      'preview_rejected_example',
      'preview-meta-tpl-2',
      'marketing',
      'es_AR',
      'rejected',
      'INCORRECT_CATEGORY',
      ${JSON.stringify([
        {
          type: "BODY",
          text: "Hola {{name}}, mirá estas ofertas exclusivas para vos.",
        },
      ])}::jsonb,
      ARRAY['name']::text[],
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '1 day',
      'preview-hash-rejected'
    )
    ON CONFLICT (name) DO NOTHING
  `);
  console.log(`✓ whatsapp_templates`);

  // Participations. Look up person_id by email inside the INSERT.
  for (const p of PARTICIPATIONS) {
    const usedAtSql =
      p.status === "used" ? sql`NOW() - INTERVAL '2 days'` : sql`NULL`;
    // Build metadata: dinner flag + (for Sinergia donations) the same
    // `donation` shape that recordSinergiaDonation writes in prod.
    const meta: Record<string, unknown> = {};
    if (p.staysForDinner !== undefined) meta.staysForDinner = p.staysForDinner;
    if (p.donation && p.priceCents) {
      meta.donation = {
        amountCents: p.priceCents,
        currency: p.currency ?? "ARS",
        paymentId: p.paymentId,
        receiptSent: true,
      };
    }
    const metadataSql = sql`${JSON.stringify(meta)}::jsonb`;
    await db.execute(sql`
      INSERT INTO participations (
        id, person_id, event_id, role, status, metadata, used_at,
        external_payment_id, price_cents, currency
      )
      SELECT
        ${p.id},
        people.id,
        ${p.eventId},
        ${p.role},
        ${p.status},
        ${metadataSql},
        ${usedAtSql},
        ${p.paymentId ?? null},
        ${p.priceCents ?? null},
        ${p.currency ?? null}
      FROM people WHERE email = ${p.personEmail}
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`✓ participations`);

  // Links, with optional referrer lookup.
  for (const l of LINKS) {
    await db.execute(sql`
      INSERT INTO links (
        slug, destination, label, channel, source, medium, campaign,
        created_date, created_by, status, bypass_capacity, referred_by_person_id
      )
      SELECT
        ${l.slug}, ${l.destination}, ${l.label}, ${l.channel},
        ${l.source}, ${l.medium}, ${l.campaign},
        ${l.createdDate}, 'seed-preview', 'active',
        ${l.bypassCapacity},
        ${l.referrerEmail ? sql`(SELECT id FROM people WHERE email = ${l.referrerEmail})` : sql`NULL`}
      ON CONFLICT (slug) DO NOTHING
    `);
  }
  console.log(`✓ links`);

  if (ADMIN_EMAIL) {
    await db.execute(sql`
      INSERT INTO admin_users (email, role, scope, created_by_email)
      VALUES (${ADMIN_EMAIL.trim().toLowerCase()}, 'owner', 'all', 'seed-preview')
      ON CONFLICT (email) DO NOTHING
    `);
    console.log(`✓ admin_users (${ADMIN_EMAIL})`);
  }

  console.log("\nDone. Log into the preview admin and start poking.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
