# The test database, and how it gets poisoned

Several suites in this repo hit a **real Postgres** rather than a mock:
`src/lib/community.test.ts`, `links-db`, `override-link`, `plant-reminder`,
`email-verification-server`, and everything under `src/app/api/admin/`.

They all share **one Neon branch**. That branch is long-lived, it is not reset
between runs, and two CI runs can execute against it at the same time. Every
rule below follows from those three facts.

## Which database is which

| Source | What it is |
|---|---|
| `.env.prod.local` | **Production.** Never write to it. |
| `.env.local` | The dev branch — the same one CI uses (Vercel's `Development` env resolves to it). |
| GitHub secret `DATABASE_URL_DEV` | Same dev branch, as CI sees it (`ci.yml`). |

The dev branch is a **copy-on-write branch of production**, so it holds a copy
of real rows and its totals look just like prod's. **Row counts cannot tell you
which one you are connected to.** The reliable discriminator is fixture
presence: only the dev branch carries `test-%` / `scope-test-%` rows.

## The failure mode: self-perpetuating poisoning

This is the one that costs a day, so it is worth understanding exactly.

A test creates a fixture row with a fixed unique key, and deletes it **inline at
the end of the test body**:

```ts
it("…", async () => {
  await db.execute(sql`INSERT INTO links (slug, …) VALUES ('test-bypass-link-active', …)`);
  // … assertions …
  await db.execute(sql`DELETE FROM links WHERE slug = ${slug}`);  // ← never runs on failure
});
```

If anything above that last line fails — including an unrelated flake from a
concurrent run — the delete never executes and the row survives. The next run's
`INSERT` then dies on a duplicate key, *before* reaching its own cleanup line.
Which leaves the row. Which fails the next run.

**No amount of re-running clears it**, because the only code that would have
deleted the row is the code that can no longer get that far. And because the
branch is shared, it is not one PR that is broken — it is every PR in the repo,
including other people's.

Real instance: 2026-08-08, `test-bypass-link-active`. Every PR red for hours,
across two concurrent sessions, until the row was deleted by hand. Fixed in #64
and #67.

## Rules for writing a DB-backed test

1. **Cleanup belongs in `beforeAll` / `afterAll` / `beforeEach`, never only in
   the test body.** Vitest runs `afterAll` even when a test fails; an inline
   delete on the happy path is not cleanup, it is a wish. Inline deletes are
   fine *in addition*, never *instead*.
2. **Sweep before you seed, not just after.** The `beforeAll` sweep is what
   makes a suite self-healing when a previous run died badly.
3. **Match on something stable, not on a generated id.** If the row's key comes
   back from the API, a prefix filter will not catch it. Match on a column you
   control — `destination`, `event_id`, an email prefix. This was the bug in
   `scope-enforcement.test.ts`: seeded links matched `scope-test-link-%`, but
   links created through `POST /api/admin/links` got a server-generated slug
   that did not, so only the inline delete covered them.
4. **Scope every delete to a test-owned prefix.** `test-%`, `scope-test-%`,
   `test-community-%@example.com`. Never delete unqualified — the dev branch
   contains a copy of real production rows.
5. **Mind FK order.** `links.referred_by_person_id` → `people`, so links go
   before people. `link_clicks.link_slug` is `ON DELETE CASCADE` and needs no
   explicit handling. `participations.link_slug` is `ON DELETE SET NULL`.

## Runbook: recognising and clearing a poisoned branch

**Recognise it.** All of these together mean poisoning, not a regression:

- the failures are all in DB-backed suites;
- the diff cannot plausibly reach them (a CSS change, an asset, a doc);
- the errors are `duplicate key value violates unique constraint` or
  `Key (id)=(…) is still referenced from table "participations"`;
- **the failing suite changes between runs** — that is interference, not a bug;
- `main` is green while every PR is red.

**Before blaming a PR**, check `gh run list` for a concurrent run on another
branch. Overlapping runs are the usual trigger.

**Clear it.** Neon SQL editor, dev branch (confirm the sidebar says `dev`, not
the compute name — the compute is called "Primary" even on a child branch).
Delete in FK order, scoped to prefixes: `link_clicks` → `links` →
`participations` → `people` → `events`. Guard the transaction so it aborts if it
finds itself somewhere with real ticket rows, and use `ROLLBACK` to preview.

**Do not clean while a run is in flight** — you would delete fixtures out from
under it and fail a build that was fine.

## Known limitation

`vitest.config.ts` serialises tests *within* a run (`singleFork`). Nothing
serialises *across* runs. Two agents or two pushes at once will keep colliding,
and the rules above reduce the blast radius without removing the cause. The real
fixes are a `concurrency` group in `ci.yml` (cancel or queue in-flight runs) or a
per-run schema/branch. Neither is done yet.
