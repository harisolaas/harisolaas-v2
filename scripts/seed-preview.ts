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
import {
  INVITATION_SLUGS,
  getInvitation,
} from "../src/lib/brote-invitations";

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
  type: "brote" | "plant" | "sinergia" | "sinergia-parrafo";
  series: string | null;
  name: string;
  date: string; // ISO
  capacity: number | null;
  status: "upcoming" | "live" | "past" | "cancelled";
  // Path of the public landing this event belongs to. Drives the admin
  // link-creator dropdown. Leave null when the event has no landing.
  landingPath: string | null;
}

interface PersonFixture {
  email: string;
  name: string;
  /**
   * Stamps `opted_out_at`. The Comunidad BROTE audience filters these out, so
   * a preview branch needs at least one to prove the filter does something.
   */
  optedOut?: boolean;
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
  // Attribution. Without these the admin's Enlaces tab shows 0 signups on
  // every link and "Personas atribuidas" is always empty, so the whole
  // reporting surface a collaborator's fee is counted from is untestable in
  // preview. `referrerEmail` additionally stamps `referred_by_person_id`,
  // which is what `bypassLinkSlug` does in prod.
  linkSlug?: string;
  attributionSource?: string;
  attributionMedium?: string;
  attributionCampaign?: string;
  referrerEmail?: string;
  /** Collaborator slug, mirroring what the BROTE webhook writes. */
  invite?: string;
  paymentId?: string;
  donation?: boolean;
  /**
   * Name written on THIS ticket, for a buyer who bought several. Mirrors
   * `metadata.guestName`, which the door prefers over the payer's name.
   */
  guestName?: string;
  /** Who paid, when that isn't the attendee. Mirrors `buyer_person_id`. */
  buyerEmail?: string;
  /**
   * Position within the purchase, 0-based, on companion rows. Mirrors
   * `metadata.seq`, which `addCompanionTickets` stamps in prod and which is
   * THE canonical order every reader of a group sorts by — the form on
   * /success, the door and the resend all number tickets from it. Without
   * it the preview data sorts by id and the fixtures stop resembling what
   * production actually produces.
   */
  seq?: number;
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
    landingPath: "/es/brote",
  },
  {
    id: "preview-brote2",
    type: "brote",
    series: null,
    name: "BROTE 2 · Fiesta de reforestación (preview)",
    date: "2026-08-20T19:00:00-03:00",
    // capacity null mirrors prod: the 100-tree goal is display-only and never
    // enforced, so checkout can't fail with CapacityReachedError after payment.
    capacity: null,
    status: "upcoming",
    landingPath: "/es/brote",
  },
  {
    id: "preview-plant",
    type: "plant",
    series: null,
    name: "Plantación 19 abr (preview)",
    date: "2027-04-19T14:30:00-03:00",
    capacity: 40,
    status: "upcoming",
    // No /es/plant landing in the codebase — exercises the
    // null-landing-path code path so the admin dropdown skips events
    // without a public page.
    landingPath: null,
  },
  {
    id: "preview-sinergia-full",
    type: "sinergia",
    series: "sinergia",
    name: "Sinergia — sold out (preview)",
    date: "2026-05-06T19:30:00-03:00",
    capacity: 15,
    status: "upcoming",
    landingPath: "/es/sinergia",
  },
  {
    id: "preview-sinergia-open",
    type: "sinergia",
    series: "sinergia",
    name: "Sinergia — open (preview)",
    date: "2026-05-13T19:30:00-03:00",
    capacity: 15,
    status: "upcoming",
    landingPath: "/es/sinergia",
  },
  {
    id: "preview-sinergia-parrafo",
    type: "sinergia-parrafo",
    series: "sinergia-parrafo",
    name: "Sinergia × Párrafo — 16/05 (preview)",
    date: "2026-05-16T10:00:00-03:00",
    capacity: 50,
    status: "upcoming",
    landingPath: "/es/sinergia-parrafo",
  },
  // ── The three REAL edition ids, deliberately not `preview-` prefixed ──
  //
  // Anything keyed on the constants in `src/data/brote.ts` — the tree counter,
  // and the Comunidad BROTE campaign's audience query — looks up
  // `brote-2026-03-28`, `plant-2026-04` and `brote-2026-08-20` by name. Seeded
  // only under `preview-` ids, those surfaces return zero rows in a preview
  // branch and cannot be exercised at all, which is the exact thing seeding is
  // supposed to prevent.
  //
  // Safe because this script only ever runs against a preview/dev Neon branch
  // and every insert is ON CONFLICT DO NOTHING: on the off chance it is
  // pointed at a branch that already has the real rows, it changes nothing.
  {
    id: "brote-2026-03-28",
    type: "brote",
    series: null,
    name: "BROTE — 28 de marzo 2026",
    date: "2026-03-28T20:00:00-03:00",
    capacity: null,
    status: "past",
    landingPath: "/es/brote",
  },
  {
    id: "plant-2026-04",
    type: "plant",
    series: null,
    name: "Plantación Abril 2026",
    date: "2026-04-19T14:30:00-03:00",
    capacity: 40,
    status: "past",
    landingPath: null,
  },
  {
    id: "brote-2026-08-20",
    type: "brote",
    series: null,
    name: "BROTE 2 — 20 de agosto 2026",
    date: "2026-08-20T19:00:00-03:00",
    capacity: null,
    status: "upcoming",
    landingPath: "/es/brote",
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
  // Multi-ticket buyers: Tina holds four tickets across TWO payments (a
  // 3-pack and a later repurchase), Ulises bought two from an invitation.
  { email: "preview-tina@example.com", name: "Tina Ferrari" },
  { email: "preview-ulises@example.com", name: "Ulises Prado" },
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
  { email: "preview-sofi@example.com", name: "Sofía Aguirre" },
  // The two BROTE line-up artists, as the referrers on their invitation
  // links. They need to exist as people for `referred_by_person_id` to
  // resolve to anything.
  { email: "preview-jose@example.com", name: "José Dezanzo" },
  { email: "preview-gian@example.com", name: "Gian Bejarano" },
  // Exercises the 'Asistente' placeholder self-heal path in `upsertPerson`
  // / `recordParticipation` and the backfill script's filter
  // (`name='Asistente' AND external_payment_id IS NOT NULL`).
  { email: "preview-asistente@example.com", name: "Asistente" },
  // Came to BROTE 1 and later asked to be taken off the list. Nothing in the
  // admin UI makes them look different — the only way to see that the
  // Comunidad BROTE audience honours `opted_out_at` is to have one.
  { email: "preview-baja@example.com", name: "Bruno Baja", optedOut: true },
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
  // BROTE 2 (upcoming) — live-edition ticketing. Mix of early-bird and regular
  // prices plus a couple of already-scanned (used) tickets and one cancelled
  // (no payment) so the admin panels show realistic edition-2 revenue and the
  // gate can be exercised against a used ticket.
  ...(
    [
      { k: "kari", status: "confirmed", price: 2475000 },
      { k: "leo", status: "confirmed", price: 2475000 },
      { k: "mica", status: "confirmed", price: 2475000 },
      { k: "nico", status: "confirmed", price: 3300000 },
      { k: "oli", status: "confirmed", price: 3300000 },
      { k: "pau", status: "used", price: 2475000 },
      { k: "quin", status: "used", price: 3300000 },
      { k: "rocio", status: "cancelled", price: null },
    ] as const
  ).map<ParticipationFixture>((row, i) => ({
    id: `PREVIEW-B2-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${row.k}@example.com`,
    eventId: "preview-brote2",
    role: "attendee",
    status: row.status,
    ...(row.price !== null && {
      priceCents: row.price,
      currency: "ARS",
      paymentId: `PREVIEW-MP-B2-${String(i + 1).padStart(3, "0")}`,
    }),
  })),
  // ── Multi-ticket purchases (one payment, several tickets) ───────────
  //
  // The buyer's own row is `attendee`; the extras are `companion`, which is
  // exactly what the partial unique index exempts. They share one
  // `external_payment_id` — the anchor the webhook retry, the /success
  // resend and the guest-name writer all resolve the group by — and each
  // carries the UNIT price, never the basket total.
  //
  // Three tickets on one payment: one named, one not. Both states matter —
  // the door shows the guest name when there is one and the buyer's name
  // when there isn't, and the /success form has to render a filled field
  // next to an empty one.
  {
    id: "PREVIEW-B2-MULTI-001",
    personEmail: "preview-tina@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2475000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-MULTI-1",
    guestName: "Tina Ferrari",
  },
  {
    id: "PREVIEW-B2-MULTI-002",
    personEmail: "preview-tina@example.com",
    eventId: "preview-brote2",
    role: "companion",
    status: "confirmed",
    priceCents: 2475000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-MULTI-1",
    buyerEmail: "preview-tina@example.com",
    guestName: "Marce Quiroga",
    seq: 0,
  },
  {
    // Deliberately unnamed: the empty state of the guest-name field, and
    // the door falling back to the buyer's name.
    id: "PREVIEW-B2-MULTI-003",
    personEmail: "preview-tina@example.com",
    eventId: "preview-brote2",
    role: "companion",
    status: "confirmed",
    priceCents: 2475000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-MULTI-1",
    buyerEmail: "preview-tina@example.com",
    seq: 1,
  },
  {
    // A SECOND, separate purchase by the same person — the repurchase that
    // used to produce an admin alert and no ticket. Different payment id on
    // purpose: it must not be pulled into the group above.
    id: "PREVIEW-B2-MULTI-004",
    personEmail: "preview-tina@example.com",
    eventId: "preview-brote2",
    role: "companion",
    status: "confirmed",
    priceCents: 3300000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-MULTI-2",
    buyerEmail: "preview-tina@example.com",
    guestName: "Vale Iribarne",
    seq: 0,
  },
  {
    // Two tickets bought from a collaborator page. BOTH carry
    // `metadata.invite`: the payout report selects on it, so a fixture that
    // marks only the first would make the report look right while paying
    // half of what it should.
    id: "PREVIEW-B2-INV-MULTI-1",
    personEmail: "preview-ulises@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2145000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-MULTI",
    invite: "pulso",
    linkSlug: "inv-pulso",
    attributionSource: "instagram",
    attributionMedium: "bio",
  },
  {
    id: "PREVIEW-B2-INV-MULTI-2",
    personEmail: "preview-ulises@example.com",
    eventId: "preview-brote2",
    role: "companion",
    status: "confirmed",
    priceCents: 2145000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-MULTI",
    buyerEmail: "preview-ulises@example.com",
    invite: "pulso",
    seq: 0,
    linkSlug: "inv-pulso",
    attributionSource: "instagram",
    attributionMedium: "bio",
    guestName: "Flor Medina",
  },
  // Sales through the collaborator invitations. Three states on purpose, so
  // the admin renders all of them instead of one happy row:
  //   · a brand sale at the discounted price, attributed by link only;
  //   · an artist sale at the public price, attributed AND carrying a
  //     referrer — the pair a per-ticket fee is counted from;
  //   · a sale that arrived through a real /go/ link, where the tracked link
  //     takes the attribution and `metadata.invite` is the only record of
  //     which collaborator sent them.
  // The eight rows above stay unattributed, which is the empty state.
  {
    id: "PREVIEW-B2-INV-001",
    personEmail: "preview-sofi@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2145000, // $21.450 — 35% off the regular price
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-001",
    linkSlug: "inv-pulso",
    attributionSource: "partner",
    attributionMedium: "referral",
    attributionCampaign: "brote-invitacion",
    invite: "pulso",
  },
  {
    id: "PREVIEW-B2-INV-002",
    personEmail: "preview-tomi@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2475000, // artists sell at the public preventa price
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-002",
    linkSlug: "inv-jose",
    attributionSource: "partner",
    attributionMedium: "referral",
    attributionCampaign: "brote-invitacion",
    referrerEmail: "preview-jose@example.com",
    invite: "jose",
  },
  {
    // Alguien que ya vino a BROTE 1 y vuelve por la página de comunidad:
    // mismo 35% que una marca, pero sin colaborador a quien pagarle.
    id: "PREVIEW-B2-INV-004",
    personEmail: "preview-ana@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2145000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-004",
    linkSlug: "inv-comunidad",
    attributionSource: "partner",
    attributionMedium: "referral",
    attributionCampaign: "brote-invitacion",
    invite: "comunidad",
  },
  {
    id: "PREVIEW-B2-INV-003",
    personEmail: "preview-vale@example.com",
    eventId: "preview-brote2",
    role: "attendee",
    status: "confirmed",
    priceCents: 2475000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-B2-INV-003",
    linkSlug: "preview-instagram-story-20260420",
    attributionSource: "instagram",
    attributionMedium: "story",
    invite: "gian",
  },
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
  // Sinergia × Párrafo — paid event ($33.000 ARS, capacity 50). Mix of
  // confirmed paid attendees + one cancelled to exercise both the
  // populated "Aportes recaudados" panel and the cancelled-row chip.
  // Every confirmed row carries the live ticket price so revenue math
  // matches a real run.
  ...[
    { k: "ana", status: "confirmed" as const },
    { k: "beto", status: "confirmed" as const },
    { k: "carla", status: "confirmed" as const },
    { k: "dani", status: "confirmed" as const },
    { k: "eze", status: "confirmed" as const },
    { k: "flor", status: "confirmed" as const },
    { k: "gabi", status: "cancelled" as const },
    // Pairs with the 'Asistente' person row to exercise the self-heal
    // path and the backfill script end-to-end in preview.
    { k: "asistente", status: "confirmed" as const },
  ].map<ParticipationFixture>(({ k, status }, i) => ({
    id: `PREVIEW-SP-${String(i + 1).padStart(3, "0")}`,
    personEmail: `preview-${k}@example.com`,
    eventId: "preview-sinergia-parrafo",
    role: "attendee",
    status,
    ...(status === "confirmed" && {
      priceCents: 3_300_000,
      currency: "ARS",
      paymentId: `PREVIEW-MP-SP-${String(i + 1).padStart(3, "0")}`,
    }),
  })),

  // ── Comunidad BROTE audience, under the REAL edition ids ──
  //
  // `loadComunidadAudience()` looks up `brote-2026-03-28` / `plant-2026-04`
  // and excludes anyone holding `brote-2026-08-20`, so these rows are what
  // make `{"action":"comunidad-campaign","wave":1,"mode":"preview"}` return
  // anything at all in a preview branch. Every branch of the query is
  // covered: the three segments that each get different copy, and the three
  // reasons a person is dropped.
  {
    // Segment "brote1". `used` — they came.
    id: "PREVIEW-CM-001",
    personEmail: "preview-ana@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "used",
    priceCents: 1_865_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-001",
  },
  {
    // Segment "brote1" via `no_show` — kept on purpose. They paid and didn't
    // make it, which is a reason to invite them back, not to drop them.
    id: "PREVIEW-CM-002",
    personEmail: "preview-beto@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "no_show",
    priceCents: 1_865_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-002",
  },
  {
    // Segment "plant" — the planting day was free, so no price.
    id: "PREVIEW-CM-003",
    personEmail: "preview-carla@example.com",
    eventId: "plant-2026-04",
    role: "planter",
    status: "confirmed",
  },
  // Segment "both" — Dani is in the two rows below, and gets the third copy
  // variant ("Sos de la primera camada").
  {
    id: "PREVIEW-CM-004",
    personEmail: "preview-dani@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "used",
    priceCents: 1_865_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-004",
  },
  {
    id: "PREVIEW-CM-005",
    personEmail: "preview-dani@example.com",
    eventId: "plant-2026-04",
    role: "planter",
    status: "confirmed",
  },
  {
    // Excluded — `cancelled`. Signed up and pulled out.
    id: "PREVIEW-CM-006",
    personEmail: "preview-eze@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "cancelled",
  },
  {
    // Excluded — `waitlist`. Never got a place, so the copy's "estuviste" /
    // "plantaste" would be false. Real plantación waitlist rows also carry
    // the email address as the name.
    id: "PREVIEW-CM-010",
    personEmail: "preview-gabi@example.com",
    eventId: "plant-2026-04",
    role: "planter",
    status: "waitlist",
  },
  // Excluded — already holds a BROTE 2 ticket. Offering a discount on
  // something they have paid for reads as a mistake and invites a refund
  // request, so the two rows below have to keep Flor out of the audience.
  {
    id: "PREVIEW-CM-007",
    personEmail: "preview-flor@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "used",
    priceCents: 1_865_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-007",
  },
  {
    id: "PREVIEW-CM-008",
    personEmail: "preview-flor@example.com",
    eventId: "brote-2026-08-20",
    role: "attendee",
    status: "confirmed",
    priceCents: 2_145_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-008",
    invite: "comunidad",
  },
  {
    // Excluded — opted out. Came to BROTE 1 and asked off the list.
    id: "PREVIEW-CM-009",
    personEmail: "preview-baja@example.com",
    eventId: "brote-2026-03-28",
    role: "attendee",
    status: "used",
    priceCents: 1_865_000,
    currency: "ARS",
    paymentId: "PREVIEW-MP-CM-009",
  },
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
  // BROTE collaborator invitations. Real slugs, not `preview-` prefixed: the
  // checkout resolves these exact strings from `src/lib/brote-invitations.ts`
  // when a buyer arrives through the pretty URL, so a renamed preview copy
  // would exercise a code path that does not exist.
  //
  // Derived from the registry rather than listed by hand: a seventh
  // invitation would otherwise render a page with no link row behind it, and
  // the only symptom is a signup that silently loses its `link_slug`.
  ...INVITATION_SLUGS.map((slug) => {
    const invitation = getInvitation(slug)!;
    return {
    slug: invitation.linkSlug,
    destination: `/es/brote/invitacion/${invitation.slug}`,
    label: `Invitación · ${invitation.name}`,
    channel: "partner",
    source: "partner",
    medium: "referral",
    campaign: "brote-invitacion",
    createdDate: "2026-08-08",
    bypassCapacity: false,
    // Only the artists carry a referrer — that is what stamps
    // `referred_by_person_id` on their sales, the field a per-ticket fee
    // would be counted from. Brands and the returning community discount but
    // are not paid, so they have nobody to point at.
    referrerEmail:
      invitation.kind === "artist"
        ? `preview-${invitation.slug}@example.com`
        : null,
    };
  }),
];

async function main() {
  const host = dbHost();
  console.log(`Target DB host: ${host}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "EXECUTE"}`);
  console.log(
    `(eyeball the host above — make sure it's your preview/dev branch)`,
  );

  // Fixture consistency, checked before anything is written and before the
  // dry-run guard so it runs on every invocation.
  //
  // A participation resolves its person with `SELECT ... FROM people WHERE
  // email = $1`. When the email is not in PEOPLE that SELECT returns nothing
  // and the INSERT quietly writes zero rows — no error, and the row just
  // isn't there when you go looking for it in the admin. Same for a
  // `link_slug` with no LINKS entry, except that one fails on the foreign
  // key with a message that doesn't name the fixture.
  const knownEmails = new Set(PEOPLE.map((p) => p.email));
  const knownSlugs = new Set(LINKS.map((l) => l.slug));
  const problems: string[] = [];
  for (const p of PARTICIPATIONS) {
    if (!knownEmails.has(p.personEmail)) {
      problems.push(`${p.id}: personEmail ${p.personEmail} is not in PEOPLE`);
    }
    if (p.referrerEmail && !knownEmails.has(p.referrerEmail)) {
      problems.push(`${p.id}: referrerEmail ${p.referrerEmail} is not in PEOPLE`);
    }
    if (p.linkSlug && !knownSlugs.has(p.linkSlug)) {
      problems.push(`${p.id}: linkSlug ${p.linkSlug} is not in LINKS`);
    }
  }
  for (const l of LINKS) {
    if (l.referrerEmail && !knownEmails.has(l.referrerEmail)) {
      problems.push(`${l.slug}: referrerEmail ${l.referrerEmail} is not in PEOPLE`);
    }
  }
  if (problems.length > 0) {
    console.error("\n✗ Fixture references that would not resolve:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

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
      INSERT INTO events (id, type, series, name, date, capacity, status, landing_path)
      VALUES (
        ${e.id}, ${e.type}, ${e.series}, ${e.name},
        ${e.date}::timestamptz, ${e.capacity}, ${e.status}, ${e.landingPath}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  console.log(`✓ events`);

  // People.
  for (const p of PEOPLE) {
    await db.execute(sql`
      INSERT INTO people (email, name, opted_out_at)
      VALUES (
        ${p.email}, ${p.name},
        ${p.optedOut ? sql`NOW() - INTERVAL '30 days'` : sql`NULL`}
      )
      ON CONFLICT (email) DO NOTHING
    `);
  }
  console.log(`✓ people`);

  // Links, with optional referrer lookup.
  //
  // BEFORE participations, not after: participations now carry `link_slug`,
  // which is a foreign key onto this table. Seeding them the other way round
  // fails the constraint.
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
    if (p.invite) meta.invite = p.invite;
    if (p.guestName) meta.guestName = p.guestName;
    if (p.seq !== undefined) meta.seq = p.seq;
    const metadataSql = sql`${JSON.stringify(meta)}::jsonb`;

    // `attribution` is the typed touch the admin reads; `link_slug` is the
    // denormalized column the rollup queries join on. `recordParticipation`
    // writes both in prod, so the fixture has to as well or the two views
    // disagree in preview.
    const attributionSql = p.linkSlug
      ? sql`${JSON.stringify({
          linkSlug: p.linkSlug,
          ...(p.attributionSource && { source: p.attributionSource }),
          ...(p.attributionMedium && { medium: p.attributionMedium }),
          ...(p.attributionCampaign && { campaign: p.attributionCampaign }),
          capturedAt: new Date().toISOString(),
        })}::jsonb`
      : sql`NULL`;

    await db.execute(sql`
      INSERT INTO participations (
        id, person_id, event_id, role, status, metadata, used_at,
        external_payment_id, price_cents, currency,
        link_slug, attribution, referred_by_person_id, buyer_person_id
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
        ${p.currency ?? null},
        ${p.linkSlug ?? null},
        ${attributionSql},
        ${p.referrerEmail ? sql`(SELECT id FROM people ref WHERE ref.email = ${p.referrerEmail})` : sql`NULL`},
        ${p.buyerEmail ? sql`(SELECT id FROM people buyer WHERE buyer.email = ${p.buyerEmail})` : sql`NULL`}
      FROM people WHERE email = ${p.personEmail}
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`✓ participations`);


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
