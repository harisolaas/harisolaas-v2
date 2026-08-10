# PROGRESS — BROTE: OG card, SEO pass, collaborator links

Spec: `tasks/brote-og-seo-colaboradores.md` (revision 2, post plan-review)
Worktree: `.claude/worktrees/iridescent-popping-cupcake`

**Every spawned agent reads this file first.**

## Merged

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| — | — | nothing merged yet — site is live, awaiting owner's "mergealo" | — |

## Complete, awaiting merge decision

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| U1 | [#70](https://github.com/harisolaas/harisolaas-v2/pull/70) | `og-brote-v2.png` (edition-1 card said "28 de marzo"); self-canonical + hreflang on `/brote`; `/brote` into the sitemap; www host everywhere; noindex on success/failure/gate/flyer | **Plan review:** robots.txt `Disallow` + meta `noindex` on the same path cancel each other, and the gate is linked from every buyer's email. A child `openGraph` *replaces* the parent's, so partial blocks drop inherited fields silently. **PR review:** four wrong implementations passed 15/15 green — `robots` as a *string* (no `.index`, so the guard was blind), an ancestor `[locale]/brote/layout.tsx`, the OG constant bumped without committing the asset, and the invitation page's `twitter.images` left on the deleted file. **Copilot:** the five invitation pages — the ones collaborators actually share — got a degraded card. |
| U3 | [#71](https://github.com/harisolaas/harisolaas-v2/pull/71) | Every collaborator linked (website on the name, Instagram on the chip); identity sourced from the registry, killing Gian's dead link at the cause; sponsors row gives Pulso its first public surface | **PR review:** no test rendered `BroteLanding`, so reverting all five call sites stayed 58/58 green; and unifying identity silently dropped the accent from "José" on the Spanish landing. **Copilot:** `BroteIncludesItem` allowed "neither `body` nor `mention`", which renders `undefined` silently. |
| U2 | [#74](https://github.com/harisolaas/harisolaas-v2/pull/74) | `Event` + `Place` + `Person[]` + two `Offer`s, from `broteConfig` | **PR review:** deleting the `<script>` from `page.tsx` left 56/56 green — the unit's entire effect, untested. Venue was hardcoded past `broteConfig.locationAddress`. `eventTime` and `eventStartTime`/`eventEndTime` were untied. **Copilot:** `PerformingGroup` is wrong for solo artists. |
| U4 | [#73](https://github.com/harisolaas/harisolaas-v2/pull/73) | Performers + Un Árbol + El Arte de Vivir linked in the ticket emails | **PR review:** swapping the two performers between run-of-show rows passed 6/6 green — the mail would have told every buyer Gian plays guitar. Verification-email footer was untested. |
| U5 | [#72](https://github.com/harisolaas/harisolaas-v2/pull/72) | `CLAUDE.md` corrected to edition 2; removed system deleted in `bcf68d1` | **Copilot:** `counter/` reads Postgres, not Redis — staleness missed by the PR whose whole job was removing staleness; and the doc described helpers that only exist after #70/#71, so it must merge last. |

## Queue

Empty — every unit has an open PR, reviewed and addressed. Merge order below.

| # | Unit | PR | Base | Merge after |
|---|---|---|---|---|
| U1 | OG card + canonical + indexing | [#70](https://github.com/harisolaas/harisolaas-v2/pull/70) | `main` | — |
| U3 | Collaborator links on the landing | [#71](https://github.com/harisolaas/harisolaas-v2/pull/71) | `main` | — |
| U2 | `Event` JSON-LD | [#74](https://github.com/harisolaas/harisolaas-v2/pull/74) | #70 | U1 |
| U4 | Collaborator links in emails | [#73](https://github.com/harisolaas/harisolaas-v2/pull/73) | #71 | U3 |
| U5 | Correct `CLAUDE.md` | [#72](https://github.com/harisolaas/harisolaas-v2/pull/72) | #71 | U1 **and** U3 — it documents `BROTE_OG_IMAGE` (U1) and the registry helpers (U3) |

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
- **`vitest.config.ts` includes `src/**/*.test.ts` — NOT `.tsx`.** A test named
  `.test.tsx` runs when named explicitly and is silently skipped by CI. Write
  component/page tests without JSX so they can be `.ts`.
- **Test the sink, not just the builder.** Twice in this programme a unit's
  whole effect could be deleted with the suite green: the landing's five
  `<CollaboratorMention>` call sites (U3) and the `<script type="application/
  ld+json">` block (U2). `renderToStaticMarkup` for client components, and
  awaiting the async page + walking its element tree for server ones — both
  work in the node environment with no jsdom.
- **A Vercel preview can fail on a Google-Fonts 404 that has nothing to do with
  the diff.** `fonts.gstatic.com` returned 404 for Lora's woff2 files mid-build
  and Turbopack then couldn't resolve `@vercel/turbopack-next/internal/font/
  google/font`. GitHub Actions' `npm run build` passed on the same commit, as
  did neighbouring PRs minutes later. Redeploy; don't debug the diff. The
  Vercel CLI in this repo is scoped to a different team, so re-trigger by push.
- **Copilot may not attach** — check `/pulls/{n}/comments` before giving up. On
  #70 both `reviewers[]=copilot-pull-request-reviewer[bot]` and
  `reviewers[]=Copilot` returned 200 with `requested_reviewers: []`, and
  `gh pr edit --add-reviewer Copilot` fails outright with
  `Could not resolve user with login 'copilot'`.
- **A test asserting `robots.index !== false` is blind to half the de-index
  spellings.** `Metadata["robots"]` is `null | string | Robots`; the string
  form `"noindex, nofollow"` has no `.index`. Normalise both, and remember an
  ancestor layout's `robots` is invisible from a page's own metadata object —
  it has to be asserted structurally.
- **`git checkout -- <file>` restores from the INDEX, not HEAD.** Running
  mutation candidates against unstaged work reverts the real implementation
  too. Stage the finished unit first, then mutate and revert freely.

## Carry-forward / backlog

### From the midpoint zero-context audit (all PRE-EXISTING — none introduced here)

Discovery does not become scope: these are documented, not fixed. The top three
are on the owner checklist because the event is 10 days out.

| Item | Severity | Size | Trigger |
|---|---|---|---|
| **`/api/brote/validate` is unauthenticated, and the ticket QR encodes the gate URL** — `brote-ticket-email.ts:53` encodes `/es/brote/gate?ticket=…`, so any camera pointed at any ticket gets a one-tap "Marcar como usado". Anyone can void an entry or burn its drink; `check` also returns `buyerName` for any ID | **HIGH** | M | **Before the door opens on 20/8** |
| **`/api/brote/confirm-contact` can overwrite `people.phone` for arbitrary emails** — `brote-contact.ts:106-163` picks the row by attacker-supplied email and re-points the participation; the `ct` token is never marked spent. WhatsApp is the day-of channel | **HIGH** | M | Before the day-of WhatsApp send |
| **The 35% collaborator discount is a guessable, uncapped string** — `{"invite":"pulso"}` to `/api/brote/checkout` pays 21.450. Six ordinary words, no referral proof, no expiry. Replaced the retired single-use Redis code system | MED-HIGH | M | Before the next collaborator push |
| Webhook's `if (paymentType && paymentType !== "ticket")` lets an *untagged* MP payment mint a real ticket; `transaction_amount` never checked against expected price | MED | S | Next webhook change |
| `MP_WEBHOOK_SECRET` missing ⇒ signature check returns `true` (fails open); `ts` freshness unchecked (replay); non-constant-time compare | MED | S | Next webhook change |
| `ct` capability token redacted for PostHog but shipped unredacted to `<Analytics />` (`layout.tsx:137`, no `beforeSend`) | LOW-MED | S | With the confirm-contact fix |
| `Bearer ${undefined}` authenticates admin routes when the env var is unset | LOW | S | Next admin change |
| Rate limiting is a per-instance `Map` — resets on cold start, never evicts; `validate` has none | LOW | M | If abuse appears |

### Discovered in flight

| Item | Severity | Size | Trigger |
|---|---|---|---|
| `broteInvitacion.footer.right` ("Con Un Árbol") unlinked | low | S | if invitation pages get another copy pass |
| Shared `generateMetadata` helper — 5 hand-rolled blocks that have already drifted | med | M | next time a metadata bug is found |
| `PlantLanding` + `plant` dictionary block exist with no route mounting them | med | M | before the April plantación is promoted |
| `next.config.ts` `/brote-unarbol` redirect hardcodes `/es` for `en` visitors | low | S | if an EN partner link is ever handed out |
| Per-collaborator OG images for the five invitation pages | low | M | if collaborators report weak share CTR |
| `og-image.jpg` (site-wide) and `og-sinergia.png` have no `alt` | low | S | next metadata pass |

## Dispositions

Every row that ever appeared in **Blocked**, with its terminal state. Nothing
in this programme remains "waiting".

| Item | Disposition | Evidence / trigger |
|---|---|---|
| U4 day-of lineup times (mail 19:45/21:30 vs landing 20:00/21:15) | **Owner checklist** | The spec's stated fallback was taken: links shipped, times untouched, TODO narrowed to name the discrepancy and greppable at `brote-email.ts:37`. Trigger: before the day-of reminder goes out on 20/8. A one-line change once the running order is confirmed. |
| DoD #3 — Facebook Sharing Debugger re-scrape | **Owner checklist** | Post-deploy and owner-only; no API available to this session. Trigger: immediately after #70 reaches production. |
| Google Rich Results Test for the `Event` node | **Owner checklist** | Same: needs the live URL. Trigger: after #74 reaches production. Verified locally that the emitted JSON-LD carries every field Google requires. |
| All merges | **Owner checklist** | `CLAUDE.md` requires an explicit "ship"/"mergealo" and the site is live. Five PRs green and mergeable; order stated above. |
| Copilot not attaching via the API | **Done** | Resolved itself — Copilot reviewed all five PRs and left 8 comments, every one addressed. The API's empty `requested_reviewers` was a false negative, now recorded in Hard-won constraints. |
| U1 Vercel deployment failure | **Done** | External: `fonts.gstatic.com` 404s on Lora's woff2 files. Re-triggered by push, green. Landed in `tasks/lessons.md`. |
| `organizer.url` absent from the `Event` node (U2 cut) | **Backlogged** | `artOfLivingUrl` ships in U3, U2 branches off U1. One line once both are on `main`. Severity low — `organizer.url` is recommended, not required. |
