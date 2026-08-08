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
- **`tsconfig.json` excludes `**/*.test.ts`**, so `npx tsc --noEmit` does not
  typecheck test files. Type errors there only surface under vitest.
- **A worktree has no `node_modules`** — `npm ci` before anything.

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

## Browser verification

- **The automation tab is throttled to zero `requestAnimationFrame` frames.**
  That freezes framer-motion reveals mid-fade and makes `scroll-behavior: smooth`
  never complete, so a screenshot can look like a rendering bug that does not
  exist. Set `document.documentElement.style.scrollBehavior = 'auto'` before
  scrolling, and confirm rAF liveness (with a `setTimeout` escape — an unbounded
  rAF loop will hang the renderer and time out CDP) before believing a frozen
  animation is real.
