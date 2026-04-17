# Spec 02 — Dashboard Enhancements (CRM Reframe)

## Goal

Transform the current "BROTE Admin" page into a proper community CRM. Rename to Comunidad. Restructure into four tabs (Panorama, Personas, Eventos, Campañas). Make durable community metrics the top-line, events first-class, and individual people drillable.

## Why

The current dashboard is event-first (specifically BROTE-first) in a world where the underlying thing is a community across multiple events. Symptoms:

- Named "BROTE Admin" but tracks plant and sinergia too.
- Comunidad tab doesn't show BROTE buyers (it reads only `community:person:*` which BROTE writes don't touch).
- Registros tab is plant-only but its name implies universal.
- Top metrics are plant-heavy; when plant is over, the dashboard becomes awkward.
- No way to see a single person's full timeline.
- No forward-looking view of what event is next and how it's tracking.

## Dependencies

- **Requires Spec 01 (data model)** for the full vision — Personas needs `community:index`, Eventos needs `event:{id}` entities, reactivation metrics need unified participations.
- **Cheap wins possible without Spec 01**: rename site, fix Comunidad tab to read union of all three sources (BROTE attendees set, plant registrations, community persons), collapse Registros into Personas. These are ~1 day of work and make the current dashboard usable without waiting for full restructure.

## Scope

### Rename

"BROTE Admin" → **"Comunidad"** (header text, page title, browser tab).

### Four tabs

| Tab | Purpose |
|---|---|
| Panorama | At-a-glance heartbeat. Durable community metrics + active events + recent activity |
| Personas | The CRM. Every community member, filterable, drillable |
| Eventos | Events as first-class objects. Signups, attendance, sources per event |
| Campañas | Links and attribution dashboard. Details in Spec 03 |

Old tabs (Overview, Registros, Comunidad, BROTE) are replaced entirely. Registros data folds into Personas (filter by event). BROTE tab content moves into Eventos → click BROTE event.

## Tab 1 — Panorama

### Row 1: Durable top-line metrics (4 cards)

| Metric | Definition |
|---|---|
| Tamaño comunidad | `SCARD community:index` |
| Nuevos (7d) | Count of people where `firstSeen` is within last 7 days |
| Vuelven (7d) | Count of people who have a participation within last 7 days AND at least one previous participation |
| Reactivación | Of people with 1+ completed events, % with 2+ total participations |

Each card shows the number plus a delta vs. previous 7d window (↑12%, ↓3%, flat).

### Row 2: Active events strip

One card per event where `status ∈ {upcoming, live}`, sorted by date.

Each card contains:
- Event name + date
- Signup bar (N / capacity, % full)
- Signup velocity (per-day avg, last 7 days)
- Projected fill date
- Traffic light:
  - 🟢 green — on track (projected fill ≤ event date OR ahead of comparable prior event's pace)
  - 🟡 yellow — slowing (velocity declining vs. last 7d avg)
  - 🔴 red — at risk (not on track to fill before event date)

Click → Eventos tab filtered to this event.

### Row 3: Community growth chart

Cumulative community size over time (x: date, y: total unique people).

Toggle: **stacked by first-event-joined** (brote vs. plant vs. sinergia) OR **stacked by first-touch source** (IG / Email / WhatsApp / Direct / Other).

Purpose: see which channels or events actually expand the community vs. recycle the same people.

### Row 4: Recent activity feed

Capped list, last ~20 events:

> María Fernández signed up for Plantación via IG Story · 17 abr — 2h ago
>
> Juan Pérez bought BROTE ticket — 3d ago
>
> Pedro Gómez tagged as *voluntaria* — 5d ago

Each row clickable → person drilldown.

Implementation note: maintain `activity:feed` as a capped Redis LIST (LPUSH on each participation, LTRIM 0 199). Cheap to read, ordered.

## Tab 2 — Personas (the CRM)

### List view

Default: all members of `community:index`, sorted by `firstSeen` desc.

Columns:

| Column | Source |
|---|---|
| Nombre | person.name |
| Email | person.email |
| Eventos | chips derived from participations — "BROTE", "Plantación", "Sinergia ×3" |
| Primera fuente | from `firstTouch` — human label e.g. "IG Story · 17 abr" |
| Primera vez | `firstSeen` (YYYY-MM-DD) |
| Tags | from `person.tags` |

### Filters (top bar)

- **Búsqueda** — name or email substring
- **Evento** — multi-select. Sinergia appears twice: "Sinergia (cualquiera)" aggregator + individual dated sessions
- **Fuente** — channel (IG Story, Email, WhatsApp, etc.)
- **Campaña** — if set on firstTouch
- **Fecha primera vez** — range picker
- **Tags** — multi-select from existing tags
- **Saved views** (v2) — save a filter combo with a name

### Row click → Person drilldown

Right-side drawer or route `/admin/personas/{email}`. Contents:

**Header:** name, email, first seen, tags (chips, editable inline).

**Contact:** phone, instagram (editable).

**Notes:** multiline freetext, editable, autosaves.

**Timeline:** chronological list of all participations. Each entry:
- Event name + date + role
- Attribution: "Llegó por IG Story · 17 abr (plant_launch)"
- Metadata summary: "Grupo: solo · Carpool: sí · Mensaje: 'Qué ganas…'"

**First touch:** how they first entered the community.

**Actions:**
- Export CSV of this person's timeline
- Edit tags / notes
- (v2) Merge with another email

### Bulk actions on list

- Export CSV (filtered set)
- Apply tag to all filtered
- Remove from community (admin only; rare)

## Tab 3 — Eventos

### List view

Every event in `event:index`, default sort by date desc.

Columns: nombre, fecha, tipo, estado, registrados/capacidad, asistencia (if past).

Filter: type, status, date range.

### Event detail (click a row)

Sub-sections:

**Header:** event name, date, type, status, capacity, notes (editable).

**Signups timeline:** per-day bars + cumulative line (same as current plant chart, generalized).

**Source breakdown:** pie/bar showing where signups came from (channel rollup from `participation.attribution`).

**Link breakdown:** top links that drove signups to this event. Click through to Campañas.

**Participants:** reuses the Personas table component, filtered to this event's `participants` set. Can drill into individual people from here.

**Conversion funnel (events with gates):**
- Clicks (from links targeting this event's destination)
- Signups (participations)
- Attended (participations with metadata.status == "used" or equivalent)
- Returned (people who participated in a later event)

**For Sinergia series:** the "Sinergia" entry shows aggregate across all sessions with a drill-down list of each session.

### Create event

**v1:** manual config in `src/data/events.ts` (similar to current `brote.ts` / `sinergia.ts`). Seed script creates the `event:{id}` record.

**v2:** UI form in the Eventos tab.

## Tab 4 — Campañas

Full spec in **Spec 03 (Link Builder)**. From the dashboard's perspective:

- Embed the Campañas list and link detail view (described in Spec 03).
- Top of the tab: rollup cards — total links, total clicks, total attributed signups, overall CVR.
- Below: full links table (Spec 03).
- Side tabs/toggles: per-channel rollup view, per-campaign rollup view.

## Durable metrics — definitions

### Community-level (always on screen)

| Metric | Definition | Why |
|---|---|---|
| Community size | `SCARD community:index` | Headline |
| New this week | people where `firstSeen` ≥ 7d ago | Growth rate |
| Returning this week | people with a participation in last 7d AND ≥1 earlier participation | Re-engagement rate |
| Reactivation rate | `count(people with 2+ participations) / count(people with 1+ participations)` | Is the community sticky? |
| Time-to-second-touch | median days between `firstSeen` and 2nd participation, for people with 2+ | How fast do people re-engage? |

### Per-event (shown in Panorama event strip and Eventos detail)

| Metric | Definition |
|---|---|
| Fill % | `participants.size / event.capacity` |
| Velocity (7d) | `count(participations in last 7d) / 7` |
| Projected fill date | `(capacity - participants.size) / velocity + today` |
| Attendance rate | `count(metadata.status == "used") / participants.size` |
| Outbound reactivation | of this event's attendees, % who attended the next event in series |

### Per-link (Spec 03 has full list)

Stickiness: `count(link-attributed signups with 2+ participations) / count(link-attributed signups)` — shown on link detail and in the links table.

## Rollout plan

Can be shipped in phases; each phase is useful on its own.

### Phase A — Rename + quick fixes (pre-Spec 01)

- Rename "BROTE Admin" → "Comunidad" everywhere
- Fix current Comunidad tab to read union (brote attendees ∪ plant registrants ∪ community persons) — mirror the metrics endpoint's union logic
- Rename Registros tab → "Plantación" (or fold into Personas with event filter)
- One day of work, unblocks daily use

### Phase B — Personas tab (requires Spec 01 Phase 2)

- New unified Personas component reading from `community:index`
- Filters and search
- Drilldown drawer with timeline + tags + notes

### Phase C — Eventos tab (requires Spec 01 Phase 2)

- Generic event detail component
- Replaces old BROTE tab
- Signup timeline + source breakdown per event

### Phase D — Panorama redesign (requires Phase B + C)

- New top row with durable metrics
- Active events strip
- Growth chart
- Activity feed

### Phase E — Campañas tab (requires Spec 03 shipped)

- Embed link builder + list + rollups

## Open questions

1. **Language:** Spanish throughout? Current is mixed. Recommendation: Spanish (you operate in Spanish daily; English pair only if you want a separate toggle).

2. **Tag taxonomy:** free-form with autocomplete, or a fixed vocabulary? Recommendation: free-form with autocomplete from existing values. Fixed vocab gets painful fast.

3. **Activity feed storage:** capped Redis LIST (cheap, O(1) writes) or computed from participations (slower but no new key)? Recommendation: capped LIST of length 200.

4. **Saved views / saved filters:** nice-to-have, low priority v1.

5. **Mobile:** admin is used primarily from desktop. Mobile responsive but not optimized.

6. **Export format:** CSV only for v1. No XLSX, no JSON API.

## Out of scope

- Email sending from within the admin (Resend covers this; no rebuild)
- Complex segment builder beyond the listed filters
- A/B testing content
- Scheduled reports / email digests
- Public analytics share links
- Real-time websocket updates (60s polling is fine)

## Acceptance criteria

- [ ] Site header says "Comunidad", not "BROTE Admin"
- [ ] Panorama tab shows community size, weekly growth, reactivation rate, and an active-events strip with traffic lights
- [ ] Personas tab shows every person in `community:index` (including BROTE-only buyers)
- [ ] Clicking a person opens a drilldown with timeline, tags, notes, and attribution
- [ ] Eventos tab lists all events and drills into per-event views with signup timeline and source breakdown
- [ ] Campañas tab embeds the link dashboard (when Spec 03 ships)
- [ ] No tab lives on a hardcoded event id — everything is discovered via `event:index`
