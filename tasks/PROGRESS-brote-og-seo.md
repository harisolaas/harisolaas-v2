# PROGRESS — BROTE: OG card, SEO pass, collaborator links

Spec: `tasks/brote-og-seo-colaboradores.md` (revision 2, post plan-review)
Worktree: `.claude/worktrees/iridescent-popping-cupcake`

**Every spawned agent reads this file first.**

## Merged

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| — | — | nothing yet | — |

## Queue

| # | Unit | Branch | Base | State |
|---|---|---|---|---|
| U1 | OG card + canonical host + indexing | `brote-og-seo` | `origin/main` | in progress |
| U2 | `Event` JSON-LD | `brote-jsonld` | U1 (stacked) | queued |
| U3 | Collaborator links on the landing | `brote-colaboradores` | `origin/main` | queued |
| U4 | Collaborator links in emails | `brote-email-links` | `origin/main` | queued |
| U5 | Correct `CLAUDE.md` | `brote-docs` | `origin/main` | queued |

## Blocked

| Item | Waiting on | Asked |
|---|---|---|
| U4 day-of lineup times (19:45/21:30 vs landing's 20:00/21:15) | Owner confirmation of the final running order | not yet — raise before U4 |
| DoD #3: FB Sharing Debugger re-scrape | Owner, post-deploy | owner checklist |
| All merges | Explicit "ship"/"mergealo" — site is live | per PR |

## Hard-won constraints

One line each. Violating these costs a full PR cycle.

- **Branch off `origin/main`, never local `main`** — local is 13 commits behind
  (`ae7556d` vs `fcae93f`) and predates `bcf68d1`, which deleted the edition-1
  partner pages. Branching off it resurrects deleted files.
- **`origin/main` moved mid-programme to `b6b6a31` (#68, "invitación para quienes
  ya vinieron").** Re-fetch before every unit. It changed U3's exact surface:
  a sixth slug `comunidad` with `kind: "community"` and **no handle**; `handle`
  is now **optional**; and **`instagramUrl()` now returns `string | null`**.
  Any `collaboratorNameUrl` must therefore be `string | null`-aware, and the
  Instagram chip must not render for handle-less entries.
  `brandInvitations()` returning exactly 3 still holds — `comunidad` is
  `kind: "community"`, not `"brand"`.
- **`next/font/google` is a 0-byte stub in `node_modules`** — the real thing is a
  build-time SWC transform. Any vitest file importing a page/layout must
  `vi.mock("next/font/google", …)` **in the test file itself**; a setup file
  outside `src/` does not apply. Symptom: `TypeError: Archivo is not a function`.
- **`generateMetadata` returns the raw object** — `metadataBase` resolution happens
  in Next's `mergeMetadata` and is unreachable from a unit test. Assert
  "url starts with `/`" and "layout's `metadataBase` is www" separately; a single
  "ends with the filename" assertion kills no mutation.
- **A child `openGraph` REPLACES the parent's** (`resolve-metadata.js:180-182`,
  straight assignment). Declare the full block or silently lose inherited fields.
- **Never pair robots.txt `Disallow` with meta `noindex`** — a disallowed path is
  never fetched, so its `noindex` is never read, and it can still be indexed
  URL-only. `/brote/gate` has real inbound links (`brote-ticket-email.ts:54`).
- **`src/proxy.ts:21` redirects `/brote/gate` → `/es/brote/gate`**, so a bare
  `/brote/gate` robots rule would match nothing anyway.
- **Never run bare `npm test`** — DB suites need `DATABASE_URL` and share a Neon
  branch. Run owned suites by path.
- **`next build` needs `DATABASE_URL`** — throwaway
  `postgresql://build:build@127.0.0.1:5432/build`.
- **`tsconfig.json` excludes `**/*.test.ts`** — type errors in tests surface only
  under vitest, never `tsc --noEmit`.
- **`vitest.config.ts` `include: ["src/**/*.test.ts"]`** — both new test files are
  covered; nothing to register.
- **`es.ts`/`en.ts` have mixed encoding** (mostly `\uXXXX`, some literal accents).
  Wide find-and-replace silently fails to match; edit in small chunks.
- **`/[locale]/*` are static prerenders.** `BroteLanding.tsx:601-614` escapes this
  for price via `useEffect`; server-emitted JSON-LD cannot.
- **CI does not run on stacked PRs** (`pull_request: branches: [main]`).
- **Copilot may not attach** — check `/pulls/{n}/comments` before giving up.

## Carry-forward / backlog

| Item | Severity | Size | Trigger |
|---|---|---|---|
| `broteInvitacion.footer.right` ("Con Un Árbol") unlinked | low | S | if invitation pages get another copy pass |
| Shared `generateMetadata` helper — 5 hand-rolled blocks that have already drifted | med | M | next time a metadata bug is found |
| `PlantLanding` + `plant` dictionary block exist with no route mounting them | med | M | before the April plantación is promoted |
| `next.config.ts` `/brote-unarbol` redirect hardcodes `/es` for `en` visitors | low | S | if an EN partner link is ever handed out |
| Per-collaborator OG images for the five invitation pages | low | M | if collaborators report weak share CTR |
| `og-image.jpg` (site-wide) and `og-sinergia.png` have no `alt` | low | S | next metadata pass |

## Dispositions

_(Landing phase — every row that ever appeared in Blocked gets a terminal state here.)_
