# What's next — living follow-up log

This file is the entry point for picking up Spec 01/02/03 work between sessions. It's a working log, not a polished doc — update it as things move.

**Last updated: 2026-04-18** — Spec 01 shipped early in the day; Spec 03 (link builder) later that evening; Spec 02 (Comunidad dashboard) overnight. All three specs are LIVE on prod.

---

## Current state of the world

- **Spec 01 (Postgres migration): LIVE.** PR #1 squashed to `main` at commit `8d87ba1`. All handlers read/write Postgres via `src/lib/community.ts` → `recordParticipation()`.
- **Spec 02 (Dashboard): LIVE.** PR #7 squashed to `main` at commit `88c1532`. Rename to Comunidad, 4 tabs (Panorama / Personas / Eventos / Campañas), person + event drilldown drawers. Deferred: growth chart, activity feed, traffic lights, saved views, bulk CSV, merge-person. Old `DashboardShell.tsx` + its now-unused endpoints (`/community`, `/metrics`, `/registrations`, `/tickets`, `/actions`) are still in the tree — remove in a follow-up cleanup PR after the new shell soaks.
- **Spec 03 (Link builder): LIVE.** PR #3 squashed to `main` at commit `ad21ec7`. Postgres `links` + `link_clicks` tables, `/go/[slug]` redirect, admin UI at `/admin/links`, shared `buildAttribution` helper wired into plant register + Sinergia RSVP. Stale cookies (cookie slug → deleted link) are dropped inside the `recordParticipation` transaction so signups never FK-fail. Backfill ran against prod (1 link, 1 participation stamped).

### Infra snapshot

| Thing | Value |
|---|---|
| Neon project | `harisolaas` (id: `fragrant-dust-37772199`) |
| Neon prod branch | `production` → endpoint `ep-frosty-leaf-anyq9tgo` |
| Neon dev branch | `dev` → endpoint `ep-wandering-unit-anxrw3y7` |
| Neon snapshot | `pre-cutover-2026-04-18` (rollback target; keep until soak ends) |
| Redis provider | Redis Cloud (single DB, shared across prod/preview/dev) |
| CI | `.github/workflows/ci.yml` — lint + build + test on PRs |
| Branch protection | `main`: PR required, CI must pass, linear history, enforce on admins |
| GH Actions secrets | `DATABASE_URL_DEV`, `DATABASE_URL_UNPOOLED_DEV` set |

### Prod Postgres after migration

- 107 people
- 3 events: `brote-2026-03-28`, `plant-2026-04`, `sinergia-2026-04-22`
- 2 orgs: `un-arbol`, `cima`
- 122 participations (75 BROTE incl. 51 gate-used, 32 plant confirmed, 15 Sinergia confirmed)

---

## Rollout checklist — every spec

Every PR that adds a Drizzle migration or scripted data change must go through these steps before it's considered "shipped." Merging to `main` is *not* the end of the job.

1. **Merge PR.** Vercel auto-deploys code to prod.
2. **Apply migrations to prod.** Vercel's build does NOT run migrations. You have to do this manually:
   ```bash
   vercel env pull .env.local --environment=production
   npx drizzle-kit migrate
   vercel env pull .env.local --environment=preview    # switch back immediately
   ```
   Without this step, handlers will throw "relation … does not exist" against prod while dev tests happily pass.
3. **Run one-shot scripts** (backfills, cleanups) on prod while `.env.local` is still pointed there, then switch env back.
4. **Smoke test a user-facing flow** on the live site. Landing → signup → check the admin UI shows the new row. A 500 here would've caught Spec 03's missed migration immediately.
5. **Update NEXT.md**: mark the spec LIVE, record what migrated, note any residual TODOs.

### 🟥 Known incident — 2026-04-18

Spec 03's PR #3 merged to `main`, Vercel auto-deployed code, but the `0001_peaceful_bucky.sql` migration was never applied to the prod Neon branch. Creating a link via `/admin/links` surfaced as "Error de red" (HTML 500 page, `res.json()` threw, caught into the generic error message). Resolved by running `npx drizzle-kit migrate` against prod. Going forward, step 2 above is mandatory.

---

## Time-sensitive work

### 🟡 Now — watch the plant event (2026-04-19)

The plantación happens tomorrow. It's the first real-world traffic on the new Postgres write path.

- [ ] Monitor Vercel logs: `vercel logs --prod --follow` or the web console
- [ ] Watch `/api/admin/metrics` for anomalies
- [ ] Confirm gate-scan equivalent (if any plant-day check-in) works
- [ ] Check that the 32 migrated plant registrations all got their reminder email via `/api/sinergia/send-reminders` or whatever the plant reminder path is

### 🟡 ~2026-05-18 — end-of-soak Redis cleanup

30 days after cutover, delete the deprecated Redis keys. **Not yet automated** — script needs to be written.

**Preconditions before running:**
- [ ] Confirm Neon PITR retention still covers the last 24h
- [ ] Take a fresh Redis export to a local file as a belt-and-suspenders backup
- [ ] No outstanding issues from soak period

**Script to write: `scripts/cleanup-deprecated-redis.ts`**
- Default: dry-run mode
- Requires `--execute` flag to actually delete
- Deletes:
  - `brote:ticket:*`
  - `brote:attendees`
  - `brote:counter`
  - `plant:registration:*`
  - `plant:registrations`
  - `plant:counter`
  - `plant:waitlist`
  - `sinergia:rsvp:{id}` (but NOT the `:erratum-sent` suffix keys)
  - `sinergia:session:*` (including `:counter` and `:rsvps` sub-keys)
  - `community:person:*`
- Keeps:
  - `brote:payment:*` (MP idempotency)
  - `brote:checkout:*` (Meta CAPI 24h TTL)
  - `brote:unarbol:*` (discount codes)
  - `plant:campaign:*` (campaign audit logs)
  - `sinergia:rsvp:{id}:erratum-sent` (transport flag)
  - Rate-limit counters

Can also drop the `pre-cutover-2026-04-18` Neon branch at this point if nothing has regressed.

### 🟡 Before the next BROTE party

When the next BROTE party is scheduled (no date yet, probably late 2026):
- [ ] Create new event row: `INSERT INTO events (id, type, date, capacity, status, name) VALUES ('brote-YYYY-MM-DD', 'brote', ...)`
- [ ] Update `BROTE_EVENT_ID` constant in `src/app/api/brote/webhook/route.ts`, `src/app/api/brote/register/route.ts`, `src/app/api/brote/validate/route.ts`, `src/app/api/brote/admin/route.ts`, and related places
- [ ] Consider making the active BROTE event id configurable via env var or DB lookup so future events don't require code changes (deferred quality-of-life)

---

## Next specs — recommended order

Per `docs/specs/README.md`, dependency order is:

```
01 (done) ──┬──> 02 (dashboard)
            └──> 03 (link builder)
```

**Recommended: Spec 03 before Spec 02.** Reason: link builder is the single biggest analytical unlock; attribution data flowing into `participations.link_slug` (column already exists) makes Spec 02's dashboard materially richer. Doing 02 first risks rebuilding parts of it when 03 lands.

### Spec 03 — Link builder

- Spec: `docs/specs/03-link-builder.md`
- Creates `links` and `link_clicks` tables
- Adds FK constraint on `participations.link_slug → links.slug` (column already exists without FK per Spec 01 §Out-of-scope)
- In-admin UI to create + manage tracked short links

**Context an agent needs:**
- `participations.link_slug` already exists as nullable TEXT, no FK yet — Spec 03 adds the FK via migration
- BROTE webhook already captures `linkSlug` from `brote:checkout:{preferenceId}` stash if present — path exists but isn't used yet
- `src/data/links.ts` exists — might be partially relevant, re-read before designing

### Spec 02 — Dashboard

- Spec: `docs/specs/02-dashboard.md`
- Rename admin to "Comunidad"
- Tabs: Panorama, Personas, Eventos, Campañas
- Person drilldown, generic event handling, community metrics
- Most read endpoints already exist (`/api/admin/community`, `/api/admin/people/:id`, `/api/admin/participations`, `/api/admin/metrics`)

---

## Deferred from Spec 01 (schema ready, UX pending)

All of these have their tables + columns in place — no schema migration needed, only handler/UI work:

- **Membership / package purchase flow.** Tables: `packages`, `memberships`. Participations can link via `membership_id`. Trigger: when Sinergia 10-session passes go on sale. Work: MP checkout flow for package purchase, redemption logic that decrements `memberships.participations_used` on each Sinergia RSVP.
- **Phone-first / Instagram-first person creation.** `people.email` is already nullable with `CHECK (email OR phone OR instagram)`. Work: admin UI to create people from phone/IG alone. Needed when we start importing WhatsApp contacts.
- **Group ticket purchase UX.** `participations.buyer_person_id` column exists and defaults to `person_id`. Work: BROTE checkout form that accepts N attendee names/emails; buyer pays once, N participations created. Trigger: user demand (group purchase is a real scenario for BROTE parties).
- **Organizations admin CRUD.** Tables `organizations`, `person_organizations` exist with `un-arbol` and `cima` seeded. Work: admin UI to add/edit orgs, tag people with org membership, link events to sponsors. Trigger: when managing sponsor relationships becomes real work.
- **Outbound email language switching.** `people.language` exists (defaults `'es'`). Work: update Resend email templates to read the column and render the right language. Trivial change, mostly about updating templates.

---

## DevOps backlog

Flagged during spec 01 work, not blocking:

- **Resend dev API key + from-address.** Currently all envs share the same Resend key; only from-address separates prod from preview (actually we haven't even done that — see below).
- **Resend from-address for non-prod.** Currently Preview/Dev use the same `brote@harisolaas.com` as prod. Risk: preview deploy sends an email that looks like prod. Low but nonzero.
- **MP sandbox credentials.** Skipped per user call ("not charging RN"). Set up when we're back to charging for tickets.
- **Second Redis for non-prod.** Redis Cloud free tier is single-DB only. Options: upgrade to paid ($5/mo+), migrate to Upstash (free multi-DB), or accept shared Redis across envs.
- **Off-box pg_dump backup.** Skipped per user call — Neon's 24h PITR is enough for now. Revisit when data becomes non-reconstructable (tags, referrals, notes from Spec 02).
- **Neon Pro ($19/mo) for 7-day PITR.** Not needed now. Revisit after 3 months of prod use or when data grows.

---

## Known quirks / tech debt

- **Lint rule downgraded.** `react-hooks/set-state-in-effect` is `warn` instead of `error` (see `eslint.config.mjs`). 7 components (PlantLanding, DashboardShell, BroteLanding, others) trip it without actual bugs. Revisit when those get a refactor pass.
- **GitHub Actions Node 20 deprecation.** `actions/checkout@v4` and `actions/setup-node@v4` currently run Node 20. Deprecated 2026-09-16 per GitHub. Bump before then.
- **Duplicate BROTE tickets.** 18 buyers purchased multiple BROTE tickets. Migration kept only the first participation per (person, event) — the rest are listed in migration warnings but no separate ticket rows. If we ever need to re-create those as separate participations (e.g. for a split-refund), the source data is still in Redis until Phase 7 cleanup. Future group-ticket purchase UX (`buyer_person_id` ready) avoids this.
- **2 corrupt BROTE records** in Redis (`BROTE-N6VYBGQQ`, `BROTE-RRLSW91D`) with missing email/id. Unmigratable. Will be swept up by the Phase 7 cleanup script.
- **Vercel Preview deploys hit prod Redis.** `REDIS_URL` is shared across scopes because Redis Cloud free tier is single-DB. Preview writes to entity keys are fine (Redis keys are deprecated anyway) but MP webhook idempotency state is shared, which means a preview deploy could theoretically process a live MP webhook. In practice this doesn't happen because MP only talks to the prod URL.
- **`casing: "snake_case"` on Drizzle client.** Must be passed to both `drizzle-kit` config AND the `drizzle()` constructor (see `src/db/index.ts`). If new schema files are added and they break at runtime, this is usually why.
- **Tests serialized via `maxWorkers: 1`.** `vitest.config.ts` forces single-worker execution because tests share a DB. If test suite grows, consider per-test schema cleanup or a DB-per-file pattern.

---

## Quick-reference commands

```bash
# Set up local env (points at Neon dev branch)
vercel env pull .env.local --environment=preview

# Run tests (hits Neon dev branch)
npm test

# Generate a new migration after schema.ts changes
npx drizzle-kit generate

# Apply migrations to whichever DB .env.local points at
npx drizzle-kit migrate

# Dry-run / execute the Redis → Postgres migration
npx tsx scripts/migrate-redis-to-postgres.ts --dry-run
npx tsx scripts/migrate-redis-to-postgres.ts --execute

# Switch local env to prod (for a prod-targeted migration run only)
vercel env pull .env.local --environment=production
# REMEMBER to switch back after:
vercel env pull .env.local --environment=preview

# Neon branch ops
npx neonctl branches list --project-id fragrant-dust-37772199
npx neonctl branches create --project-id fragrant-dust-37772199 --name foo --parent production
npx neonctl connection-string foo --project-id fragrant-dust-37772199 --pooled
```

---

## When this file needs updating

- A scheduled item above is completed → check it off, move to "done" list or delete
- A new deferred item emerges during spec 02/03 work → add to "Deferred from Spec 01" (rename section if needed)
- The infra snapshot changes (new services, env vars) → update table
- A spec gets picked up → update "Current state of the world" to reflect in-flight work
