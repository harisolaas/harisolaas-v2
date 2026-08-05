# PROGRESS — Mentoría 1 a 1 programme

Spec: `docs/plans/mentoria-1a1-programme.md`. Read the spec and this file fully
before doing anything.

## Merged

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| U1 | #48 (merged into `feat/mentoria`) | `/mentoria` page: `MentoriaDict` types, es/en copy, `MentoriaLanding`, dict test suite. All 4 candidate mutations run and caught (3 by suite, 1 by manual `next start` render check). | Programme reviewer: case-1 description exceeded the recorded privacy formula → trimmed. Copilot: gendered "un emprendedor"/"his" → neutral; text-based React keys → section-scoped index; Twitter card downgraded from `summary_large_image` → restored with site OG image. Owner mid-flight input: minimum commitment is **three-month cycles** → "how" copy + practical row updated in both locales. |

## Queue

1. Integration PR `feat/mentoria` → `main`: repo review lifecycle, then LEAVE
   OPEN for owner preview review. Do not merge to main under any circumstances.

Done: U1 = #48; U2 = #49 (Now card, both locales, programme reviewer APPROVE,
Copilot no inline findings, all 3 candidate mutations caught). Midpoint audit
ran after U1 — triage in Carry-forward.

## Blocked

(none)

## Hard-won constraints

- Site is LIVE. Never push/merge to `main`. The integration PR stays open.
- Never touch `.next` or run `next build` while the owner's dev server holds
  port 3000 — check `lsof -i :3000` first; if busy, run `next build` only after
  confirming it's our own process, or skip local build and rely on CI/Vercel.
- Copilot reviewer request: REST POST with `reviewers[]=copilot-pull-request-reviewer[bot]`
  only (GraphQL mutation and `gh pr edit --add-reviewer` both silently no-op).
  Verify with `gh api repos/harisolaas/harisolaas-v2/pulls/<N> --jq '.requested_reviewers[].login'`.
- Don't loop-curl prod/preview to verify deploys — Vercel Security Checkpoint
  403s the IP. Use PR checks / deployments API.
- Vitest loads `.env.local` and serializes files for DB tests; the dictionaries
  test must stay pure (no DB imports) so it can't race anything.
- Spanish copy: voseo, gender-agnostic (no "solo/a", "bienvenido/a", "todos").
  Privacy: no Cris quotes, no third parties, no testimonial yet.

## Carry-forward / backlog

| Item | Severity | Size | Revive trigger |
|---|---|---|---|
| Pre-existing site-wide: dotted locale segments (e.g. `/x.y/mentoria`) bypass proxy matcher and 500 in `getDictionary` — fix via `dynamicParams = false` in `[locale]/layout.tsx` or locale validation (midpoint audit) | med | S | next site-wide hardening pass |
| Placeholder-token guard test (`/\[(PRECIO\|PRICE)\]/` must not appear in dict copy) — can only go green once owner sets the price (midpoint audit) | low | XS | price placeholder replaced |
| /mentoria is indexable but not in sitemap — matches the sinergia precedent (intentional); add sitemap entries + alternates if it should rank (midpoint audit) | low | XS | owner wants /mentoria in search |
| Dedicated OG image for /mentoria (currently reuses site-wide `/og-image.jpg`) | low | S | owner provides/requests an asset |
| Request + publish Cris's testimonial on /mentoria | med | S | owner asks Cris ("cuando corresponda") |
| Final price replaces placeholder | high | XS | owner decides price before merging integration PR |
| Dedicated booking flow (Calendly or form) if WhatsApp CTA underperforms | low | M | owner defines CTA destination (open tablero task) |

## Dispositions (Landing phase — programme closed 2026-08-05)

Closing verifier verdict: **SAFE TO STOP** — all 5 claims HOLD (U1 page, U2
card, test suite + candidate mapping, no regression beyond the mentoria
surface, git/PR state). Nothing was ever in Blocked.

- **Done**: U1 (#48, merged into `feat/mentoria`, review cycle complete).
- **Done**: U2 (#49, merged, programme reviewer APPROVE, review cycle complete).
- **Done**: midpoint zero-context audit (findings triaged into Carry-forward).
- **Done**: Copilot cycle on #50 — over-restrictive locale test fixed (f727c07);
  "gente" grammar flag declined with documented reason (singular collective).
- **Owner checklist** (trigger: before merging #50):
  1. Set the price — replace `USD [PRECIO]`/`USD [PRICE]` in `es.ts`/`en.ts`.
  2. Veto or bless the 4 quotes (table in #50 body, each with vault source).
  3. Confirm the CTA destination (currently wa.me per site convention).
  4. Review the Vercel preview, then explicitly merge #50 to publish.
- **Owner checklist** (trigger: "cuando corresponda", per tablero): ask Cris
  for the testimonial before ever publishing one.
- **Backlogged**: all Carry-forward rows above, with their triggers.

## Lessons (durable, codebase-wide)

- `src/dictionaries/dictionaries.test.ts` must stay pure (dict imports only) —
  it is the only suite that runs without DB access and guards locale-link
  consistency site-wide. Internal locale-root links (`/es`, `/en`) are valid;
  don't re-tighten the assertion to require a trailing slash.
- "Gente" is a singular collective in es copy — automated reviewers repeatedly
  flag correct agreement ("gente… quiere… le") as a slip; decline with reason.
