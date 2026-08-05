# PROGRESS — Mentoría 1 a 1 programme

Spec: `docs/plans/mentoria-1a1-programme.md`. Read the spec and this file fully
before doing anything.

## Merged

| Unit | PR | What shipped | Notable catches |
|---|---|---|---|
| — | — | — | — |

## Queue

1. U1 — `/mentoria` surface (types + es/en copy + page + component). Branch
   `feat/mentoria-u1-page` off `feat/mentoria`, PR targets `feat/mentoria`.
2. (midpoint) zero-context audit — one-sentence charge per spec.
3. U2 — landing Now card. Branch `feat/mentoria-u2-card` off `feat/mentoria`
   (after U1 merges), PR targets `feat/mentoria`.
4. Integration PR `feat/mentoria` → `main`: repo review lifecycle, then LEAVE
   OPEN for owner preview review. Do not merge to main under any circumstances.

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
| Request + publish Cris's testimonial on /mentoria | med | S | owner asks Cris ("cuando corresponda") |
| Final price replaces placeholder | high | XS | owner decides price before merging integration PR |
| Dedicated booking flow (Calendly or form) if WhatsApp CTA underperforms | low | M | owner defines CTA destination (open tablero task) |

## Dispositions

(Landing phase fills this.)
