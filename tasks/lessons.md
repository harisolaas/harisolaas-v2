# Lessons — codebase-wide

Facts about *this repo and its environment* that cost a cycle to learn. Not
programme-specific notes; those live in each programme's PROGRESS.md.

## Testing

- **Never run bare `npm test` in a worktree.** Several suites are DB-backed
  (`src/lib/community.test.ts`, `links-db`, `override-link`, `plant-reminder`,
  `email-verification-server`, `src/app/api/admin/**`) and need a `DATABASE_URL`.
  Run only the suites you own, by path.
- **The DB suites share one Neon dev branch, so CI can red spuriously.** Two runs
  minutes apart will trip over each other with foreign-key errors like
  `Key (id)=(…) is still referenced from table "participations"`. Before treating
  a red `Build + lint + test` as a regression, check whether the failures are all
  DB suites and whether the diff can even reach them. `vitest.config.ts` already
  serialises within a run; it cannot serialise *across* runs.
- **A fixture deleted only in the test body poisons the branch permanently.**
  The delete never runs when the test fails first, and the next run dies on the
  duplicate key *before* reaching its own cleanup — so no re-run can ever clear
  it, for any PR in the repo. Cleanup goes in `beforeAll`/`afterAll`, and matches
  on a column you control rather than a server-generated id.
  Full runbook: [`docs/ops/test-database.md`](../docs/ops/test-database.md).
- **`tsconfig.json` excludes `**/*.test.ts`**, so `npx tsc --noEmit` does not
  typecheck test files. Type errors there only surface under vitest.
- **A worktree has no `node_modules`** — `npm ci` before anything.
- **CI is serialised repo-wide** (`concurrency: ci-shared-neon-branch` in
  `ci.yml`). Every run shares one Neon dev branch and the DB suites seed
  fixtures under fixed ids, so overlapping runs delete each other's rows
  mid-test. `maxWorkers: 1` serialises *within* a run and cannot help. Before
  running a DB suite locally, check `gh run list --workflow=ci.yml --limit 2`
  is idle — a local run collides with CI exactly the same way.
- **A green suite is not evidence a sink is wired.** Extracting a helper and
  testing the helper proves nothing about the call site: deleting the call
  can leave everything green. Every new sink needs one test that fails when
  the call is removed — for routes, that means a test file per route, and
  `validate/route.ts` had none at all until 2026-08.
- **Never chain `gh pr merge` with `git push --delete` in one command.** If the
  merge doesn't complete, the delete still runs, GitHub closes the PR as
  *closed* rather than *merged*, and the work is only recoverable from the
  local branch. Merge, verify `main` moved, then delete.
- **A hand-built `Request` omits headers the browser always sends, and that can
  make a test pass on a path production never takes.** `buildAttribution`
  returns a touch when *any* field is present — `referer` included — and a
  same-origin `fetch()` always sends one. So a route test whose `Request` has
  no `referer` exercises the "no attribution at all" branch, while production
  only ever takes the "attribution present but no linkSlug" one. A guard
  written `!attribution` instead of `!attribution?.linkSlug` passed the whole
  suite and would have left every invited BROTE sale with `link_slug` null.
  **When a test drives a route with a synthetic Request, ask which headers the
  real caller sends** (`referer`, `cookie`, `user-agent`) and put them in.
- **Feed one component's real output into the next, not a hand-written
  fixture.** The BROTE checkout writes a Redis stash the webhook reads. A test
  that hands the webhook a fixture cannot catch the shape drifting (flat vs.
  nested under `attribution:`) — the failure both halves are most likely to
  have. Making the webhook test consume the string the checkout actually wrote
  is what killed that mutation.
- **A `Record<K, V>` indexed with an untrusted string answers `constructor`,
  `toString` and `__proto__` with something truthy off `Object.prototype`.**
  Use `Object.hasOwn` when the key comes off a request.
- **A Next page with no dynamic API is prerendered at build and cached with no
  revalidate**, which freezes anything time-dependent it renders — a price
  tier, a countdown, an "open/closed" state. `export const dynamic =
  "force-dynamic"` fixes it, and the build's route table is the proof: `ƒ` is
  dynamic, `○` is static.

## Environment

- **`.env.local` points at PRODUCTION** (Redis, MercadoPago, Resend). A fresh
  worktree has none; keep it that way and never copy it in to make a suite pass.
- **`next build` needs `DATABASE_URL` even for unrelated work** — an admin route
  evaluates it at module scope during page-data collection. A throwaway
  `postgresql://build:build@127.0.0.1:5432/build` satisfies it without connecting
  to anything.
- **A Vercel preview can fail on a Google-Fonts 404 that has nothing to do with
  your diff.** `fonts.gstatic.com` returned 404 for Lora's `.woff2` files
  mid-build and Turbopack then reported 14× `Can't resolve
  '@vercel/turbopack-next/internal/font/google/font'` — which reads like a
  dependency problem and is not. GitHub Actions' `npm run build` passed on the
  same commit, and neighbouring PRs deployed minutes later. Redeploy rather
  than debugging the diff; the Vercel CLI here is scoped to a different team
  (`Error: Deployment belongs to a different team`), so re-trigger with a push.
- **Don't touch `.next` while a dev server runs** — it corrupts Turbopack and
  wedges the port. `lsof -i :3000` first; use a non-default port for throwaway
  servers so you can't collide with the owner's.

## Framework behaviour

- **`generateMetadata` returns the RAW object; `metadataBase` is applied later**,
  inside Next's `mergeMetadata` (`resolve-metadata.js`), which a unit test cannot
  reach. So `expect(url).toContain("og-card.png")` passes for both `/og-card.png`
  and `https://host/og-card.png` — it cannot kill the "hardcoded absolute host"
  mutation it looks like it kills. Assert the page's URL **starts with `/`** and
  the layout's `metadataBase` separately.
- **A child `openGraph` REPLACES the parent's — it does not merge**
  (`resolve-metadata.js:180-182` assigns straight through). Any page declaring
  `openGraph` must re-declare `title`/`description`/`siteName`/`locale`/`type`/
  `images` in full, or it silently inherits nothing and falls back to the
  site-wide card. Same for `twitter`.
- **`Metadata["robots"]` is `null | string | Robots`.** A guard written
  `robots?.index !== false` is blind to the string form `"noindex, nofollow"`,
  which has no `.index`. And a page's own metadata cannot see a `robots` set by
  an ancestor `layout.tsx`, so "is this page indexable?" needs a structural
  check too.
- **Never pair a robots.txt `Disallow` with a meta `noindex` on the same path.**
  A disallowed path is never fetched, so its `noindex` is never read, and the
  URL can still be indexed on the strength of inbound links. Pick `noindex`
  when the page has real inbound links (e.g. `/brote/gate`, linked from every
  ticket email).

## Testing the sink

- **Test where the code is *called*, not just what it returns.** Twice in one
  programme a unit's entire effect could be deleted with the suite green: the
  landing's five `<CollaboratorMention>` call sites, and the
  `<script type="application/ld+json">` block in `page.tsx`. Helper tests prove
  the values are right; they say nothing about whether anything uses them.
  - Client components: `renderToStaticMarkup(createElement(C, props))` —
    works in the node environment, no jsdom, no testing-library.
  - Async server pages: `await Page({ params: Promise.resolve({...}) })` and
    walk the returned element tree.
- **`vitest.config.ts` includes `src/**/*.test.ts` — NOT `.tsx`.** A `.test.tsx`
  file runs when you name it explicitly and is silently skipped by CI. Write
  these tests without JSX so they can be `.ts`.
- **`next/font/google` is a 0-byte stub in `node_modules`** (the real loader is
  a build-time SWC transform), so importing any page/layout under vitest throws
  `TypeError: Archivo is not a function`. `vi.mock("next/font/google", …)` must
  live **in the test file itself** — a setup module outside `src/` does not
  apply.
- **`next/image` auto-unoptimizes `.svg`** on the default loader
  (`next/dist/shared/lib/get-img-props.js`, Next 16). Neither an `unoptimized`
  prop nor `dangerouslyAllowSVG` in `next.config.ts` is needed — the file is
  served as-is, in dev and in prod. Local SVGs are free to use directly.
- **`/[locale]/*` pages are fully static prerenders.** Anything time-dependent
  (an early-bird deadline, a countdown) freezes into the HTML at build time and
  is only corrected on the client at hydration. Plan for that rather than
  assuming the server re-evaluates per request.

## Locale & copy

- **Dictionaries are `const es: Dictionary = {…}`**, so TypeScript excess-property
  checking (TS2353) already rejects a key left behind at any nesting depth. Never
  write a test that restates the compiler.
- **`(8250).toLocaleString()` yields `"8,250"`** — the resolved locale is `en-US`
  in this repo's Node. Always pass `"es-AR"` explicitly for prices, or Argentine
  users read a US-grouped number.
- **`es.ts` / `en.ts` have mixed encoding**: mostly `\uXXXX` escapes but some
  literal accented characters and em-dashes. A large find-and-replace across a
  section boundary will silently fail to match; edit in smaller chunks.
- **Testing "is the EN copy actually translated"**: compare fields pairwise for
  inequality against ES, with an explicit allowlist of things identical by design
  (numbers, URLs, handles, terms like "DJ set"). A grep for Spanish words is
  defeated by rewording; pairwise inequality is not, because rewording into
  English *is* the fix.

## Data model

- **BROTE tickets do NOT live in Redis** — they live in `people` +
  `participations`. `CLAUDE.md` is out of date on this; `BroteTicket` is only
  the shape the email template consumes. Redis holds idempotency keys and
  short-lived stashes, nothing durable.
- **`people` is the cross-event identity table.** The same row backs Sinergia
  RSVPs, plant registrations and every bulk-email audience. Changing
  `people.email` or `people.phone` from one event's flow reaches all of them.
- **`people.email` is `citext` with a unique index**, so uniqueness is already
  case-insensitive — no need to lowercase to *compare*. Do normalize what you
  *store*, so the persisted form doesn't depend on which code path got there
  first.
- **`participations` has a PARTIAL unique on `(person_id, event_id)`**
  (`WHERE role <> 'companion'`). One buyer can hold several tickets for one
  event; the extras are `companion` rows sharing an `external_payment_id`,
  with `buyer_person_id` recording who paid. Re-pointing `personId` can still
  violate it for non-companion rows.
- **`recordParticipation` is NOT deduplicated by that index — it is
  deduplicated by a row lock.** Its person upsert holds `ON CONFLICT (email)
  DO UPDATE` on `people` until commit, so same-person calls serialise there
  and the later ones short-circuit on the existing-row SELECT. Verified: three
  concurrent transactions with *no* unique constraint still produce one row.
  The corollary is what matters — a writer that does NOT touch the `people`
  row (like `addCompanionTickets`) inherits none of that protection, and needs
  its own: deterministic ids plus `ON CONFLICT (id) DO NOTHING`.
- **A batch INSERT shares one `created_at`.** All rows get the transaction
  timestamp, so `ORDER BY created_at, id` really orders by `id` — and if the
  ids are hash-derived that is a *different* sequence from the one they were
  created in. Anything that numbers a group for a human (ticket 2 of 3) must
  order by an explicit stored position, not by time. Costs half of all
  3-item groups otherwise.
- **`BROTE_EVENT_ID` does not exist on the Neon dev branch.** A helper that
  closes over it is untestable; take `eventId` as a parameter. DB-backed tests
  create their own synthetic event and clean up by email prefix.

## Mutation testing

- **Mutating `schema.ts` proves nothing about an index.** Drizzle does not
  enforce index definitions at runtime and the DB suites hit a real database,
  so an index mutation has to be applied as real DDL. Do it in one transaction
  with a `trap` that restores — the dev branch is shared with every PR's CI.
- **A test that passes against the unfixed code is not a test.** Two in one
  programme: one passed because the row it asserted on happened to be
  physically first in the heap (an `UPDATE` rewrites the tuple to the end and
  it went red), another because the fixture ids sorted the same way under
  every candidate ordering. Both were caught by mutation, neither by review.
- **A surviving mutant is a finding either way.** Sometimes the test is weak;
  sometimes the mutation is genuinely harmless and the *reason* is worth
  writing down (drizzle compiles `inArray(col, [])` to `where false`, so the
  empty-batch guard is defensive rather than load-bearing). Record which one
  it is instead of adding a test to make the table look clean.

## Drizzle / Postgres

- **Drizzle does not rethrow the pg error — it wraps it.** `DrizzleQueryError`
  has `code: undefined`; the real code lives on `cause`. `if (err.code ===
  "23505")` silently never matches, so any race handler written that way is
  dead code. Walk the `cause` chain, and pin it with a test that provokes a
  real violation — a driver upgrade can move it again.
- **The jsonb `||` merge is shallow.** It replaces the whole top-level key
  rather than deep-merging: writing `{a:{x:1}}` over `{a:{y:2}}` loses `y`.

## Email

- **The Resend SDK does not throw on API errors** — it returns `{data, error}`.
  Success means *both*: no `error`, and an id in `data`. Getting this wrong
  cost 19 undelivered emails on 2026-04-19 (documented in `bulk-email.ts`) and
  came back through a second door in the BROTE ticket email. Any idempotency
  flag stamped after "send" inherits the bug.
- **The email builders interpolate without escaping.** `plant-email.ts`,
  `brote-email.ts`, `bulk-email.ts` and `sinergia-email.ts` have no
  `escapeHtml`; `brote-verification-email.ts` does. Escape anything
  user-supplied before it reaches the HTML.

## MercadoPago

- **All three flows share `MP_ACCESS_TOKEN` and `MP_WEBHOOK_SECRET`.** Each
  stamps its own `metadata.type`, and the webhook *must* check it — otherwise a
  payment from another flow delivered to the wrong URL issues the wrong thing.
- **What MP returns on the back_url is unverified in this repo.** Sinergia only
  proves `external_reference` reaches the `Payment` object server-side. Don't
  hang anything on the return query string without a real payment — and if
  something sensitive goes there anyway, remember `capture_pageview` ships the
  whole `$current_url` to PostHog.
- **The SDK types `additional_info.items[].quantity` as `number`; the REST
  payment response returns a string.** Coercion there is load-bearing, not
  defensive — without it every multi-ticket purchase silently issues one.
- **Multiply `quantity`, never `unit_price`.** Both charge the same total, but
  multiplying the price shows "1 × $74.250" at MercadoPago and tells the
  webhook nothing about how many tickets to issue.
- **Deduplicated Meta events must agree.** The browser `fbq` and the server
  CAPI event share an `event_id`; if only one multiplies the basket, the
  surviving event reports whichever arrived first.
- **`auto_return: "approved"` only auto-redirects approved payments.** A cash
  payment sits pending for days and the buyer has to click "volver al sitio";
  many never do.

## Analytics

- **PostHog captures `$current_url` including the query string.** Any credential
  in a URL (verification codes, capability tokens) is exported to a third party.
  `analytics.ts` has a `sanitize_properties` redaction list — **add to it** when
  you introduce a sensitive param. Note a param strip done in a child
  component's `useEffect` runs *after* the layout-level PostHog effect, so it
  does not help.

## CI

- **CI does not run on stacked PRs.** `.github/workflows/ci.yml` triggers on
  `pull_request: branches: [main]`; a PR targeting another branch gets only the
  Vercel checks. Merging the parent re-points the base and CI then runs. If you
  stack, plan the merge order and say so in the PR.
- **CI runs `npm run build`**, which type-checks Next's route types.
  `tsc --noEmit` is not equivalent — it does not see
  `.next/types/validator.ts`, which references every route. After deleting a
  route, `rm -rf .next` before trusting a local typecheck.
- **`vitest.config.ts` forces `MOCK_REDIS=1`** for the whole suite, so a test
  cannot reach the production Redis that `.env.local` points at. Email and
  MercadoPago have no equivalent guard — mock those explicitly.
- **Copilot may not attach.** The REST POST with the `[bot]` suffix sometimes
  returns 200 with `requested_reviewers` empty. It usually comments a few
  minutes later anyway — check `/pulls/{n}/comments` before giving up.

## Browser verification

- **The automation tab is throttled to zero `requestAnimationFrame` frames.**
  That freezes framer-motion reveals mid-fade and makes `scroll-behavior: smooth`
  never complete, so a screenshot can look like a rendering bug that does not
  exist. Set `document.documentElement.style.scrollBehavior = 'auto'` before
  scrolling, and confirm rAF liveness (with a `setTimeout` escape — an unbounded
  rAF loop will hang the renderer and time out CDP) before believing a frozen
  animation is real.
