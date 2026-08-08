# PROGRESS — BROTE landing redesign

Spec: `tasks/brote-landing-redesign.md`
Branch: `worktree-piped-finding-avalanche`

**Every spawned agent reads this file first.**

## Complete — awaiting the owner's merge decision

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| U1 | [#54](https://github.com/harisolaas/harisolaas-v2/pull/54) | Line up merge (3 asymmetric blocks), counter simplified, single-block pricing, new "¿Qué incluye tu entrada?", `currentTicketPrice()` single-sourcing | **Plan review:** post-preventa would have shown $24.750 while charging $33.000 from Aug 13 (D1). **Candidate table:** C1 passed all 15 tests — the savings assertion blessed a hardcoded value. **PR review:** three sections lost their `<h2>`; group opacity dimmed the closed-state buy button to 2.5:1. **Copilot:** the flag-free photo fallback, resolved a third way after the suggested `onError` proved worse. |

PR is green and both review cycles are addressed. **Not merged** — `CLAUDE.md` requires an explicit "ship"/"mergealo" and the site is live.

## Queue

Empty. One-unit programme by revert boundary (argument in the spec).

## Blocked

Empty — see Dispositions.

## Hard-won constraints

Each line below cost a probe to learn. Violating one costs a full cycle.

- **No `node_modules` in this worktree.** `npm ci` before any check.
- **No `.env.local` here — keep it that way.** The real one points at **production**
  Redis / MercadoPago / Resend. `vitest.config.ts` loads it if present.
- **Never run bare `npm test`.** Three suites (`src/lib/community.test.ts`,
  `src/lib/links-db.test.ts`, `src/app/api/admin/**`) hit the DB. Run only:
  `npx vitest run src/data/brote.test.ts src/dictionaries/dictionaries.test.ts`
- **`tsconfig.json` excludes `**/*.test.ts`** — `npx tsc --noEmit` does not typecheck
  test files. Type errors there surface only under vitest.
- **`next/image` needs no `unoptimized` for SVG.** Next 16 auto-unoptimizes any `.svg`
  on the default loader (`get-img-props.js:263`). Adding the prop is a no-op; adding
  `dangerouslyAllowSVG` to `next.config.ts` is unnecessary.
- **Dict excess-property checking works.** `const en: Dictionary = {…}` errors TS2353
  on a stale key at any nesting depth. Do not write tests that restate the compiler.
- **`dict.brote` has 4 consumers**, not 1: `brote/page.tsx` (`meta`),
  `brote/success/page.tsx` (`success`), `brote/failure/page.tsx` (`failure`),
  `BroteLanding.tsx` (everything else). `brote/flyer/page.tsx` imports no dictionary.
- **`(8250).toLocaleString()` → `"8,250"`** in this repo's Node (resolved `en-US`).
  Always pass `"es-AR"` explicitly for prices.
- **Don't touch `.next` while the owner's dev server runs.** `lsof -i :3000` first;
  `rm -rf .next` / `next build` corrupts Turbopack and wedges their port.
- **Do not push to `main`.** Site is live. `CLAUDE.md` requires an explicit
  "ship"/"mergealo" from the owner; a clean review is not approval.

## Carry-forward / backlog

| Item | Severity | Size | Trigger to revive |
|---|---|---|---|
| `src/app/brote/flyer/page.tsx:250,256` prints `earlyBirdPrice` + deadline unconditionally — after Aug 13 the flyer advertises a price that is no longer sold | med | S | Next time a flyer is generated, or right after the preventa closes |
| `TreeCounter.tsx` (227 lines) is dead — no importers since the BROTE 2 redesign | low | S | Any cleanup pass |
| `unArbolPrice` / `cimaPrice` in `src/data/brote.ts` are edition-1 values, already marked STALE in-file | med | S | Before reactivating the Un Árbol or CIMA discount flow |
| `earlyBirdUntil` / `earlyBirdClosed` hardcode "13 de agosto" in both dicts rather than interpolating `earlyBirdDeadlineDisplay` — a 3rd place the date must be kept in sync | low | S | Next time the deadline moves |

## Dispositions

Every row that ever appeared in Blocked, with a terminal state.

| Item | Disposition | Evidence / trigger |
|---|---|---|
| Musician photo for Line up block 02 | **Owner checklist** | Drop the file at `public/brote/lineup-acustico.jpg`. No code change and no flag — the dotted frame renders underneath and the photo covers it automatically. Both paths verified in-browser. Trigger: before the landing is pushed in ads. |
| Merge of PR #54 | **Owner checklist** | PR is green, both review cycles addressed, threads resolved. Trigger: owner says "ship"/"mergealo". |
| `npm run build` blocked by missing `DATABASE_URL` | **Done** | Ran with a throwaway `postgresql://build:build@127.0.0.1:5432/build`, which satisfies module-eval without touching prod. Build compiles and generates all 62 pages. |
| True 390px viewport check | **Done, with a stated limit** | The OS window would not shrink below ~1710px, so this was verified by constraining the `.brote-scope` container to 390px: zero overflowing elements across all four sections, includes grid collapses to one column. The grids are `auto-fit minmax()` (container-driven), so this is a faithful proxy — but it is a proxy, not a real 390px viewport. |
| Red CI on `414ba39` (closing-verdict blocker) | **Done** | Re-ran on `7025545`: `Build + lint + test` **pass, 2m16s**. The earlier red was 10 failures across five DB-backed suites with foreign-key collisions on the shared Neon dev branch, on a commit touching only a client component and a markdown file. Confirmed transient, not a regression. |
| Uncommitted `PROGRESS.md` (closing-verdict blocker) | **Done** | Committed in `7025545` with `tasks/lessons.md`; `git status` clean. |
| Reveal-on-anchor (`#incluye`) | **Done** | Hash load → `opacity: 1`, `scroll-margin-top` respected. Click path → observer fires, opacity leaves 0. The automation tab throttles rAF to zero frames, which freezes the fade mid-way; that is a harness artifact, confirmed by measuring rAF liveness directly. |
