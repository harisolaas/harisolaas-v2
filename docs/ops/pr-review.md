# PR review lifecycle

Every PR in this repo goes through a two-reviewer cycle — automated bot
(Copilot) plus the author doing a critical self-review — **before**
asking for human merge approval. This doc is the operational guide.
Apply it on every PR unless the requester explicitly says "don't
review" / "just open the PR".

## Why this exists

Reviews catch real bugs and we want the catch rate to be non-negotiable.
Recent examples from this repo:

- **PR #10** (bulk email): Copilot caught a hardcoded email + a missing
  explicit `data` check; the author's self-review caught the `onSent`
  thrown-error path that would have re-created the very double-send
  scenario the PR was fixing.
- **PR #11** (attendance toggle): Copilot caught the missing
  `typeof === "string"` validation and a button label with no screen
  reader text; the author's self-review caught the missing PATCH test
  suite and the silent-error-on-failure UX hole.

Every PR benefits. Skipping the cycle means shipping worse code.

## The cycle

### 1. Open the PR and explicitly request Copilot

```sh
gh pr create --title "..." --body "..."
```

Then request Copilot as a reviewer. **This is not automatic** —
observed empirically, GitHub's background code-review bot fires on
some PRs but not others (code changes usually, docs-only sometimes
never). Request explicitly so the cycle is deterministic:

```sh
gh api repos/harisolaas/harisolaas-v2/pulls/<N>/requested_reviewers \
  -X POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

The `[bot]` suffix is required — that's how GitHub's reviewer-request
API disambiguates the Copilot app from a regular user account (the
plain `copilot-pull-request-reviewer` login is not a repo collaborator
and the request will 422 without the suffix).

Verify the request took:

```sh
gh pr view <N> --json reviewRequests \
  --jq '.reviewRequests[].login'
# → "Copilot"
```

### 2. Self-review in parallel with Copilot

Don't wait for Copilot. Run the self-review immediately:

```sh
gh pr view <N>
gh pr diff <N>
```

Read the diff as if someone else wrote it. Things to check:

- **Correctness**: is the logic right? Edge cases? Invariants?
- **Conventions**: does it follow existing patterns in this repo? (See
  `CLAUDE.md` for copy/design/voseo conventions, and per-subsystem
  docs in `docs/ops/` for operational patterns.)
- **Tests**: what's the fragile part? Is it tested? Integration vs unit
  matters — fragile SQL or state transitions want DB-backed tests.
- **Security**: auth checks on new routes? Input validation at system
  boundaries?
- **Accessibility** (UI PRs): semantic HTML, `aria-*` attributes on
  interactive controls, readable labels during loading states.

Write the review as a comment on the PR (or, if you're an agent
reviewing before posting, as chat output to the requester). Structure:

> - **Must-fix**: blockers.
> - **Should-have**: strong suggestions.
> - **Nice-to-have**: non-blocking.

### 3. Fetch Copilot's inline comments

They typically land within a few minutes of PR creation (sometimes
longer). Fetch them:

```sh
gh api repos/harisolaas/harisolaas-v2/pulls/<N>/comments \
  --jq '.[] | {path, line, body}'
```

### 4. Merge findings

Triage Copilot + self into one list. Overlaps count once. Disagree with
either reviewer when you have a reason — document the reason in the
follow-up commit message so future reviewers see the thinking.

### 5. Fix the applicable items

One follow-up commit. Keep it scoped:

- Do the must-fix and should-have items.
- Do nice-to-have items only if they're one-liners or clearly worth it;
  otherwise note them as deferred.
- Don't add speculative error handling or features Copilot suggests
  "for safety" — this repo values tight, specific code over defensive
  boilerplate.

### 6. Verify

Not just the changed file — run the full suite:

```sh
npx tsc --noEmit
npx eslint <changed files>
npx vitest run
```

For UI PRs, also:

```sh
npx next build
```

If you're working from the CLI (or as an agent without a browser),
you can't click through the UI yourself. Flag that in the PR body and
rely on the Vercel preview + the requester's smoke test.

### 7. Resolve Copilot's threads

Each Copilot inline comment creates a review thread. Once addressed,
resolve it via GraphQL — keeps the PR view clean:

```sh
# List unresolved threads
gh api graphql -f query='
query {
  repository(owner: "harisolaas", name: "harisolaas-v2") {
    pullRequest(number: <N>) {
      reviewThreads(first: 50) {
        nodes { id isResolved comments(first: 1) { nodes { path body } } }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id'

# Resolve each
gh api graphql -f query='mutation {
  resolveReviewThread(input: {threadId: "<thread-id>"}) { thread { isResolved } }
}'
```

### 8. Report and hand off

Tell the requester what landed, what was deferred, what needs their
smoke test. Do **not** ask permission to merge — this repo has an
explicit guard (see `CLAUDE.md`):

> **Site is LIVE — do NOT push to main without explicit approval.**

A clean review does not constitute merge approval. Wait for an
explicit "ship" / "merge" / "mergealo".

## When to skip

- The requester explicitly says "don't review" / "just open the PR".
- The PR is genuinely trivial (one-line copy fix, typo). Still open the
  PR; the review can be a one-line "nothing to flag" rather than a
  deep dive.
- The PR is a `docs/` or `README` change with no code impact. Same as
  above — skim, not dive.

Everything else gets the full cycle.

## Anti-patterns

- ❌ "The tests pass, let's ship" — tests verify correctness, not
  design. Review anyway.
- ❌ "Copilot said it's fine" — Copilot misses things. You review in
  parallel, not in sequence.
- ❌ "I already thought about it while writing" — author brain is
  author brain. Read the diff fresh.
- ❌ Deferring a must-fix because "the requester might not care" —
  flag it, let them decide.
- ❌ Resolving threads before they're actually fixed — if you disagree,
  reply explaining why, then resolve.
