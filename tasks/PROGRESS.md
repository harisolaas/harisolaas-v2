# PROGRESS — BROTE landing redesign

Spec: `tasks/brote-landing-redesign.md`
Branch: `worktree-piped-finding-avalanche`

**Every spawned agent reads this file first.**

## Merged

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| — | — | — | — |

## Queue

1. **U1 — the redesign.** Single unit by revert boundary (argument in spec). In progress.

## Blocked

| Item | Waiting on | Asked | Downgrade |
|---|---|---|---|
| Musician photo for Line up block 02 | Owner to drop the file at `public/brote/lineup-acustico.jpg` — it was attached to chat, which is not the filesystem | 2026-08-08, at plan time | `LineupMedia` renders the handoff's dotted placeholder when the file is absent; swap is a file drop, no code change |

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

_(Landing phase — every row that ever appeared in Blocked gets a terminal state here.)_
