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
  const url = process.env.DATABASE_URL_UNPOOLED ?? "";
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
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

interface PersonFixture {
  email: string;
  name: string;
}

interface ParticipationFixture {
  id: string;
  personEmail: string;
  eventId: string;
  role: string;
  status: "pending" | "confirmed" | "waitlist" | "cancelled" | "no_show" | "used";
  staysForDinner?: boolean;
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

const PEOPLE: PersonFixture[] = [
  { email: "preview-ana@example.com", name: "Ana Pérez" },
  { email: "preview-beto@example.com", name: "Beto Ruiz" },
  { email: "preview-carla@example.com", name: "Carla Gómez" },
  { email: "preview-dani@example.com", name: "Dani Martínez" },
  { email: "preview-eze@example.com", name: "Ezequiel Soto" },
  { email: "preview-flor@example.com", name: "Flor Castro" },
  { email: "preview-gabi@example.com", name: "Gabi Torres" },
  { email: "preview-hugo@example.com", name: "Hugo Blanco" },
  { email: "preview-ine@example.com", name: "Inés Morales" },
  { email: "preview-javi@example.com", name: "Javi Romero" },
  { email: "preview-kari@example.com", name: "Karina Díaz" },
  { email: "preview-leo@example.com", name: "Leo Fernández" },
  { email: "preview-mica@example.com", name: "Micaela Ríos" },
  { email: "preview-nico@example.com", name: "Nico Álvarez" },
  { email: "preview-oli@example.com", name: "Olivia Herrera" },
  { email: "preview-pau@example.com", name: "Pau Giménez" },
  { email: "preview-quin@example.com", name: "Quintín Ramos" },
  { email: "preview-rocio@example.com", name: "Rocío Vega" },
  { email: "preview-santi@example.com", name: "Santi Núñez" },
  { email: "preview-tomi@example.com", name: "Tomás Ibáñez" },
  { email: "preview-vale@example.com", name: "Valeria Cruz" },
  { email: "preview-host@example.com", name: "Host de Sinergia" },
];

const PARTICIPATIONS: ParticipationFixture[] = [
  // Brote (past event) — mix of used + no_show + cancelled.
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
  ].map<ParticipationFixture>((k, i) => ({
    id: `PREVIEW-BR-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${k}@example.com`,
    eventId: "preview-brote",
    role: "attendee",
    status: i < 7 ? "used" : i === 7 ? "no_show" : "confirmed",
  })),
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
  // Sinergia FULL — fill the 15-seat cap exactly.
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
    "kari",
    "leo",
    "mica",
    "nico",
    "oli",
  ].map<ParticipationFixture>((k, i) => ({
    id: `PREVIEW-SF-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${k}@example.com`,
    eventId: "preview-sinergia-full",
    role: "rsvp",
    status: "confirmed",
    staysForDinner: i % 3 !== 0,
  })),
  // Sinergia OPEN — 5 confirmed, room for more.
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
      INSERT INTO people (email, name)
      VALUES (${p.email}, ${p.name})
      ON CONFLICT (email) DO NOTHING
    `);
  }
  console.log(`✓ people`);

  // Participations. Look up person_id by email inside the INSERT.
  for (const p of PARTICIPATIONS) {
    const usedAtSql =
      p.status === "used" ? sql`NOW() - INTERVAL '2 days'` : sql`NULL`;
    await db.execute(sql`
      INSERT INTO participations (
        id, person_id, event_id, role, status, metadata, used_at
      )
      SELECT
        ${p.id},
        people.id,
        ${p.eventId},
        ${p.role},
        ${p.status},
        ${
          p.staysForDinner !== undefined
            ? sql`${JSON.stringify({ staysForDinner: p.staysForDinner })}::jsonb`
            : sql`'{}'::jsonb`
        },
        ${usedAtSql}
      FROM people WHERE email = ${p.personEmail}
      ON CONFLICT (id) DO NOTHING
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
