# Programme: BROTE landing redesign (primer CTA → abajo)

Source design plan: `~/.claude/plans/piped-finding-avalanche.md`
Handoff bundle: `~/Downloads/design_handoff_brote_redesign/`

## Definition of Done

This programme is finished when:

1. **U1 is merged** (or cut with a recorded reason) — the BROTE landing between the
   hero CTA and the Comunidad section matches the handoff, with the two owner-approved
   deviations (vertical media block, `solo/a` copy) implemented as decided.
2. `main` is green: `npx tsc --noEmit`, `npm run lint`, `npm run build` succeed, and
   `npx vitest run src/data/brote.test.ts src/dictionaries/dictionaries.test.ts` passes.
   (Scoped, not `npm test` — see the prereq table: the DB suites need a `.env.local`
   that points at production.)
3. The **browser verification checklist** in U1 has been executed against a running
   app on both `/es/brote` and `/en/brote`, with the `#incluye` anchor-jump reveal
   case explicitly confirmed — not inferred.
4. Every blocked item has a terminal disposition (Done / Backlogged / Owner checklist).
5. The handback is written.

**Explicitly out of scope** (any discovery here goes to backlog, not the queue):

- The hero, Comunidad, CTA final, footer — the handoff freezes them.
- Checkout flow, API routes, emails, DB schema, seeder. This unit reads no new
  columns, so per `CLAUDE.md` the seeder update is legitimately skipped.
- ~~Migrating the other duplicated `isEarlyBird` call sites.~~ **Amended by plan review:**
  there are 3 duplicated computations total (landing, `brote/checkout/page.tsx:66`,
  `api/brote/checkout/route.ts:105`) — the flyer has none, it prints the early-bird
  price unconditionally. U1 now adopts the helper in **all three**, because the
  displayed-vs-charged price drift is exactly the defect found in review (see U1/D1);
  single-sourcing is what makes it unrepeatable. The flyer's unconditional price stays
  backlogged.
- Deleting the now-dead `TreeCounter.tsx`.
- The `unArbolPrice` / `cimaPrice` staleness already flagged in `src/data/brote.ts`.

**Not a merge gate:** a clean review is not approval to merge. `CLAUDE.md` requires an
explicit "ship"/"mergealo" from the owner. The site is live.

---

## Prerequisites / access

| Prereq | State |
|---|---|
| Illustration SVGs (`~/Downloads/assets/ilustraciones/`) | ✅ present — all 4, incl. `brote-ticket-riso.svg` |
| Musician photo for block 02 | ❌ **BLOCKED** — attached to chat only, never landed on disk |
| Dev server / browser for verification | claude-in-chrome available; check `lsof -i :3000` first |
| GitHub CLI for PR + review cycle | assumed available (repo uses it per `docs/ops/pr-review.md`) |
| `node_modules` in this worktree | ❌ absent — `npm ci` before any check can run |
| `.env.local` in this worktree | ❌ absent. **Leave it absent.** `vitest.config.ts` loads it, and per project memory the real `.env.local` points at **production** Redis / MP / Resend. Three DB-touching suites (`src/lib/community.test.ts`, `src/lib/links-db.test.ts`, `src/app/api/admin/**`) need it — so run **only** the two suites this unit owns: `npx vitest run src/data/brote.test.ts src/dictionaries/dictionaries.test.ts`. A bare `npm test` is not a gate here. |
| `tsconfig.json` excludes `**/*.test.ts` | So `npx tsc --noEmit` will **not** typecheck the new test file. Type errors in tests surface only when vitest runs them. |

### The blocked photo — downgrade, stated as numbered facts

1. The owner chose "bloque 02 con foto vertical" and attached a 9:16 photo to the chat.
2. Chat attachments are not on the filesystem; I cannot write it there myself.
3. U1 therefore implements `LineupMedia` with a **file-presence branch**: if
   `public/brote/lineup-acustico.jpg` exists it renders `<Image>`; otherwise it renders
   the handoff's dotted placeholder frame.
4. The swap is one file drop — no code change, no layout change. Same container also
   accepts `<video autoPlay muted loop playsInline>` per the handoff's requirement.
5. If the file has not landed by merge time, this becomes an **owner checklist item**
   with the trigger "before the landing is promoted in ads", not a pending block.

---

## Unit U1 — the redesign

### Revert-boundary argument (why this is one PR, not four)

**Must-preserve dict subtrees** (plan review, amendment 1): `dict.brote` is read by four
files, not one. `brote/page.tsx:35` reads `meta`, `brote/success/page.tsx` reads
`success`, `brote/failure/page.tsx` reads `failure`. None of the deleted keys live in
those subtrees, so the restructure is still safe — but `meta`, `success` and `failure`
must survive it untouched. (`brote/flyer/page.tsx` imports no dictionary at all.)

The dict type, the component, and the assets are a single atomic change: `Dictionary`
is a shared typed literal, so the moment `experience[]` / `impact.heading` /
`pricing.includesItems` are removed from `types.ts`, both `es.ts` and `en.ts` and
`BroteLanding.tsx` must move in the same commit or `tsc` fails. There is no ordering
that leaves `main` compiling with the change half-applied.

Splitting by *section* was considered and rejected: shipping "¿Qué incluye tu entrada?"
before the pricing rewrite would put a new includes section directly under a pricing
block that still carries its own "Incluye" column — duplicated content on a **live**
ticket-selling page. A broken intermediate state on a live site is worse than a
larger diff. Reverting U1 restores the current landing exactly.

### Files

| File | Change |
|---|---|
| `src/dictionaries/types.ts` | Restructure `BroteDict`; drop `BroteExperienceItem`, `BroteLineupItem` |
| `src/dictionaries/es.ts` | New copy, literal from the handoff |
| `src/dictionaries/en.ts` | EN mirror (handoff is ES-only — hand-written) |
| `src/data/brote.ts` | Add tested `isEarlyBird()`, `currentTicketPrice()`, `earlyBirdSavings()` |
| `src/app/api/brote/checkout/route.ts` | Adopt `currentTicketPrice()` (replaces the inline formula at :105-108) — see D1 |
| `src/app/[locale]/brote/checkout/page.tsx` | Adopt `isEarlyBird()` (replaces the inline formula at :66) — see D1 |
| `src/components/BroteLanding.tsx` | Replace `#experiencia` + `#lineup` → one `#lineup`; simplify `#impacto`; rewrite `#precio`; add `#incluye`; `BlockHeader` + `LineupMedia`; `ctaButton` gains `invert` |
| `src/app/globals.css` | `prefers-reduced-motion` guard on `scroll-behavior` |
| `public/brote/*.svg` ×4 | Illustrations (SVG, not PNG — transparent, ~2 KB vs 70–160 KB with baked green) |
| `src/data/brote.test.ts` | **new** |
| `src/dictionaries/dictionaries.test.ts` | extend with brote section |

Full layout/copy spec: see the design plan. It is not duplicated here.

---

### D1 — post-preventa price row (found by plan review; NOT in the handoff)

The handoff specifies the dead state as cosmetic only: lose the green fill, `opacity:
0.55`, hide the `-25%` badge, swap two labels. It says nothing about the **price row**.
Implemented literally, from **Aug 13** (5 days away) the block would show a headline
`$24.750` struck-through against `$33.000`, plus "Es el precio de hoy. Ahorrás $8.250"
— while `api/brote/checkout/route.ts` charges `33000`.

Today's three-column layout hides this by accident: it keeps a full-opacity
"General $33.000" column. Collapsing to one block deletes that column, so the bug is
one this unit would *introduce*. It is in scope.

**Required behaviour:**

| | Preventa (`isEarlyBird`) | Post-preventa |
|---|---|---|
| Headline price | `earlyBirdPrice` | `ticketPrice` |
| Struck anchor price | `ticketPrice`, diagonal bar | **none** — nothing to anchor against |
| `savingsLine` | shown | **hidden** |
| `generalNote` | shown | **hidden** |
| Badge `-25%` | shown | hidden |
| Label / deadline | `earlyBirdLabel` / `earlyBirdUntil` | `earlyBirdExpired` / `earlyBirdClosed` |

**Single-sourcing is the fix, not just the branch.** Add `currentTicketPrice(now?)` to
`src/data/brote.ts` returning `{ raw, display, isEarlyBird }`, and have the landing,
the checkout page, and the checkout API all derive from it. A displayed price and a
charged price that are computed in two places will drift again; one function cannot.
The API change is a pure substitution of an identical formula, covered by T2/T6.

---

### Tests — must be red before implementing

The project has **no component-rendering harness** (all existing tests are pure-logic
`src/lib/*` plus `dictionaries.test.ts`). Adding `@testing-library/react` + jsdom to
assert markup would be new infrastructure serving tests that mostly pin JSX shape.
So the tested surface is the pure logic and the dictionary contract; the visual and
motion behaviour is a browser check, recorded below as a binding manual gate.

#### T1 — `src/data/brote.test.ts` · `earlyBirdSavings()`

- Returns `"$8.250"` for the current config. **Red-for-the-right-reason:** a naive
  `(8250).toLocaleString()` yields `"8,250"` under an en-US default ICU — the assertion
  fails on the comma, which is the actual defect (an Argentine user reading a
  US-grouped price).
- Cross-check: the derived savings equals `ticketPriceRaw - earlyBirdPriceRaw`, **and**
  `ticketPrice` / `earlyBirdPrice` display strings parse back to their `*Raw` twins.
  This pins the live drift bug where someone edits the display string and not the raw.

#### T2 — `src/data/brote.test.ts` · `isEarlyBird(now)`

- `true` at `2026-08-13T23:59:59-03:00`; `false` at `2026-08-14T00:00:00-03:00`.
- **UTC trap:** `2026-08-14T01:00:00Z` is still 22:00 on the 13th in Argentina →
  must be `true`. A helper written with `new Date(deadline)` and no offset fails here.
  This is the over-restriction archetype: the wrong gate closes preventa ~3h early
  and silently drops the discounted price on a live ticket page.

#### T6 — `src/data/brote.test.ts` · `currentTicketPrice()` — displayed == charged (D1)

- During preventa → `{ raw: 24750, display: "$24.750", isEarlyBird: true }`.
- After the deadline → `{ raw: 33000, display: "$33.000", isEarlyBird: false }`.
- `display` and `raw` agree with each other on both sides (parse the display string
  back to digits) — this is the assertion that would have caught D1.
- The API route and the landing must both call this helper; verified by the reviewer
  reading the diff, since a test cannot see a call site it does not execute.

#### T3 — `dictionaries.test.ts` · brote structure & parity, both locales

- New subtrees exist: `lineup.{timeRange,welcome,live,dj}`, `includes.items` (exactly 3)
  + `includes.featured`, `impact.counterLabel`, and the new `pricing` keys.
- No empty/whitespace-only string anywhere under `brote`.
- `lineup.dj.link.url` is a valid `https://` Instagram URL and is **identical** across
  locales (a URL is not translated — divergence is a typo).

#### T4 — `dictionaries.test.ts` · interpolation tokens

- `pricing.savingsLine` contains the literal `{savings}` token and `pricing.generalNote`
  contains `{price}`, in **both** locales.
- After filling with the known value set, **no `{…}` token remains** in any brote
  pricing string.
- **Why non-vacuous:** this is the null-implementation trap. If the component hardcodes
  `"$8.250"` instead of calling the helper, the dict loses its token and the first
  assertion goes red. If the dict keeps a token the component never fills, a literal
  `{savings}` renders on a live payment page — the second assertion goes red.

#### T5 — `dictionaries.test.ts` · EN is actually translated

For each new copy field, `en !== es`. Excludes proper nouns and URLs
(`lineup.dj.link.*`, artist names, `timeRange`), which legitimately match.

**Why this shape and not a Spanish-word grep:** a grep for `"venís"` is the *rename*
archetype — defeated by rewording while still leaving untranslated copy. Field-wise
inequality catches the actual failure (an es block copy-pasted into `en.ts`) and
cannot be defeated by rewording, because rewording into English *is* the fix.

#### Cut from scope, with reasons

| Proposed test | Cut because |
|---|---|
| Removed dict keys are absent from `en.ts` | Both dicts are `const x: Dictionary = {…}`, so TS excess-property checking already rejects a stale key. A test would restate the compiler. |
| Snapshot / render test of `BroteLanding` | No harness; would pin JSX and prose, not behaviour. |
| Asserting `clamp()` strings or style objects | Pins the implementation. A wrong-but-passing value is invisible to it; the browser check is the real gate. |
| Grepping the component for `solo/a` | Pins prose, explicitly named as vacuous by the skill. |
| Unit-testing the `#incluye` reveal | Would exercise framer-motion + a mocked IntersectionObserver, i.e. test the library. Browser gate instead (B3). |

---

### Candidate table (wrong implementations — fill column 3 after implementing)

| # | Wrong implementation | Which assertion catches it | Re-run vs finished code? |
|---|---|---|---|
| C1 | **Null impl** — `earlyBirdSavings()` exported but pricing line hardcodes `"$8.250"` | T4 (dict loses `{savings}`) | pending |
| C2 | **Over-restriction** — `isEarlyBird` built on `new Date(deadline)` with no `-03:00`; preventa closes ~3h early, live page shows the dead state | T2 UTC-trap case | pending |
| C3 | **Over-restriction, inverted** — `!isEarlyBird` branch swapped; the *primary conversion surface* renders greyed at 0.55 opacity during preventa | T2 + browser gate B2 | pending |
| C4 | **Rename** — a Spanish-word grep passes after rewording, EN copy still Spanish | T5 (field-wise inequality, undefeatable by rewording) | pending |
| C5 | ~~`<Image>` + SVG needs `unoptimized`~~ — **deleted by plan review.** `next/dist/shared/lib/get-img-props.js:263` auto-sets `unoptimized` for any `.svg` on the default loader. Probed against next@16.1.6 with this repo's config: served as-is, no `_next/image` proxy, in dev *and* prod. The failure mode does not exist. | — | n/a |
| C6 | **Ordering accident** | N/A — nothing concurrent or order-dependent in this unit. Recorded, not fabricated. | n/a |
| C7 | **Stale display, live charge (D1)** — post-preventa branch changes only the styling; headline stays `earlyBirdPrice` while the API charges `ticketPriceRaw` | T6 (`display`↔`raw` agreement across the deadline) | pending |
| C8 | **Helper drift** — `currentTicketPrice()` written with semantics subtly different from the inline formula it replaces in the checkout API (e.g. `<` instead of `<=` at the deadline second) | T2 boundary case at `23:59:59-03:00` | pending |

C7 is the one that costs money rather than pixels, which is why D1 is in scope despite
being absent from the handoff.

### Binding manual gates

- **B2** — Pricing block renders green/active during preventa; then temporarily set
  `earlyBirdDeadline` to a past date and confirm the **D1 table** holds — headline
  `$33.000`, no strikethrough, no savings line, no general note — then **revert**.
- **B3** — Click "¿Qué incluye tu entrada? ↓" from the pricing block: `#incluye` must
  be visible, not stuck at `opacity: 0`. Repeat with a direct load of `/es/brote#incluye`.
  This is the exact failure the handoff warns about; framer's `useInView` is believed
  to handle it, but belief is not the gate.
- **B4** — 390px viewport: the three Line up blocks collapse full-width without
  horizontal overflow.
- **B5** — Both `/es/brote` and `/en/brote`.

Before any of this: `lsof -i :3000`. If the owner's dev server is running, do **not**
`rm -rf .next` or run `next build` against that tree — it corrupts Turbopack and wedges
their port (recorded in memory from a prior incident).

---

## Queue

1. **U1** — the redesign (above). Blocked-but-downgradeable on the photo.

That is the whole queue. This is a one-unit programme by revert boundary, not by
under-planning; the argument is recorded above.
