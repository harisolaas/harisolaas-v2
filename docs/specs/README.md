# Community CRM — Project Specs

Three independent but related projects that together turn the current "BROTE Admin" page into a proper community CRM.

**Picking up from a previous session? Start with [NEXT.md](./NEXT.md)** — it tracks what's been shipped, what's in flight, and what's on deck.

## The three projects

1. **[01 — Data model restructure](./01-data-model.md)** — make `community:person:{email}` the single source of truth, promote events to first-class entities, unify write paths, migrate existing data. Foundational; touches Redis schema and every write handler.

2. **[02 — Dashboard enhancements](./02-dashboard.md)** — rename to Comunidad, restructure tabs (Panorama, Personas, Eventos, Campañas), add durable community metrics, person drilldown, generic event handling.

3. **[03 — Link builder](./03-link-builder.md)** — in-admin tool to create tracked short links in seconds, attribute every click and signup back to a specific link/channel/campaign, surface which content actually builds community.

## Dependencies

```
01 (data model) ──┬──> 02 (dashboard)
                  └──> 03 (link builder)
```

02 and 03 are independent of each other, but both depend on 01. You can do them in parallel once 01 is through its migration phases.

## Recommended order

01 → 03 → 02.

Why 03 before 02: the link builder is the single biggest analytical unlock. Once attribution is flowing, 02's Panorama and Eventos tabs become much richer. Doing 02 first means rebuilding it again later when 03 lands.

That said, **02 has cheap wins you can ship early without waiting for 01** — rename the site, fix the Comunidad tab to read the union of sources, collapse Registros into Personas. Those are a day of work and pay off immediately.

## What each spec contains

- Goal and current state
- Target design (schemas, UI, behavior)
- Migration or rollout plan
- Metrics and invariants
- Open questions
- Out of scope

Each spec is self-contained. You should be able to open one, work it to completion, and not need to keep the others in your head.
