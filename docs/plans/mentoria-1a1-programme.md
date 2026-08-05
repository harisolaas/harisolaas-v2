# Programme: Mentoría 1 a 1 — landing presence + /mentoria page

Positioning source of truth: Hari's own vault notes (MOC Mentorías 1 a 1 + Tablero,
2026-08-04). The mentorship is published as **presence, not product launch**: "no se
publica como oferta; va en el site como una de las cosas que Hari hace, con un CTA
para interesados", "no presentarlo como método ni como programa con pasos". Floor
USD 500/mes; final price is a clearly-marked placeholder the owner sets.

## Definition of Done

The programme is finished when:

1. Units U1 and U2 are merged into the integration branch `feat/mentoria` (or cut,
   with reason recorded), each through the repo's PR review lifecycle
   (`docs/ops/pr-review.md`: Copilot request + self-review + programme PR reviewer,
   findings addressed, threads resolved).
2. A single integration PR `feat/mentoria` → `main` is **open, not merged**, with
   green checks and a Vercel preview, its body carrying: diff summary, the
   quote-veto table (each quote with vault source), the price placeholder callout,
   and the CTA-destination note. **Merging is the owner's decision after reviewing
   the preview** — this is an owner-checklist item, not a programme task. The
   deliberately-open integration PR is the one exception to the "no PR left open"
   landing rule.
3. The Landing phase has run: closing verifier verdict on the claims, stability
   evidence recorded, every open loop given a terminal disposition, handback
   written.

**Out of scope** (backlog/owner, not this programme): testimonials (Cris's must be
explicitly requested first — Tablero: "cuando corresponda"); final price; a
Calendly/booking flow (CTA defaults to the site's WhatsApp convention);
`scripts/seed-preview.ts` (copy-only feature, no DB reads — documented exemption);
nav/timeline changes; anything related to "High ticket AOL" (separate project, not
Hari's offer); sitemap changes (sub-pages like /sinergia are not in the sitemap
either).

**Owner pre-approval:** the owner invoked execution directly ("no need for my
approval, I just want this ready to publish as a v1") and specified the branch
topology. The planning-phase approval stop is therefore waived; the review gate
moves to the open integration PR.

## Branch topology (owner-specified)

- Integration branch `feat/mentoria` off `main`, pushed to origin.
- Unit branches off `feat/mentoria`: `feat/mentoria-u1-page`, `feat/mentoria-u2-card`.
  Unit PRs target **`feat/mentoria`**, never `main`.
- After both units merge: open PR `feat/mentoria` → `main`, run the repo review
  lifecycle on it, leave it open for the owner's Vercel-preview review.

## Units

### U1 — the `/mentoria` surface (types + copy + page)

**Revert boundary:** the whole page. Types without copy fail typecheck; copy
without the page is dead weight; the page without copy cannot render. One unit.

**Files:**
- `src/dictionaries/types.ts` — add `MentoriaDict` (meta, hero, sections, quotes,
  practical block, cta) and `mentoria: MentoriaDict` on `Dictionary`.
- `src/dictionaries/es.ts` — primary copy, Argentine voseo, gender-agnostic
  (CLAUDE.md conventions). ~350 words. Arc: quién sos → qué es esto
  (acompañamiento individual, encuentros semanales, sin método) → cómo trabajo →
  por qué yo (dos vidas en un cuerpo: década de ingeniería senior + 15+ años de
  práctica y enseñanza) → cita(s) intercaladas → formato/precio
  (`[PRECIO — placeholder]`) → CTA.
- `src/dictionaries/en.ts` — English mirror (warmth kept, regionalisms dropped).
- `src/app/[locale]/mentoria/page.tsx` — follows `src/app/[locale]/sinergia/page.tsx`
  pattern for `generateMetadata`; **no custom fonts** — main-site design system.
- `src/components/MentoriaLanding.tsx` — main-site visual language (cream/forest/
  terracotta, `font-serif`, `texture-overlay`, `fadeUp`/`staggerContainer` from
  `src/lib/animations`), analytics via `trackSectionView`/`trackCtaClick`,
  mobile-first. CTA anchor → wa.me link (site convention; the number already used
  in `es.ts` now.items). Code comment marks the CTA href as the swappable
  destination (open item in owner's tablero).

**Quotes woven into the page (owner veto table — repeated in the integration PR body):**

| # | Quote (es) | Vault source | Edit |
|---|---|---|---|
| 1 | "En el momento en que decís 'ya entendí', tu alerta se cae." | Sesión Cris 2026-07-29 | verbatim (Hari) |
| 2 | "La idea cambia, y la práctica tiene que atravesar eso. Esa es la disciplina." | Sesión Cris 2026-07-29 | two adjacent Hari lines merged |
| 3 | "Ver lo que está debajo: las motivaciones ocultas, el nudo real bajo el síntoma. Esa es la materia prima de lo que hago como mentor." | La cara luminosa de Plutón | astrological framing + third-party reference stripped |
| 4 | "Las herramientas que aparecen no son un método: son las que tengo en mi propio cinturón, porque las uso conmigo mismo." | MOC Mentorías 1 a 1 | light rephrase of Hari's own note |

Privacy exclusions (recorded, non-negotiable): everything Cris said including his
offered testimonial; the stage-at-17 turning point in the 07-29 transcript; all
third-party health/family/business specifics; astrology-of-Cris notes. Case 1 is
referenced only as "hace unos meses acompaño semanalmente a un emprendedor"
(non-identifying).

**Tests first (new file `src/dictionaries/dictionaries.test.ts`, node env, no DB):**
- `mentoria` exists on both `es` and `en` dictionaries with non-empty heading/copy
  fields. (Red before implementation: property is `undefined` at runtime — vitest
  transpiles without typechecking, so this fails on the assertion, not the harness.)
- Locale-consistency: for each dict (es, en), every internal href found in
  `mentoria` and `now` sections (hrefs starting with `/`) must start with the
  dict's own locale prefix (`/es/` or `/en/`). Catches the real copy-paste bug
  class (`/es/mentoria` inside `en.ts`).
- The mentoria CTA href is a `wa.me` URL using the site's number (`5491122555110`)
  with a URL-encoded text param.

**Cut from scope, with reasons:** component render tests (repo has no
jsdom/RTL infra — `vitest.config.ts` is `environment: "node"`; adding a component
test stack for one page is overengineering); copy-convention tests (grepping prose
for voseo/gender-agnostic pins prose, not behaviour — explicitly a vacuous-test
archetype; conventions are checked in review instead); `generateMetadata` unit
test (typecheck + `next build` exercise it).

**Candidate table (wrong implementations to run against the suite):**

| Wrong implementation | Which assertion catches it | Re-run vs finished code |
|---|---|---|
| Types added, `es.ts`/`en.ts` missing `mentoria` content | existence assertion (undefined) + `tsc --noEmit` | pending |
| `en.ts` internal href copy-pasted as `/es/mentoria` | locale-consistency assertion | pending |
| CTA href left as `mailto:` or bare tel number | wa.me assertion | pending |
| Component hardcodes Spanish strings instead of reading dict | **not caught by suite** — manual binding check: load `/en/mentoria`, verify English renders | pending (manual) |

**Binding pre-merge checks:** `npx tsc --noEmit` · `npx eslint <changed files>` ·
`npx vitest run` · `npx next build` · manual render check of `/es/mentoria` and
`/en/mentoria` (dev server on a free port — **never touch `.next` while the
owner's port-3000 server runs; check `lsof -i :3000` first**) · copy-convention
review (voseo, gender-agnostic, no coach clichés) recorded in the PR self-review.

### U2 — landing entry point (Now card)

**Revert boundary:** landing visibility of the offer. Separate from U1 because
reverting the card must not take down the page (deep links may circulate), and the
card without the page 404s — hence U2 strictly after U1.

**Files:** `src/dictionaries/es.ts` + `en.ts` — new first item in `now.items`,
`categoryKey: "teaching"`, title "Mentoría 1 a 1" / "1:1 Mentorship", 1–2 lines
(acompañamiento individual, encuentros semanales, sin método fijo), status
"Sucediendo ahora" / "Happening now", CTA "Conocé más" / "Learn more" →
`/es/mentoria` · `/en/mentoria`. No component changes — `NowSection`/`NowCard`
render dict-driven items as-is.

**Tests first (extend `src/dictionaries/dictionaries.test.ts`):**
- Both dicts contain a `now.items` entry whose CTA href is `/{locale}/mentoria`
  (red before the card exists).
- Locale-consistency assertion from U1 covers the new hrefs automatically.

**Candidate table:**

| Wrong implementation | Which assertion catches it | Re-run vs finished code |
|---|---|---|
| Card added to `es.ts` only | per-locale loop of the new assertion fails on `en` | pending |
| CTA href `/es/mentoria` in `en.ts` | locale-consistency assertion | pending |
| Card added without `cta` | new assertion requires the cta with exact href | pending |

**Binding pre-merge checks:** same suite as U1 (tsc, eslint, vitest, build) +
manual check that the card renders on `/es` and `/en` with working link.

## Programme prerequisites (verified at planning time)

- `gh` authenticated as `harisolaas` — verified.
- Working tree clean on `main`, `feat/mentoria` created — verified.
- Vitest runs with `.env.local` loaded but the new test file must not touch the
  DB (pure dict imports) — safe on any machine.
- Vercel builds previews for pushed branches; the integration PR will carry the
  preview link. Do **not** loop-curl prod/preview URLs (Vercel Security
  Checkpoint 403s the IP) — confirm via the PR checks / deployments API.

## Midpoint audit

After U1 merges, spawn `zero-context-auditor` with exactly:
"Audit the mentoría (1:1 mentorship) surface of this Next.js site and report what
you find." Findings triage per convergence rules: same-boundary → U2 or the
integration PR; everything else → backlog.

## PROGRESS file

`docs/plans/mentoria-1a1-PROGRESS.md`, updated after every merge; required first
read for every spawned agent.
