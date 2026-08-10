# Programme — BROTE: OG card, SEO pass, collaborator links

Design plan: `~/.claude/plans/iridescent-popping-cupcake.md`
Memory: `tasks/PROGRESS-brote-og-seo.md`
Lessons: `tasks/lessons.md` (read first)

**Revision 2** — amended per the binding plan review (9 required changes, 3 scope
cuts). Amendments are marked ⚑ where they overturn something the first draft said.

---

## Definition of Done

1. Units U1–U5 are each **merged, reverted, or explicitly cut** — never partial.
2. `main` is green on `Build + lint + test`, the tree is clean, and no programme
   branch is left unmerged-and-unclosed.
3. A share of `https://www.harisolaas.com/es/brote` renders the **20 August** card,
   confirmed by the owner in the Facebook Sharing Debugger (owner checklist — the
   one binding check this programme cannot self-serve).
4. ⚑ `/es/brote` and `/en/brote` declare themselves canonical and appear in
   `sitemap.xml`; **no BROTE surface intended for search discovery is `noindex`.**
   (Reworded: `success`/`failure` are human surfaces that U1 deliberately
   noindexes, so the original "intended for humans" phrasing was unsatisfiable.)
5. Every collaborator named on the landing resolves to a live outbound link.
6. Every open loop has a terminal disposition in the handback.

### Explicitly out of scope

- A shared `generateMetadata` helper; Sinergia/Mentoría metadata.
- The `PlantLanding` orphan; `next.config.ts`'s `/brote-unarbol` `/es` hardcode.
- Per-collaborator OG images for invitation pages.
- Pricing, checkout, webhook, DB schema.
- A website link for Pulso (no URL supplied — Instagram only).
- ⚑ `broteInvitacion.footer.right` ("Con Un Árbol") — a secondary mention on pages
  that already link the collaborator in the `<h1>` and chip. Backlog.

---

## Prerequisites — verified, not assumed

| Need | Status |
|---|---|
| `gh` auth, `harisolaas/harisolaas-v2` | ✅ scopes `repo`+`workflow` |
| `node_modules` | ✅ `npm ci` done |
| `~/Downloads/og-brote.png` | ✅ 1200×630, reads "JUE 20 AGO · 19:00–22:30" |
| `matelabco.com` / `unarbol.org` / `artofliving.org/ar-es/` | ✅ all 200 |
| `DATABASE_URL` for `next build` | throwaway `postgresql://build:build@127.0.0.1:5432/build` |
| FB Sharing Debugger re-scrape | ❌ owner-only, post-deploy → owner checklist |

---

## Hard constraints — every agent reads these first

- ⚑ **Branch off `origin/main`, never local `main`** — local `main` is 13 commits
  behind (`ae7556d` vs `fcae93f`) and is missing `bcf68d1`, the commit that removed
  the edition-1 partner pages. Branching off it would resurrect deleted files.
- ⚑ **Any vitest file importing a page/layout MUST mock `next/font/google` in the
  test file itself.** `node_modules/next/font/google/index.js` is a **0-byte stub**
  (the real thing is a build-time SWC transform), so the import throws
  `TypeError: Archivo is not a function`. The mock does not apply from a setup file
  outside `src/`:
  ```ts
  vi.mock("next/font/google", () => {
    const f = () => ({ variable: "", className: "" });
    return { Archivo: f, Instrument_Serif: f, Space_Mono: f,
             DM_Serif_Display: f, Source_Sans_3: f, JetBrains_Mono: f };
  });
  ```
  `sitemap()` and `robots()` import with no mock.
- ⚑ **`generateMetadata` returns the RAW object; `metadataBase` resolution happens
  in Next's `mergeMetadata`, which a unit test cannot reach.** So a test asserting
  "url ends with `og-brote-v2.png`" passes for both the relative and the absolute
  form — it cannot kill the mutation it claims to. Assert the two halves separately
  (see U1 tests).
- ⚑ **A child `openGraph` REPLACES the parent's, it does not merge**
  (`resolve-metadata.js:180-182` — straight assignment). Any page declaring
  `openGraph` must re-declare `title`, `description`, `siteName`, `locale`, `type`
  and `images` in full, or it silently drops the inherited ones.
- ⚑ **Never pair robots.txt `Disallow` with meta `noindex` on the same path.** A
  disallowed path is never fetched, so its `noindex` is never read — and it can
  still be indexed URL-only from inbound links. The gate is linked from every
  buyer's email (`src/lib/brote-ticket-email.ts:54`), so it has real inbound links.
- **Never run bare `npm test`** — DB suites need `DATABASE_URL` and share a Neon
  branch. Run only this programme's suites, by path.
- **`/[locale]/*` pages are static prerenders.** `BroteLanding` escapes this for
  price via a `useEffect` (`BroteLanding.tsx:601-614`); a **server**-emitted JSON-LD
  blob has no such escape. This dictates U2's two-offer design.
- **`es.ts`/`en.ts` have mixed encoding.** Edit in small chunks.
- **Never write a test that restates the compiler** (TS2353 already catches dict
  key drift) or pins prose/constants.
- **CI does not run on stacked PRs** (`pull_request: branches: [main]`).
- **Do not merge.** Site is live; merging needs an explicit "ship"/"mergealo".

---

## Units

### U1 — Correct OG card, canonical host, indexing
**Revert boundary:** everything changing what a crawler or scraper sees of existing
pages. `metadataBase` and the relative OG refs are mutually dependent — reverting
one alone resolves images against the wrong host.

Branch `brote-og-seo` off `origin/main`.

- `public/og-brote-v2.png` ← `~/Downloads/og-brote.png`; delete `public/og-brote.jpg`
  (referenced only at `brote/page.tsx:47,53` and `invitacion/…/page.tsx:67,77`).
  **New filename is load-bearing** — scrapers cache by URL.
- `src/app/[locale]/layout.tsx` — `metadataBase`, `openGraph.url`, Person JSON-LD
  `url` → `https://www.harisolaas.com`.
- `src/app/[locale]/brote/page.tsx` — `alternates.canonical` = `/${locale}/brote`
  + `languages`; OG/twitter image → **relative** `/og-brote-v2.png` + `alt`.
- `src/app/[locale]/brote/invitacion/[colaborador]/page.tsx` — new image.
- `src/app/sitemap.ts` — www; add `/es/brote` + `/en/brote` with alternates.
- `src/app/robots.ts` — ⚑ **www sitemap URL only.** No `disallow` additions.
- `src/app/[locale]/brote/{success,failure}/page.tsx` — `robots:{index:false,
  follow:false}` mirroring `sinergia/success/page.tsx:32`, plus a ⚑ **complete**
  `openGraph` block (title/description/siteName/locale/type/images), since a
  partial one drops the inherited fields.
- `src/app/[locale]/brote/gate/layout.tsx` (new — the page is `"use client"` and
  cannot export metadata) and `src/app/brote/flyer/layout.tsx` (currently exports
  only `default`) — `robots` noindex.

**Tests** — `src/app/brote-seo.test.ts`, with the font mock above:
1. `/es/brote` and `/en/brote` metadata: self-referential canonical + both hreflang.
2. ⚑ **`openGraph.images[0].url` starts with `/`** (kills the hardcoded-absolute form).
3. ⚑ **`layout.tsx` metadata has `String(metadataBase) === "https://www.harisolaas.com/"`.**
4. **`/brote` is NOT noindex** — the over-restriction trap, asserted explicitly.
5. `success`/`failure`/invitation metadata *are* noindex, and success/failure carry
   a complete `openGraph` (assert `siteName` and `images` both present).
6. `sitemap()` contains both `/brote` URLs and **every** URL starts `https://www.`.
7. ⚑ `robots()` sitemap URL is www. (Cut: "disallows `/admin`" — restates
   `robots.ts:8` verbatim, a constant pin.)

**Candidate table (minimum):**
| Wrong implementation | Caught by |
|---|---|
| noindex applied to the landing itself | test 4 |
| canonical left inherited (`/es`) while hreflang is added | test 1 |
| OG filename updated in `page.tsx` but not the invitation page | test 2 variant |
| sitemap gains `/brote` but keeps apex host | test 6 |
| ⚑ OG ref left hardcoded absolute after the host switch | tests 2+3 together |
| success/failure get `robots` but a partial `openGraph` | test 5 |

### U2 — `Event` structured data
**Revert boundary:** purely additive markup. **Stacks on U1** (same `page.tsx`;
its `image` must be the new file). CI runs only once U1 merges.

- `src/data/brote.ts` — `eventStartTime: "19:00"` / `eventEndTime: "22:30"` beside
  the display string; `eventStartsAt()` / `eventEndsAt()` returning `-03:00` ISO,
  mirroring `earlyBirdEndsAt()` at `:42`.
- `src/lib/brote-jsonld.ts` (new) — `Event` + `Place` + `performer[]` + `organizer`
  + **`offers` as a two-element array**: early-bird with `priceValidUntil`, and
  regular. Not stylistic: a single `currentTicketPrice()`-derived offer freezes at
  build time and would advertise $24.750 after the preventa closed — the exact bug
  class PR #54 exists to prevent.

**Tests** (`src/lib/brote-jsonld.test.ts`): ISO strings carry `-03:00` and match
`broteConfig`; both offers present with correct ARS prices; `priceValidUntil`
equals the early-bird deadline; required Google Event fields present
(`name`, `startDate`, `location`, `image`).
⚑ Cut: "output parses as JSON" — tautological for an object that `page.tsx`
stringifies.

**Candidate:** a single offer derived from `currentTicketPrice()` — caught by the
two-offer assertion; **re-run with a faked post-deadline clock** to prove the
markup does not move.

### U3 — Collaborator links on the landing
**Revert boundary:** the dictionary type change and its consumer must land together
or the build breaks.

Branch `brote-colaboradores` off `origin/main`, independent of U1.

- `src/lib/brote-invitations.ts` — optional `website?: string` (`matelab` →
  `https://matelabco.com/`, `unarbol` → `https://unarbol.org/`);
  `collaboratorNameUrl(inv)`; `brandInvitations()`.
  ⚑ **Rebased onto `b6b6a31` (#68), which changed this file after the plan review:**
  there is now a sixth slug `comunidad` with `kind: "community"` and **no handle**,
  `handle` is **optional**, and **`instagramUrl()` returns `string | null`**. So
  `collaboratorNameUrl` is `website ?? instagramUrl(inv)` typed **`string | null`**,
  and the Instagram chip must not render for handle-less entries (the established
  pattern in `BroteInvitacion.tsx`). `brandInvitations()` returning exactly 3 still
  holds — `comunidad` is `"community"`, not `"brand"`.
- `src/dictionaries/types.ts` — `BroteCollaboratorMention {bodyBefore, slug,
  bodyAfter}`. **`lineup.dj.link.url`/`.label` are deleted**, not corrected: Gian's
  link broke *because* identity was duplicated in the dictionary, which
  `types.ts:99-107` already forbids.
- ⚑ Dictionary edits, per field (the first draft wrongly assumed one shape fits all):
  | Key | Field restructured | Note |
  |---|---|---|
  | `lineup.live` | `body` → mention | ⚑ also add **`photoAlt`** — `BroteLanding.tsx:928` currently passes `live.body` as the `<LineupMedia>` alt; splitting `body` leaves it with no string, and a sentence was poor alt text anyway |
  | `lineup.dj` | already split; drop `link` | |
  | `includes.items[0]` | `body` (mention already there) | |
  | `includes.items[1]` | ⚑ **`body`**, not `title` — the brand sits in the *heading* today; linking a word inside an `<h3>` is awkward, so fix the casing to "MateLab" in the title and carry the linked mention in the body ("…Nos la trae MateLab.") | |
  | `footer.right` | ⚑ → mention, resolving the first draft's contradiction between its dictionary list and its component list | |
  | `community.sponsorsRow.eyebrow` | new | |
  `BroteIncludesItem` gains optional `mention?: BroteCollaboratorMention`; render
  `mention` when present, else `body`.
- `src/data/brote.ts` — `artOfLivingUrl` (`https://www.artofliving.org/ar-es/` —
  **trailing slash required**, `/ar-es` 404s) and `artOfLivingInstagram`
  (`https://www.instagram.com/elartedevivir.ar/`).
- `src/components/BroteLanding.tsx` — extract the two-anchor idiom at `:988-1018`
  into `<CollaboratorMention slug>` (name → website, `.brote-ig-tag` chip →
  Instagram); apply to block 02, block 03, the includes grid, and the footer; link
  `community.intro.sponsors`; add the sponsors row from `brandInvitations()`.
- ⚑ `src/dictionaries/dictionaries.test.ts` — **must be edited, and the first draft
  omitted it entirely:**
  - `:76-83` `it("points the DJ link at a real Instagram profile")` reads
    `lineup.dj.link.url`/`.label`, the fields U3 deletes → rewrite against
    `getInvitation("gian")`.
  - `:138` `UNTRANSLATED_BY_DESIGN` — `/^lineup\.dj\.link\./` becomes dead, and the
    five new `slug` leaves are byte-identical across ES/EN, so
    `it("translates every copy field")` at `:162` goes red without `/\.slug$/`.

**Tests** (`src/dictionaries/brote-mentions.test.ts` + `brote-invitations.test.ts`):
1. Every `slug` in either dictionary resolves via `getInvitation()` — the test that
   makes the Gian class of drift impossible.
2. `collaboratorNameUrl` prefers `website`, falls back to Instagram (both branches).
3. `brandInvitations()` returns exactly the three `kind: "brand"` entries.
4. ES and EN expose identical mention structure (same slugs, same order).
5. Gian's resolved Instagram URL contains `_gianbejarano`.
6. The chip `href` is an `instagram.com` URL even when a `website` exists.

**Candidate table (minimum):**
| Wrong implementation | Caught by |
|---|---|
| `collaboratorNameUrl` always returns `instagramUrl` (null impl) | test 2 |
| always returns `website` → `undefined` for musicians | test 2 |
| `brandInvitations()` filters `discountPct > 0` — identical today, wrong the moment a brand goes 0% | test 3 + a 0%-brand fixture |
| a hardcoded `gianbejarano` left anywhere in the dictionaries | tests 1+5 |
| chip points at the website, losing the Instagram surface | test 6 |

### U4 — Collaborator links in the ticket emails
**Revert boundary:** templates reach real buyers and fail silently after send.
Branch off `origin/main`.

- `src/lib/brote-email.ts` — link "El Arte de Vivir" (`:66`, `:139`) and "Momento
  Un Árbol" (`:44`); `src/lib/brote-verification-email.ts:114` footer.
- ⚑ The stale-lineup TODO is at **`:37`**, not `:36`. Its times (19:45 / 21:30)
  contradict the landing (20:00 / 21:15) and the entries are unnamed. **The owner
  confirms final times before this merges**; if unconfirmed, ship only the links,
  leave the TODO, and record the cut.
- **Escaping:** `brote-email.ts` has no `escapeHtml` (lessons.md). Everything added
  here is a repo constant, not user input — state that in the PR body rather than
  introducing escaping as drive-by scope.

**Tests:** rendered HTML contains the expected `href`s; no `undefined` in output.

### U5 — Correct `CLAUDE.md`
**Revert boundary:** docs only.

`CLAUDE.md` still documents the Un Árbol discount-code system,
`/[locale]/brote-unarbol`, `BroteUnArbol.tsx` and edition-1 prices/date — all
removed in `bcf68d1`. It is the file every agent reads first. Correct the BROTE
section to edition 2 and record the new OG asset name.

No tests — pinning prose is vacuous by this skill's own rule.

---

## Merge order

`U1 → U2` (stacked). `U3`, `U4`, `U5` independent off `origin/main`, any order.
U2 and U3 both touch `src/data/brote.ts` in different regions — whichever lands
second rebases.

## Review

Per `docs/ops/pr-review.md`: Copilot + self-review + both addressed, plus this
skill's `programme-pr-reviewer`. Two iterations maximum, then cut or escalate.

## Seeder

`scripts/seed-preview.ts` deliberately untouched — the CLAUDE.md rule binds
features that read DB columns; this is copy, metadata and static config only. Its
five `links` rows (`:473-480`) stay correct.
