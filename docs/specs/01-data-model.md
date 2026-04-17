# Spec 01 — Data Model Restructure (Postgres)

## Goal

Move community/event/participation data off Redis and into a proper relational database (Neon Postgres). Promote events from hardcoded strings to first-class entities. Unify every signup/ticket/RSVP write through a single helper so the community model is always consistent. Capture consent, attribution, and referral data from day one.

After this spec ships, any future event (new Sinergia session, new BROTE party, new workshop, new retreat) drops into the system as an `INSERT INTO events` with no code changes to metrics, dashboard, or email layers.

## Why now

The current model has three concrete problems that aren't about scale:

1. **BROTE writes bypass `community:person` entirely.** Today the Comunidad tab only shows plant registrants + Sinergia RSVPs (plus any BROTE buyer who *also* registered to plant via a "lazy-link" one-shot). The majority of BROTE buyers are invisible to the community model. That's a bug, not a perf concern.
2. **Event names are hardcoded strings scattered across code.** Adding event #4 currently requires touching metrics, dashboard, email templates, and UI. With a weekly Sinergia cadence (~50/year) plus ~4 BROTE parties/year plus plantaciones plus future workshops, that's not tenable.
3. **Redis is doing relational work badly.** Four hand-rolled secondary indexes (`brote:attendees`, `plant:registrations`, `sinergia:session:{date}:rsvps`, `community:person`) all duplicate fields from canonical records and are known to drift. Spec 02 (dashboard) and Spec 03 (link builder) will need several more.

Redis stays in the stack — it's the right tool for MP idempotency, rate limits, and short-TTL transport payloads. It stops being the source of truth for entity data.

## Scope

**In scope:**
- New Postgres schema (people, events, participations, organizations, person_organizations, packages, memberships).
- `recordParticipation` / `upsertPerson` / `promoteWaitlist` helpers.
- One-shot migration script (Redis → Postgres), idempotent, with `--dry-run`.
- Handlers rewritten: BROTE webhook, plant register, Sinergia RSVP.
- Admin read endpoints rewritten: metrics, community, registrations, tickets, attendees, gate validator.
- Admin write endpoints for referral reconciliation.
- Consent fields + opt-in array on people.
- `link_slug` column on participations (FK constraint deferred to Spec 03).

**Out of scope for this spec (schema exists, UX deferred):**
- Full membership/package purchase + redemption UX (schema is ready; MP flow and redemption logic are a separate ticket when Sinergia passes go on sale).
- Phone-first / instagram-first person creation UX (email stays the default signup identifier; schema allows nullable email so admin-created or future WhatsApp-imported people work without migration).
- Group ticket purchase UX (BROTE checkout stays one-ticket-per-buyer; `buyer_person_id` column exists for when we expand).
- Organizations admin UI (schema is ready; Un Árbol and CIMA seeded; CRUD UI lands when we actually need to manage org relationships).
- Outbound email language switching (`language` column exists; wiring into email templates is a separate ticket).

**Explicitly never in scope:**
- Tracking outbound communications (sent emails, DMs, opens, clicks per email). Resend, WhatsApp, and Instagram own that data. A half-maintained mirror is worse than none.
- Instagram follower counts, social-media engagement metrics. Source systems own those.
- Touching the Un Árbol discount code flow (`brote:unarbol:{CODE}` keys stay in Redis — simple KV).
- Touching CIMA-related endpoints (`/api/brote/cima`), QR checkout (`/api/brote/qr-checkout`), campaign audit logs (`plant:campaign:*`), plant-messages feed (`/api/brote/plant-messages`), or flyer route (`/brote/flyer`).

## Execution prerequisites

**Site is LIVE. Do NOT push to main without explicit approval.** The current branch is `main`. Work off a feature branch until the user signs off.

**Stack:**
- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
- Package manager: **npm** (`package-lock.json` present — do not switch to pnpm/yarn)
- Node runtime: whatever `next` 16.1.6 supports (Node 20 LTS recommended)
- Deployed on Vercel
- Tests: the repo currently has no test runner wired up. For Phase 2 helpers, add Vitest (preferred for speed) or Jest, co-located tests or `__tests__/` — pick one and be consistent. Wire into `package.json` scripts.

**Redis today:** generic `REDIS_URL` via node-redis v5 client (`src/lib/redis.ts`). A `MOCK_REDIS=1` env enables an in-memory mock for local dev. Keep the mock for keys we retain.

**Existing environment variables (present today, keep):**
- `REDIS_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `BROTE_ADMIN_SECRET` — Bearer-token auth for `/api/brote/admin`, `/api/sinergia/admin`, `/api/brote/attendees`, `/api/brote/unarbol`
- `NEXT_PUBLIC_BASE_URL` (must be `https://www.harisolaas.com` — non-www 307-redirects)
- `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `META_CAPI_TOKEN`
- `SINERGIA_NOTIFY_EMAILS` (comma-separated)

**New environment variables (to add during Phase 1):**
- `DATABASE_URL` — pooled Neon connection string (app runtime, used by `@neondatabase/serverless`)
- `DATABASE_URL_UNPOOLED` — unpooled string (migrations only, used by `drizzle-kit`)

Both values come from the Neon console. Set across Production, Preview, and Development scopes in Vercel. Use the Neon Vercel integration so preview deploys get branch databases automatically.

**Admin auth today (important — mixed patterns):**
- Session-cookie auth via `requireAdminSession(req)` from `src/lib/admin-api-auth.ts`: used by `/api/admin/*` (metrics, community, registrations, tickets, actions).
- Bearer-token auth (`Authorization: Bearer $BROTE_ADMIN_SECRET`): used by `/api/brote/admin`, `/api/brote/attendees`, `/api/brote/unarbol`, `/api/sinergia/admin`.

Preserve each endpoint's existing auth pattern when rewriting. The new endpoints for referral reconciliation should use session auth (they're agent-callable *via a future MCP layer that wraps the session*, not via raw Bearer).

## Existing code reference

Files touched by this spec, grouped by concern. Lines are approximate — agent should re-read before editing.

### Handlers to rewrite (writes)

| File | Current behavior (summary) |
|---|---|
| `src/app/api/brote/webhook/route.ts` | Verifies MP HMAC → fetches payment from MP → generates `BROTE-XXXXXXXX` → `SET brote:ticket:{id}` → `SET brote:payment:{mpId}` → `INCR brote:counter` → `SADD brote:attendees` → sends Resend email with QR attachment → fires Meta CAPI Purchase event. Has crash-recovery logic: if `emailSent` flag missing on existing ticket, retries email. |
| `src/app/api/brote/register/route.ts` | Plant registration (path is `/brote/register`, NOT `/plant/register`). Rate-limits by IP → validates → handles `action: "waitlist"` branch (adds to `plant:waitlist` SET) → capacity check via `plant:counter` → idempotency check via `community:person:{email}` → generates `PLANT-XXXXXXXX` → `SET plant:registration:{id}` → `INCR plant:counter` → `SADD plant:registrations` → upserts `community:person:{email}` with lazy-link to BROTE attendees → sends Resend confirmation email. |
| `src/app/api/sinergia/rsvp/route.ts` | Sinergia RSVP. Rate-limits → validates → computes next session via `nextSinergiaDate()` → ensures `sinergia:session:{date}` exists → idempotency via `community:person:{email}` → capacity check via `sinergia:session:{date}:counter` → generates `SIN-XXXXXXXX` → `SET sinergia:rsvp:{id}` → `INCR sinergia:session:{date}:counter` → `SADD sinergia:session:{date}:rsvps` → updates session status to `full` if at capacity → upserts `community:person:{email}` with lazy-link to BROTE attendees → sends Resend confirmation + optional host-notification email. |

### Endpoints to rewrite (reads)

| File | Current behavior |
|---|---|
| `src/app/api/brote/validate/route.ts` | Gate scanner. Actions: `check` (returns ticket validity + `coffeeRedeemed`), `use` (marks `status='used'`, sets `usedAt`), `redeem-coffee` (sets `coffeeRedeemed=true`, `coffeeRedeemedAt`). Reads `brote:ticket:{id}`. |
| `src/app/api/admin/metrics/route.ts` | Aggregates across `plant:registration:*`, `community:person:*`, `brote:ticket:*`, `brote:attendees`, `plant:waitlist`, `plant:campaign:{1,2}:sent`. Returns nested JSON with `community`, `plantation`, `brote`, `funnel`, `health` sections. Session auth. |
| `src/app/api/admin/community/route.ts` | Iterates `community:person:*`, derives `hasBrote`/`hasPlant`/`hasSinergia`/`sinergiaCount`/`lastSinergia`/`journey` flags. Sorted by `firstSeen` desc. Session auth. |
| `src/app/api/admin/registrations/route.ts` | Iterates `plant:registration:*`, returns sorted array. Session auth. |
| `src/app/api/admin/tickets/route.ts` | Iterates `brote:ticket:*`, returns sorted array. Session auth. |
| `src/app/api/admin/actions/route.ts` | POST action dispatcher: `plant-resend-email`, `export-csv`, `fix-campaign-log`. Session auth. Keep `fix-campaign-log` as-is (campaign logs stay in Redis); rewrite the other two to read from Postgres. |
| `src/app/api/brote/attendees/route.ts` | Exports attendees. Bearer auth. Reads `brote:attendees` SET. |
| `src/app/api/brote/admin/route.ts` | System status, ticket lookup, email resend, payment lookup. Bearer auth. Reads multiple Redis keys. |
| `src/app/api/sinergia/admin/route.ts` | Bearer auth. Actions: `migrate-to-first-session` (rewrites RSVPs from one session date to another + sends erratum emails), `send-erratum` (retry erratum emails). Uses `sinergia:session:*`, `community:person:*`, `sinergia:rsvp:{id}:erratum-sent` flags. **Rewrite against new schema** — the migration logic becomes `UPDATE participations SET event_id = $newId WHERE event_id = $oldId`. |

### Endpoints to leave alone

- `src/app/api/brote/checkout/route.ts` — MP Preference creation, Meta CAPI init. Doesn't write entity data.
- `src/app/api/brote/counter/route.ts` — public ticket counter. Can either keep reading `brote:counter` or switch to `SELECT COUNT(*)`. Preference: switch, for consistency.
- `src/app/api/brote/plant-counter/route.ts` — same pattern as above. Switch to `SELECT COUNT(*)`.
- `src/app/api/brote/unarbol/route.ts` — Un Árbol discount codes. Stays on Redis.
- `src/app/api/brote/cima/route.ts` — CIMA-specific flow. Not touched.
- `src/app/api/brote/qr-checkout/route.ts` — QR-code checkout. Not touched.
- `src/app/api/brote/plant-messages/route.ts` — plant messages feed. Reads `plant:registration:*` for `message` fields only; can update post-migration to query Postgres, but not in this spec's critical path.
- `src/app/api/sinergia/next-session/route.ts` — returns next Sinergia date. Pure computation.
- `src/app/api/sinergia/send-reminders/route.ts` — reminder email sender. Update to read attendees from Postgres.
- `src/app/api/admin/auth/route.ts` — session auth. Untouched.
- Front-end pages under `src/app/[locale]/brote/*`, `src/app/[locale]/sinergia/*`, `src/components/*` — untouched by this spec.

### New files to create

| Path | Purpose |
|---|---|
| `drizzle.config.ts` | Drizzle-kit configuration |
| `src/db/schema.ts` | Drizzle table definitions (mirrors DDL below) |
| `src/db/index.ts` | DB client singleton (`@neondatabase/serverless`) |
| `src/db/migrations/` | Drizzle-generated SQL migration files (committed) |
| `src/lib/community.ts` | `recordParticipation`, `upsertPerson`, `promoteWaitlist`, `getPersonByEmail` |
| `scripts/migrate-redis-to-postgres.ts` | One-shot migration script |
| `scripts/cleanup-deprecated-redis.ts` | Phase 7 cleanup (runs 30 days post-cutover) |
| `src/app/api/admin/participations/route.ts` | GET list with filters |
| `src/app/api/admin/participations/[id]/route.ts` | PATCH update |
| `src/app/api/admin/participations/[id]/promote/route.ts` | POST waitlist promotion |
| `src/app/api/admin/people/search/route.ts` | GET fuzzy search |
| `src/app/api/admin/people/[id]/route.ts` | GET drilldown, PATCH profile |

## Existing record shapes

Canonical TypeScript interfaces from the current code. The migration must preserve every field (promoted to column or stashed in `metadata`).

### BROTE ticket — `src/lib/brote-types.ts`

```typescript
interface BroteTicket {
  id: string;                 // 'BROTE-XXXXXXXX'
  type: "ticket";
  paymentId: string;          // MP payment id
  buyerEmail: string;
  buyerName: string;
  status: "valid" | "used";
  createdAt: string;          // ISO
  usedAt?: string;            // ISO, set when gate-scanned
  emailSent?: boolean;        // crash-recovery flag
  coffeeRedeemed?: boolean;
  coffeeRedeemedAt?: string;  // ISO
}
```

### Plant registration — `src/lib/plant-types.ts`

```typescript
type GroupType = "solo" | "con-alguien" | "grupo";

interface PlantRegistration {
  id: string;                 // 'PLANT-XXXXXXXX'
  email: string;
  name: string;
  groupType: GroupType;
  carpool: boolean;
  status: "registered";
  message?: string;           // ≤280 chars
  createdAt: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

interface PlantWaitlistEntry {
  email: string;
  createdAt: string;
}
```

### Sinergia RSVP — `src/lib/sinergia-types.ts`

```typescript
interface SinergiaRsvp {
  id: string;                 // 'SIN-XXXXXXXX'
  sessionDate: string;        // 'YYYY-MM-DD'
  email: string;
  name: string;
  staysForDinner: boolean;
  createdAt: string;
  status: "registered";
}

interface SinergiaSession {
  date: string;               // 'YYYY-MM-DD'
  capacity: number;
  status: "open" | "full" | "closed";
}
```

### Community person (partial, current model) — `src/lib/plant-types.ts`

```typescript
interface CommunityParticipation {
  event: string;              // 'brote' | 'plant-2026-04' | 'sinergia-YYYY-MM-DD'
  role: string;               // 'attendee' | 'planter' | 'participant'  <- note: Sinergia uses 'participant'
  id: string;
  date: string;
}

interface CommunityPerson {
  email: string;
  name: string;
  firstSeen: string;
  participations: CommunityParticipation[];
}
```

## Complete current-state Redis inventory

| Key pattern | Value | Fate |
|---|---|---|
| `brote:ticket:{id}` | JSON `BroteTicket` | → `participations` row |
| `brote:attendees` | SET of JSON `{email, name, ticketId, createdAt}` | → derived from `participations` |
| `brote:counter` | integer | → `SELECT COUNT(*)` |
| `brote:payment:{mpPaymentId}` | string ticketId | **Keep** (MP idempotency) |
| `brote:checkout:{preferenceId}` | JSON Meta CAPI payload (24h TTL) | **Keep** (transport) |
| `brote:unarbol:{CODE}` | `"valid"` or `"used"` | **Keep** (simple KV) |
| `plant:registration:{id}` | JSON `PlantRegistration` | → `participations` row |
| `plant:registrations` | SET of JSON `{email, name, groupType, carpool, message?, registrationId, createdAt}` | → derived |
| `plant:counter` | integer | → `SELECT COUNT(*)` |
| `plant:waitlist` | SET of JSON `PlantWaitlistEntry` | → `participations` with `status='waitlist'` |
| `plant:campaign:{variant}:sent` | JSON `{sentAt, subject, audienceSize, sent, failedCount}` | **Keep** (out of scope for this spec) |
| `sinergia:rsvp:{id}` | JSON `SinergiaRsvp` | → `participations` row |
| `sinergia:session:{date}` | JSON `SinergiaSession` | → `events` row |
| `sinergia:session:{date}:counter` | integer | → `SELECT COUNT(*)` |
| `sinergia:session:{date}:rsvps` | SET of JSON `SinergiaAttendeeEntry` | → derived |
| `sinergia:rsvp:{id}:erratum-sent` | `"1"` flag | **Keep** (transport, used by `sinergia/admin`) |
| `community:person:{email}` | JSON `CommunityPerson` | → `people` + `participations` rows |
| Rate-limit maps | in-memory `Map` (not Redis) | unchanged |

## Target architecture

**Neon Postgres** as entity store. **Drizzle ORM** for schema definition, type-safe queries, and migrations. **Redis** retained only for transport-layer concerns.

### Dependencies to add

```bash
npm install drizzle-orm @neondatabase/serverless
npm install --save-dev drizzle-kit
```

### Schema

Full DDL. Drizzle schema at `src/db/schema.ts` mirrors it. Postgres extension required: `citext`.

```sql
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- people
-- ============================================================
CREATE TABLE people (
  id                        BIGSERIAL     PRIMARY KEY,
  email                     CITEXT        UNIQUE,                      -- nullable for future phone-first; currently required by site handlers
  name                      TEXT          NOT NULL,
  phone                     TEXT,
  instagram                 TEXT,
  language                  TEXT          NOT NULL DEFAULT 'es'
                                           CHECK (language IN ('es','en')),
  tags                      TEXT[]        NOT NULL DEFAULT '{}',
  notes                     TEXT,
  first_seen                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  first_touch               JSONB,                                     -- AttributionTouch; set once, never overwritten
  communication_opt_ins     TEXT[]        NOT NULL DEFAULT '{email:transactional,email:marketing}',
  opted_out_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CHECK (email IS NOT NULL OR phone IS NOT NULL OR instagram IS NOT NULL)
);

CREATE INDEX people_created_at_idx        ON people (created_at DESC);
CREATE INDEX people_first_seen_idx        ON people (first_seen DESC);
CREATE INDEX people_tags_gin_idx          ON people USING GIN (tags);
CREATE INDEX people_opt_ins_gin_idx       ON people USING GIN (communication_opt_ins);


-- ============================================================
-- events
-- ============================================================
CREATE TABLE events (
  id            TEXT          PRIMARY KEY,                             -- 'brote-2026-03-28', 'sinergia-2026-05-13', 'plant-2026-04'
  type          TEXT          NOT NULL,                                -- 'brote' | 'plant' | 'sinergia' | future
  series        TEXT,                                                  -- 'sinergia' groups recurring events
  name          TEXT          NOT NULL,
  date          TIMESTAMPTZ   NOT NULL,
  capacity      INTEGER,
  status        TEXT          NOT NULL
                              CHECK (status IN ('upcoming','live','past','cancelled')),
  metadata      JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX events_type_idx              ON events (type);
CREATE INDEX events_series_date_idx       ON events (series, date DESC);
CREATE INDEX events_date_idx              ON events (date DESC);
CREATE INDEX events_status_idx            ON events (status) WHERE status IN ('upcoming','live');


-- ============================================================
-- organizations
-- ============================================================
CREATE TABLE organizations (
  id            BIGSERIAL     PRIMARY KEY,
  slug          TEXT          NOT NULL UNIQUE,                         -- 'un-arbol', 'cima'
  name          TEXT          NOT NULL,
  type          TEXT,                                                  -- 'ngo' | 'sponsor' | 'partner' | null
  notes         TEXT,
  metadata      JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX organizations_type_idx       ON organizations (type);


-- ============================================================
-- person_organizations (many-to-many)
-- ============================================================
CREATE TABLE person_organizations (
  person_id         BIGINT    NOT NULL REFERENCES people(id)        ON DELETE CASCADE,
  organization_id   BIGINT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role              TEXT,                                              -- 'member' | 'contact' | 'partner' | null
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (person_id, organization_id)
);


-- ============================================================
-- packages (schema only this spec — purchase UX deferred)
-- ============================================================
CREATE TABLE packages (
  id                      BIGSERIAL     PRIMARY KEY,
  slug                    TEXT          NOT NULL UNIQUE,               -- 'sinergia-10-pack'
  name                    TEXT          NOT NULL,
  description             TEXT,
  participations_granted  INTEGER       NOT NULL,                      -- e.g. 10
  applies_to_event_type   TEXT,                                        -- 'sinergia' — scope where this package can be redeemed
  applies_to_series       TEXT,                                        -- optional tighter scope
  price_cents             INTEGER,
  currency                TEXT,
  validity_days           INTEGER,                                     -- null = no expiry
  status                  TEXT          NOT NULL DEFAULT 'active'
                                         CHECK (status IN ('active','archived')),
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ============================================================
-- memberships (schema only this spec — purchase UX deferred)
-- ============================================================
CREATE TABLE memberships (
  id                  BIGSERIAL     PRIMARY KEY,
  person_id           BIGINT        NOT NULL REFERENCES people(id)    ON DELETE RESTRICT,
  package_id          BIGINT        NOT NULL REFERENCES packages(id)  ON DELETE RESTRICT,
  purchased_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  participations_used INTEGER       NOT NULL DEFAULT 0,
  external_payment_id TEXT,                                            -- MP payment id
  price_cents         INTEGER,
  currency            TEXT,
  status              TEXT          NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','exhausted','expired','refunded','cancelled')),
  metadata            JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX memberships_person_idx       ON memberships (person_id);
CREATE INDEX memberships_status_idx       ON memberships (status);


-- ============================================================
-- participations
-- ============================================================
CREATE TABLE participations (
  id                      TEXT          PRIMARY KEY,                   -- 'BROTE-XXXXXXXX', 'PLANT-XXXXXXXX', 'SIN-XXXXXXXX'
  person_id               BIGINT        NOT NULL REFERENCES people(id)  ON DELETE RESTRICT,
  event_id                TEXT          NOT NULL REFERENCES events(id)  ON DELETE RESTRICT,
  buyer_person_id         BIGINT        REFERENCES people(id)           ON DELETE RESTRICT,  -- defaults to person_id; distinct for gifted/group tickets
  role                    TEXT          NOT NULL,                      -- open vocabulary, no CHECK
  status                  TEXT          NOT NULL DEFAULT 'confirmed'
                                         CHECK (status IN ('pending','confirmed','waitlist','cancelled','no_show','used')),
  date                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- attribution
  attribution             JSONB,                                       -- raw AttributionTouch (referrer, utms, etc.)
  link_slug               TEXT,                                        -- FK constraint added in Spec 03 when `links` table exists

  -- referrals
  referred_by_person_id   BIGINT        REFERENCES people(id)           ON DELETE SET NULL,
  referral_note           TEXT,                                        -- raw user input, e.g. "me invitó Coni"

  -- payment
  external_payment_id     TEXT,                                        -- MP payment id or future provider
  price_cents             INTEGER,
  currency                TEXT,
  membership_id           BIGINT        REFERENCES memberships(id)     ON DELETE SET NULL,

  -- lifecycle
  used_at                 TIMESTAMPTZ,                                 -- gate scan timestamp
  metadata                JSONB         NOT NULL DEFAULT '{}'::jsonb,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (person_id, event_id)
);

CREATE INDEX participations_event_id_idx          ON participations (event_id);
CREATE INDEX participations_person_id_idx         ON participations (person_id);
CREATE INDEX participations_buyer_idx             ON participations (buyer_person_id) WHERE buyer_person_id IS NOT NULL;
CREATE INDEX participations_created_at_idx        ON participations (created_at DESC);
CREATE INDEX participations_link_slug_idx         ON participations (link_slug) WHERE link_slug IS NOT NULL;
CREATE INDEX participations_status_idx            ON participations (status);
CREATE INDEX participations_external_payment_idx  ON participations (external_payment_id) WHERE external_payment_id IS NOT NULL;
CREATE INDEX participations_referred_by_idx       ON participations (referred_by_person_id) WHERE referred_by_person_id IS NOT NULL;
CREATE INDEX participations_unresolved_refs_idx   ON participations (id)
  WHERE referral_note IS NOT NULL AND referred_by_person_id IS NULL;
```

### Opt-in semantics

`communication_opt_ins` is a `TEXT[]` of composite `channel:purpose` strings:

- `email:transactional` — ticket confirmations, gate reminders, receipts
- `email:marketing` — campaigns, newsletters, broadcast announcements
- `whatsapp:transactional` — future
- `whatsapp:marketing` — future
- `sms:transactional` — future

Defaults on site signup: `{email:transactional, email:marketing}`. WhatsApp/SMS require explicit opt-in.

Sending rules:
- Transactional send → requires `'email:transactional' = ANY(communication_opt_ins)`
- Marketing send → requires `'email:marketing' = ANY(communication_opt_ins)`

Opt-out: remove the relevant string from the array, set `opted_out_at = NOW()`. Array-based so we can onboard WhatsApp/SMS without migrations.

### Attribution shape

```typescript
interface AttributionTouch {
  linkSlug?: string;    // from Spec 03 link builder
  source?: string;      // raw utm_source
  medium?: string;      // raw utm_medium
  campaign?: string;    // raw utm_campaign
  content?: string;     // raw utm_content
  referrer?: string;    // document.referrer when captured
  capturedAt: string;   // ISO
}
```

Stored as JSONB in `people.first_touch` (first participation only) and `participations.attribution` (every participation). When `linkSlug` is present it's denormalized to the `link_slug` column for fast joins once Spec 03's `links` table exists.

### Role vocabulary note

Current code writes role `'participant'` for Sinergia RSVPs (see `src/app/api/sinergia/rsvp/route.ts` line 143). This spec standardizes Sinergia on `'rsvp'`. The migration script must translate `'participant'` → `'rsvp'` for Sinergia-type events. Handler rewrites write `'rsvp'` going forward.

Role seed list (open TEXT column, no CHECK): `attendee`, `planter`, `rsvp`, `volunteer`, `organizer`, `host`, `speaker`, `helper`, `collaborator`, `partner`.

## Invariants

1. **Every signup/ticket/RSVP goes through `recordParticipation`.** No handler writes directly to the DB.
2. **Every participation is reachable two ways:** (a) `SELECT * FROM participations WHERE person_id = ?`, (b) `SELECT * FROM participations WHERE event_id = ?`.
3. **Email is stored as `CITEXT`.** Case-insensitive uniqueness and comparisons enforced by Postgres — no app-level lowercasing discipline needed.
4. **`people.first_seen` and `people.first_touch` are set once on `INSERT` and never updated.**
5. **`participations.attribution` is set at write time and never updated.**
6. **`UNIQUE(person_id, event_id)`.** A person has at most one participation per event. Waitlist → confirmed is an UPDATE on the existing row.
7. **`role` vocabulary is open.** No CHECK constraint. New roles don't require migrations.
8. **`status` vocabulary is closed.** CHECK constraint enforces: `pending | confirmed | waitlist | cancelled | no_show | used`.
9. **Atomicity via transactions.** Every `recordParticipation` call wraps the person upsert + participation insert/update in a single transaction. Either both land or neither does.
10. **`referred_by_person_id` is never auto-populated from `referral_note`.** Only set through explicit admin action (direct or via agent API).
11. **Capacity enforcement uses `SELECT ... FOR UPDATE`.** See Capacity section below.

## Write paths

Single helper `recordParticipation(params)` in `src/lib/community.ts`:

```typescript
interface RecordParticipationParams {
  email: string;
  name: string;
  phone?: string;
  instagram?: string;
  eventId: string;
  participationId: string;          // BROTE-XXX, PLANT-XXX, SIN-XXX
  role: string;
  status?: 'pending' | 'confirmed' | 'waitlist';  // default 'confirmed'
  attribution?: AttributionTouch;
  externalPaymentId?: string;
  priceCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  referralNote?: string;
  communicationOptIns?: string[];   // override defaults for non-site signups
}

interface RecordParticipationResult {
  personId: bigint;
  participationId: string;
  created: boolean;         // true if new insert, false if UPDATE (waitlist promotion) or idempotent no-op
  promoted: boolean;        // true if waitlist → confirmed
}
```

Behavior, all in a single Postgres transaction:

1. Upsert person by email (`INSERT ... ON CONFLICT (email) DO UPDATE`):
   - If new: set `first_seen = NOW()`, `first_touch = attribution`, `communication_opt_ins` from caller or default.
   - If existing: update `name`, `phone`, `instagram` only if current values are null/empty. Never touch `first_seen`, `first_touch`, `communication_opt_ins`.
2. Upsert participation:
   - If `(person_id, event_id)` exists with `status='waitlist'` and caller wants `status='confirmed'`: UPDATE to confirmed, fill payment fields, preserve original `attribution` and `referral_note`. Set `promoted=true`.
   - If `(person_id, event_id)` exists with any other status: idempotent no-op (return existing id; `created=false, promoted=false`).
   - If no row exists: INSERT. `created=true`.
3. Commit.

Post-commit (outside transaction):
- Send Resend confirmation email (handler-specific template).
- Fire Meta CAPI event for BROTE only.
- Send Sinergia host-notification email (sinergia handler only).

If a post-commit side-effect fails, the participation still exists and retry logic can pick it up (matching today's BROTE `emailSent` flag semantics — which becomes a column on the participation or a check like `WHERE metadata->>'emailSent' IS NULL`).

Companion helpers in `src/lib/community.ts`:
- `upsertPerson(params)` — person-only, used by future admin endpoints.
- `promoteWaitlist(participationId, paymentInfo)` — thin wrapper for the promotion path, explicit for readability.
- `getPersonByEmail(email)` — returns person + all participations for drilldown.

## Capacity enforcement

Plant and Sinergia enforce capacity. Today this is a racy `GET counter → compare → INCR`. Under Postgres, enforce with row-level locking on the event:

```typescript
// Inside recordParticipation transaction, BEFORE the participation insert:
if (event.capacity != null) {
  // Lock the event row so concurrent writers serialize on it.
  const locked = await tx.execute(
    sql`SELECT capacity FROM events WHERE id = ${eventId} FOR UPDATE`
  );
  const count = await tx.execute(
    sql`SELECT COUNT(*)::int AS n FROM participations
        WHERE event_id = ${eventId}
          AND status IN ('confirmed', 'used')`
  );
  if (count.n >= locked.capacity) {
    throw new CapacityReachedError(eventId);
  }
}
```

Handlers translate `CapacityReachedError` to HTTP 409 with the existing `{ ok: false, full: true }` shape.

Waitlist rows don't count toward capacity. Waitlist promotion runs inside the same locked transaction — if capacity is still available, UPDATE to confirmed; otherwise return a "still full" signal to the handler.

## Read paths

All read endpoints move from Redis key scans to SQL queries. Representative examples:

```sql
-- Community size
SELECT COUNT(*) FROM people;

-- Attendees for an event
SELECT p.name, p.email, pa.role, pa.status, pa.date, pa.referral_note
FROM participations pa
JOIN people p ON p.id = pa.person_id
WHERE pa.event_id = $1
ORDER BY pa.created_at;

-- Ticket lookup by id (gate scanner)
SELECT pa.*, p.email, p.name, e.name AS event_name
FROM participations pa
JOIN people p ON p.id = pa.person_id
JOIN events e ON e.id = pa.event_id
WHERE pa.id = $1;

-- All people with at least 2 participations (retention signal)
SELECT p.email, p.name, COUNT(pa.id) AS event_count
FROM people p
JOIN participations pa ON pa.person_id = p.id
GROUP BY p.id
HAVING COUNT(pa.id) >= 2
ORDER BY event_count DESC;

-- Unresolved referrals queue
SELECT pa.id, pa.referral_note, p.name AS participant_name, p.email, e.name AS event_name
FROM participations pa
JOIN people p ON p.id = pa.person_id
JOIN events e ON e.id = pa.event_id
WHERE pa.referral_note IS NOT NULL
  AND pa.referred_by_person_id IS NULL
ORDER BY pa.created_at DESC;

-- Referral leaderboard
SELECT referrer.name, referrer.email, COUNT(pa.id) AS referrals
FROM participations pa
JOIN people referrer ON referrer.id = pa.referred_by_person_id
GROUP BY referrer.id
ORDER BY referrals DESC;
```

## Admin endpoints

### Existing endpoints (rewritten to query Postgres)

- `GET /api/admin/metrics` — preserve response shape; source counts from SQL.
- `GET /api/admin/community` — preserve response shape including derived flags (`hasBrote`, `hasPlant`, `hasSinergia`, `sinergiaCount`, `lastSinergia`, `journey`).
- `GET /api/admin/registrations` — return plant participations (joined with person for email/name).
- `GET /api/admin/tickets` — return BROTE participations.
- `GET /api/brote/attendees` — return BROTE event attendees (Bearer auth preserved).
- `POST /api/brote/validate` — actions `check`, `use`, `redeem-coffee`. `use` sets `status='used'` and `used_at`. `redeem-coffee` sets `metadata.coffeeRedeemed=true, coffeeRedeemedAt=NOW()`.
- `POST /api/admin/actions` — keep `fix-campaign-log` unchanged (campaign logs stay in Redis); rewrite `plant-resend-email` and `export-csv` to query Postgres.
- `POST /api/sinergia/admin` — rewrite `migrate-to-first-session` to `UPDATE participations SET event_id = $new WHERE event_id = $old`, preserve erratum email logic (including the `sinergia:rsvp:{id}:erratum-sent` Redis flag — it stays in Redis). Rewrite `send-erratum` to source name from `people` table.

### New endpoints for referral reconciliation + ops

All use `requireAdminSession(req)` auth. Designed to be agent-callable via a future MCP layer that wraps the session.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/participations` | Query params: `eventId`, `status`, `referralUnresolved=true`, `personId`, `limit`, `offset`. Returns paginated list with joined person + event fields. |
| `PATCH` | `/api/admin/participations/:id` | Body: `{ referredByPersonId?, referralNote?, status?, role?, metadata? }`. Validates status against CHECK. |
| `POST` | `/api/admin/participations/:id/promote` | Promote waitlist → confirmed. Body: `{ externalPaymentId?, priceCents?, currency? }`. |
| `GET` | `/api/admin/people/search` | Query: `q` (min 2 chars). Fuzzy match on name (ILIKE) and email prefix. Returns top 20. |
| `GET` | `/api/admin/people/:id` | Full profile + all participations (joined with events) + memberships. |
| `PATCH` | `/api/admin/people/:id` | Body: `{ name?, phone?, instagram?, language?, tags?, notes?, communicationOptIns?, optedOutAt? }`. |

## Migration strategy — single-deploy cutover

Replaces the 4-phase Redis dance in the original draft. Safe because:
- All destructive Redis deletions happen in the final phase, 30+ days after cutover.
- Old Redis keys stay readable during the soak window as a safety net.
- Volume is tiny (~130 records). Migration script runs in seconds.
- BROTE 2026-03-28 is in the past, so no live ticketing traffic during cutover.

### Phase 1 — Infra (Day 1, ~0.5 day)

1. Create a Neon project via the Neon console (free tier).
2. Install the Neon Vercel integration so Preview deploys get branch databases. In Vercel project settings → Integrations → Neon → connect.
3. From Neon console, copy the pooled and unpooled connection strings.
4. In Vercel → Project → Settings → Environment Variables, set for Production, Preview, and Development:
   - `DATABASE_URL` = pooled connection string
   - `DATABASE_URL_UNPOOLED` = unpooled connection string
5. Pull env vars locally: `vercel env pull .env.local`.
6. Install deps: `npm install drizzle-orm @neondatabase/serverless && npm install --save-dev drizzle-kit`.
7. Create `drizzle.config.ts`:
   ```typescript
   import type { Config } from 'drizzle-kit';
   export default {
     schema: './src/db/schema.ts',
     out: './src/db/migrations',
     dialect: 'postgresql',
     dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
   } satisfies Config;
   ```
8. Create `src/db/index.ts`:
   ```typescript
   import { drizzle } from 'drizzle-orm/neon-serverless';
   import { Pool } from '@neondatabase/serverless';
   import * as schema from './schema';

   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   export const db = drizzle(pool, { schema });
   ```
9. Create `src/db/schema.ts` matching the DDL above, then `npx drizzle-kit generate` + `npx drizzle-kit migrate`.
10. Verify: connect to Neon via psql, confirm tables exist and `CREATE EXTENSION citext` ran.

### Phase 2 — Helpers (Day 2, ~1 day)

1. Install test runner (Vitest preferred): `npm install --save-dev vitest`. Add `"test": "vitest"` to `package.json` scripts.
2. Write `src/lib/community.ts`:
   - `recordParticipation()` — see Write paths section
   - `upsertPerson()`
   - `promoteWaitlist()`
   - `getPersonByEmail()`
3. Unit tests against a Neon dev branch or local Postgres (Docker):
   - Create person (new), verify `first_seen`/`first_touch` set.
   - Create person (existing), verify `first_seen` not updated.
   - Record participation (new), verify row.
   - Record participation (duplicate), verify idempotent.
   - Record participation (waitlist → confirmed), verify UPDATE and `promoted=true`.
   - Capacity enforcement: two concurrent writes when capacity=N and current count=N-1, verify one succeeds one gets `CapacityReachedError`.
   - Opt-in defaults on new person signups.

### Phase 3 — Migration script (Day 3, ~0.5 day)

Write `scripts/migrate-redis-to-postgres.ts`. Run via `npx tsx scripts/migrate-redis-to-postgres.ts [--dry-run]`.

**Script contract:**

- Connects to Redis (read-only) using `REDIS_URL` and Postgres using `DATABASE_URL_UNPOOLED`.
- `--dry-run` flag: logs all planned writes, executes nothing.
- Wraps the entire migration in a single Postgres transaction. Rollback on any error.
- Idempotent: uses `ON CONFLICT DO NOTHING` (on `participations.id` and `events.id`) and `ON CONFLICT (email) DO UPDATE` on `people` (updating missing fields only). Safe to re-run.
- Reports counts: events seeded, people inserted/updated, participations inserted per type, waitlist entries migrated, duplicates skipped.

**Step 1: seed events.**

| Event ID | Type | Series | Name | Date | Capacity | Status | Metadata |
|---|---|---|---|---|---|---|---|
| `brote-2026-03-28` | `brote` | null | `BROTE — 28 de marzo 2026` | `2026-03-28T20:00:00-03:00` | from `src/data/brote.ts` if available | `past` | `{}` |
| `plant-2026-04` | `plant` | null | `Plantación Abril 2026` | actual date from `src/data/brote.ts` `plantConfig` | from `plantConfig.capacity` | `past` or `upcoming` based on date vs today | `{}` |
| `sinergia-{YYYY-MM-DD}` | `sinergia` | `sinergia` | `Sinergia — {formatted date}` | `{YYYY-MM-DD}T19:30:00-03:00` | from `sinergiaConfig.capacity` | `past` / `upcoming` based on date | `{}` |

Sinergia sessions are discovered by:
```typescript
const sessionKeys = await redis.keys('sinergia:session:*');
// Filter out :counter and :rsvps sub-keys; match /^sinergia:session:\d{4}-\d{2}-\d{2}$/
```

**Step 2: seed organizations.**

| Slug | Name | Type | Notes |
|---|---|---|---|
| `un-arbol` | `Un Árbol` | `ngo` | Tree-planting partner for BROTE |
| `cima` | `CIMA` | `partner` | Partner org (seeded; no CRUD in this spec) |

Additional orgs from future discovery stay out of this migration.

**Step 3: migrate BROTE tickets → participations.**

Source: `KEYS brote:ticket:*`.

| Old field | → New column / location |
|---|---|
| `id` | `participations.id` |
| `paymentId` | `participations.external_payment_id` |
| `buyerEmail` | `people.email` (upsert), FK via `people.id` → `participations.person_id` |
| `buyerName` | `people.name` (on new person only) |
| `status: "valid"` | `participations.status = 'confirmed'` |
| `status: "used"` | `participations.status = 'used'` |
| `createdAt` | `participations.date`, `participations.created_at` |
| `usedAt` | `participations.used_at` |
| `emailSent` | `participations.metadata.emailSent` |
| `coffeeRedeemed` | `participations.metadata.coffeeRedeemed` |
| `coffeeRedeemedAt` | `participations.metadata.coffeeRedeemedAt` |
| (hardcoded) | `participations.event_id = 'brote-2026-03-28'` |
| (hardcoded) | `participations.role = 'attendee'` |
| (hardcoded) | `participations.buyer_person_id = participations.person_id` |
| `price_cents`, `currency` | **null** (MP stores these, not our records; leave null for existing) |

Attribution for existing BROTE tickets: none available. `participations.attribution = NULL`, `people.first_touch = NULL` for these.

**Step 4: migrate plant registrations → participations.**

Source: `KEYS plant:registration:*`.

| Old field | → New column / location |
|---|---|
| `id` | `participations.id` |
| `email` | `people.email` (upsert) |
| `name` | `people.name` (on new person only) |
| `status: "registered"` | `participations.status = 'confirmed'` |
| `createdAt` | `participations.date`, `participations.created_at` |
| `groupType` | `participations.metadata.groupType` |
| `carpool` | `participations.metadata.carpool` |
| `message` | `participations.metadata.message` |
| `utm.source` | `participations.attribution.source` (+ `people.first_touch.source` if this is their first participation) |
| `utm.medium` | `participations.attribution.medium` |
| `utm.campaign` | `participations.attribution.campaign` |
| (hardcoded) | `participations.event_id = 'plant-2026-04'` |
| (hardcoded) | `participations.role = 'planter'` |

`attribution.capturedAt` = `createdAt` for migrated records.

**Step 5: migrate plant waitlist → participations (status=waitlist).**

Source: `SMEMBERS plant:waitlist`.

Each entry has only `{email, createdAt}`. For these:
- Upsert person by email (set `name = email` if no name known — admin can fix later).
- INSERT participation with:
  - `id` = `PLANT-WL-${nanoid(8).toUpperCase()}` (deterministic from email hash to stay idempotent on re-runs — use `PLANT-WL-${sha1(email).slice(0,8).toUpperCase()}`)
  - `event_id = 'plant-2026-04'`
  - `role = 'planter'`
  - `status = 'waitlist'`
  - `date` = `createdAt`

**Step 6: migrate Sinergia RSVPs → participations.**

Source: `KEYS sinergia:rsvp:*` (filter out `:erratum-sent` suffix).

| Old field | → New column / location |
|---|---|
| `id` | `participations.id` |
| `email` | `people.email` (upsert) |
| `name` | `people.name` (on new person only) |
| `sessionDate` | `participations.event_id = sinergia-{sessionDate}` |
| `staysForDinner` | `participations.metadata.staysForDinner` |
| `status: "registered"` | `participations.status = 'confirmed'` |
| `createdAt` | `participations.date`, `participations.created_at` |
| (translated) | `participations.role = 'rsvp'` (was `'participant'` in old model) |

**Step 7: preserve lazy-link data.**

The old `community:person:{email}` records had manually added BROTE participations via lazy-link. Any `participations` from those that don't have a corresponding `brote:ticket:*` record are orphans — they should already be covered by Step 3 (the canonical ticket records). Verify by: for each `community:person`, count `participations[].event === 'brote'` entries and compare to `brote:ticket:*` count for the same email. Mismatch → log a warning; do not auto-create.

**Step 8: set opt-ins on all migrated people.**

All migrated `people` rows get `communication_opt_ins = '{email:transactional,email:marketing}'`, `opted_out_at = NULL`.

**Step 9: report.**

```
Events seeded:          {n}
People upserted:        {n inserted, m updated}
BROTE participations:   {n}
Plant participations:   {n}
Sinergia participations:{n}  (across {m} sessions)
Waitlist participations:{n}
Orgs seeded:            {n}
Duplicates skipped:     {n}
Warnings:               {n}  (see log)
```

Run against a dev Neon branch first, spot-check 3-5 records across each type, then run against prod.

### Phase 4 — Cutover PR (Day 4, ~1 day)

One PR that:
1. Rewrites `recordParticipation` calls into:
   - `src/app/api/brote/webhook/route.ts` (keep MP HMAC verification, Resend send, Meta CAPI fire — only replace the Redis write section)
   - `src/app/api/brote/register/route.ts` (both full-registration branch and `action: "waitlist"` branch)
   - `src/app/api/sinergia/rsvp/route.ts`
2. Rewrites admin read endpoints to query Postgres, preserving response shapes exactly.
3. Rewrites `src/app/api/brote/validate/route.ts`:
   - `check`: `SELECT * FROM participations WHERE id = $1`. Returns `{valid: status in ('confirmed','pending'), status, coffeeRedeemed: metadata->>'coffeeRedeemed', ticket: {id, type='ticket', buyerName=person.name, status, coffeeRedeemed}}`.
   - `use`: if status='used' → return `already_used` error. Otherwise `UPDATE participations SET status='used', used_at=NOW() WHERE id=$1`.
   - `redeem-coffee`: if `metadata->>'coffeeRedeemed' = 'true'` → error. Otherwise `UPDATE participations SET metadata = jsonb_set(jsonb_set(metadata, '{coffeeRedeemed}', 'true'), '{coffeeRedeemedAt}', to_jsonb(NOW()::text)) WHERE id=$1`.
4. Rewrites `src/app/api/sinergia/admin/route.ts`:
   - `migrate-to-first-session`: `UPDATE participations SET event_id = $new WHERE event_id = $old`. Keeps the erratum email loop + `sinergia:rsvp:{id}:erratum-sent` Redis flags (transport concern).
5. Adds new admin endpoints under `src/app/api/admin/participations/*` and `src/app/api/admin/people/*`.
6. Updates `src/app/api/brote/counter/route.ts` and `src/app/api/brote/plant-counter/route.ts` to `SELECT COUNT(*)`.
7. **Leaves old Redis keys untouched** — they become read-only fallback during soak.
8. Does NOT touch: `/api/brote/checkout`, `/api/brote/cima`, `/api/brote/qr-checkout`, `/api/brote/unarbol`, `/api/brote/plant-messages`, `/api/sinergia/next-session`, `/api/sinergia/send-reminders` (update reminders in a follow-up), campaign logs, flyer route.

Handler rewrite contracts (response shapes MUST remain identical):

| Endpoint | Old response key | New source |
|---|---|---|
| `POST /api/brote/webhook` | `{ok: true, ticketId}` | `recordParticipation().participationId` |
| `POST /api/brote/register` (waitlist) | `{ok: true, waitlisted: true}` | same after recordParticipation with status='waitlist' |
| `POST /api/brote/register` (register) | `{ok: true, registrationId, remaining}` | `recordParticipation().participationId` + computed remaining |
| `POST /api/brote/register` (idempotent) | `{ok: true, alreadyRegistered: true, registrationId, remaining}` | detect `created=false && promoted=false` |
| `POST /api/sinergia/rsvp` | `{ok: true, rsvpId, sessionDate, remaining}` | analogous |
| `POST /api/brote/validate` | existing shapes per action | per above |

### Phase 5 — Deploy + smoke test (Day 5, ~0.5 day)

1. Run `scripts/migrate-redis-to-postgres.ts --dry-run` against prod Neon. Review output.
2. Run without `--dry-run`. Confirm counts match expectations (~95 BROTE tickets, ~29 plant registrations, N Sinergia RSVPs).
3. Merge + deploy cutover PR.
4. Smoke test with a personal test email (NOT `h.solaas1@gmail.com` if that's in prod data — use a fresh one):
   - `POST /api/brote/register` with `action: "waitlist"` → expect `{ok: true, waitlisted: true}`; verify `participations` row with `status='waitlist'`.
   - `POST /api/brote/register` full registration → expect `{ok: true, registrationId, remaining}`; verify row promoted to `status='confirmed'`.
   - `POST /api/sinergia/rsvp` with a future Wednesday → expect `{ok: true, rsvpId, ...}`; verify `events` row created if new session, `participations` row with `role='rsvp'`.
   - `GET /api/admin/metrics` → counts match migrated data.
   - `GET /api/admin/community` → returns people with derived flags.
   - `GET /api/admin/participations?referralUnresolved=true` → empty (no referrals captured yet).
   - `POST /api/brote/validate` with a known ticket id → `check`/`use`/`redeem-coffee` flow.
5. Monitor Vercel + Neon dashboards for errors over 24h.

### Phase 6 — Soak (30 days, passive)

Monitor for errors. Old Redis keys stay as emergency fallback. If a regression appears, the cutover PR can be reverted without data loss (handlers fall back to Redis keys that are still correct for pre-cutover data).

### Phase 7 — Cleanup (Day 35, ~0.5 day)

1. Export full Redis snapshot to a local encrypted file (JSON dump).
2. Run `scripts/cleanup-deprecated-redis.ts`. The script deletes:
   - All `brote:ticket:*`, `brote:attendees`, `brote:counter`
   - All `plant:registration:*`, `plant:registrations`, `plant:counter`, `plant:waitlist`
   - All `sinergia:rsvp:*` (excluding `:erratum-sent` flags)
   - All `sinergia:session:*` (excluding `:erratum-sent` sub-keys if any)
   - All `community:person:*`

   Retains:
   - `brote:payment:*`, `brote:checkout:*`, `brote:unarbol:*`
   - `plant:campaign:*`
   - `sinergia:rsvp:*:erratum-sent`
   - Any rate-limit state (in-memory anyway)

3. Script should require explicit `--execute` flag; default is dry-run.

## Rollback strategy

| Phase | Rollback |
|---|---|
| 1 (Infra) | Revert Vercel env vars. Neon project can sit idle or be deleted. |
| 2 (Helpers) | No production impact yet. |
| 3 (Migration script) | Re-runnable; `--dry-run` first. |
| 4 (Cutover PR) | Revert PR, redeploy. Old Redis keys are untouched, handlers work as before. |
| 5 (Deploy) | Same as 4. |
| 6 (Soak) | Same as 4 for 30 days. Pre-Phase-7 is the last cheap rollback point. |
| 7 (Cleanup) | Requires Redis snapshot restore. Export is a hard precondition. |

## Dev environment

**Recommended: Neon branching.**

- Create a personal dev branch: `neonctl branches create --name hari-dev` (or via Neon console).
- Set `DATABASE_URL` in `.env.local` to the branch's pooled URL.
- Reset branch any time via CLI or Neon console.

**Alternative: local Postgres via Docker.**

```bash
docker run --name hari-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev -d postgres:16
# Then in .env.local:
# DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
# DATABASE_URL_UNPOOLED=postgres://postgres:dev@localhost:5432/postgres
npx drizzle-kit push
```

`MOCK_REDIS=1` pattern stays available for the Redis keys we keep (MP idempotency, Un Árbol, rate limits).

## Open questions

1. **Same person, multiple emails.** If someone signs up with `a@x.com` and later with `b@y.com`, they're two `people` rows. The surrogate `id` makes a future merge endpoint straightforward (update all FKs from old id → new id, delete old row). Not in this spec; adds as a `POST /api/admin/people/:id/merge` later.

2. **Fuzzy name matching for referrals.** "Coni" could be Constanza, Constance, two different Conis. Resolution is manual (or agent-assisted) via the admin endpoints. No auto-match logic.

3. **Backup / PITR.** Neon free tier has 24h point-in-time recovery. If we want 7 days, upgrade to $19/mo Pro. Revisit after 3 months of running.

4. **Materialized views for metrics.** If dashboard metrics ever get expensive (they won't at this scale for years), consider a materialized view refreshed hourly. Not a v1 concern.

5. **`buyer_person_id` backfill for existing BROTE tickets.** Set to same as `person_id` during migration (buyer == attendee under the current one-ticket-per-buyer model).

## Acceptance criteria

- [ ] Neon Postgres project provisioned with pooled + unpooled URLs set on Vercel (Prod/Preview/Dev).
- [ ] Drizzle schema matches the DDL above. First migration applied cleanly; `citext` extension enabled.
- [ ] `recordParticipation`, `upsertPerson`, `promoteWaitlist`, `getPersonByEmail` implemented with unit tests. Test runner (Vitest) wired into `package.json`.
- [ ] Capacity enforcement test passes under concurrent writes.
- [ ] Migration script runs in `--dry-run` mode without errors. Real run completes in <30 seconds and produces expected row counts.
- [ ] `events` table contains: `brote-2026-03-28`, `plant-2026-04`, and one `sinergia-{date}` row per distinct Sinergia session discovered in Redis.
- [ ] `organizations` table contains `un-arbol` and `cima` rows.
- [ ] All existing BROTE tickets, plant registrations, and Sinergia RSVPs are represented as `participations` rows with correct `event_id`, `role`, `status`, `metadata`, and attribution where available.
- [ ] Plant waitlist entries exist as `participations` rows with `status='waitlist'`.
- [ ] Sinergia role is translated from `'participant'` to `'rsvp'`.
- [ ] BROTE webhook, plant register, and Sinergia RSVP handlers all write via `recordParticipation`. Response shapes preserved. Meta CAPI fires preserved. Resend send preserved. Rate limits preserved.
- [ ] Gate validator supports `check`, `use`, `redeem-coffee` actions against `participations` table.
- [ ] Admin read endpoints return the same response shapes as before the migration.
- [ ] `/api/sinergia/admin` `migrate-to-first-session` action runs `UPDATE participations SET event_id` under the new model; erratum email flow preserved.
- [ ] New admin endpoints for referral reconciliation exist and pass session auth.
- [ ] `/api/brote/counter` and `/api/brote/plant-counter` return SQL-sourced counts.
- [ ] After 30-day soak, deprecated Redis keys can be safely deleted with no data loss.
- [ ] No handler writes to `brote:attendees`, `plant:registrations`, `sinergia:session:*:rsvps`, or `community:person:*` anymore.
