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
- **A hand-built `Request` omits headers the browser always sends, and that can
  make a test pass on a path production never takes.** `buildAttribution`
  returns a touch when *any* field is present — `referer` included — and a
  same-origin `fetch()` always sends one. So a route test whose `Request` has
  no `referer` exercises the "no attribution at all" branch, while production
  only ever takes the "attribution present but no linkSlug" one. A guard
  written `!attribution` instead of `!attribution?.linkSlug` passed the whole
  suite and would have left every invited BROTE sale with `link_slug` null —
  the exact count a partner fee is paid from, silently zero. **When a test
  drives a route with a synthetic Request, ask which headers the real caller
  sends** (`referer`, `cookie`, `user-agent`) and put them in, or the test
  pins the wrong branch.
- **Feed one component's real output into the next, not a hand-written
  fixture.** The BROTE checkout writes a Redis stash the webhook reads. A test
  that hands the webhook a fixture cannot catch the shape drifting (flat vs.
  nested under `attribution:`) — the failure both halves are most likely to
  have. Making the webhook test consume the string the checkout actually wrote
  is what killed that mutation.

## Environment

- **`.env.local` points at PRODUCTION** (Redis, MercadoPago, Resend). A fresh
  worktree has none; keep it that way and never copy it in to make a suite pass.
- **`next build` needs `DATABASE_URL` even for unrelated work** — an admin route
  evaluates it at module scope during page-data collection. A throwaway
  `postgresql://build:build@127.0.0.1:5432/build` satisfies it without connecting
  to anything.
- **Don't touch `.next` while a dev server runs** — it corrupts Turbopack and
  wedges the port. `lsof -i :3000` first; use a non-default port for throwaway
  servers so you can't collide with the owner's.

## Framework behaviour

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
- **`participations` has a unique on `(person_id, event_id)`.** Re-pointing
  `personId` can violate it.
- **`BROTE_EVENT_ID` does not exist on the Neon dev branch.** A helper that
  closes over it is untestable; take `eventId` as a parameter. DB-backed tests
  create their own synthetic event and clean up by email prefix.

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
