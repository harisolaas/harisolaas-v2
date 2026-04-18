# Spec 03 — Link Builder

## Goal

Give Hari an in-admin tool to create tracked short links in under 10 seconds, attribute every click and signup back to a specific link, and surface which channels and pieces of content actually build the community.

Success looks like: instead of "27 of 29 plant signups are orgánico," every signup has a readable attribution like "IG Story · 17 abr · plant push with basketball photo," and the Campañas tab can sort links by "people who became 2+ event attendees" to show which content formats compound.

## Why

The single biggest analytical gap in the current setup. Emails have attribution (1.4% CVR on the "pala" email, 0% on email 2). Everything else is opaque. 93% of plant signups are labeled "orgánico" because Instagram links have no UTMs. Hari can't tell whether his stories work, whether his posts work, whether his WhatsApp pushes work — the answer is always "probably yes, but we don't know."

## Dependencies

- **Requires Spec 01 (data model)** for `AttributionTouch` on participations to work consistently across all event types. Without Spec 01, attribution can only be captured for plant signups (which already have `utm` field); BROTE and Sinergia remain blind.
- **Independent of Spec 02** — the link builder can ship as its own admin page before the dashboard rebuild. When Spec 02's Campañas tab lands, it reuses these components.

## Scope

### Entities

```typescript
type ChannelKey =
  | "ig-story" | "ig-post" | "ig-reel" | "ig-ad" | "ig-dm" | "ig-bio"
  | "email-campaign" | "email-personal"
  | "wa-group" | "wa-broadcast" | "wa-personal"
  | "direct" | "press" | "partner" | "other";

interface TrackedLink {
  slug: string;              // "ig-story-20260417-a7x"
  destination: string;       // "/es/plantacion" — path or full URL
  label: string;             // "IG Story · 17 abr 2026" (auto, editable)
  channel: ChannelKey;
  source: string;            // derived: "instagram"
  medium: string;            // derived: "story"
  campaign?: string;         // optional grouping: "plant_launch"
  resourceUrl?: string;      // optional — URL of the actual post/story, editable anytime
  note?: string;             // optional — freetext, editable anytime
  createdAt: string;         // ISO
  createdDate: string;       // YYYY-MM-DD — the date embedded in slug (user-selectable, defaults today)
  createdBy: string;         // admin email
  status: "active" | "archived" | "disabled";
  version: 1;
}
```

### Storage (updated post–Spec 01)

Links live in Postgres, not Redis. The original Redis-keys design here predates the Postgres migration (Spec 01) and has been superseded:

- `links` table — one row per tracked link. FK target for `participations.link_slug`.
- `link_clicks` table — append-only row per GET `/go/{slug}`. Bot-UA hits are stored with `is_bot = true` so they can be audited but excluded from visible counts.
- Rollups (clicks, signups, CVR, stickiness) are derived SQL queries in `src/app/api/admin/links/**`.
- Daily sparklines come from `date_trunc('day', clicked_at)` over `link_clicks`.

### Channel → UTM mapping

| ChannelKey | utm_source | utm_medium | Display |
|---|---|---|---|
| ig-story | instagram | story | IG Story |
| ig-post | instagram | post | IG Post |
| ig-reel | instagram | reel | IG Reel |
| ig-ad | instagram | ad | IG Ad |
| ig-dm | instagram | dm | IG DM |
| ig-bio | instagram | bio | IG Bio |
| email-campaign | email | campaign | Email campaña |
| email-personal | email | personal | Email personal |
| wa-group | whatsapp | group | WhatsApp grupo |
| wa-broadcast | whatsapp | broadcast | WhatsApp broadcast |
| wa-personal | whatsapp | personal | WhatsApp personal |
| direct | direct | direct | Directo |
| press | press | article | Prensa |
| partner | partner | referral | Partner |
| other | other | other | Otro |

`utm_campaign` = user's `campaign` field if set, else derived from destination path (`/plantacion` → `plantacion`, `/brote` → `brote`).

`utm_content` = always equals the slug. This is the unbreakable back-reference — even if someone strips other UTMs, the slug survives and identifies the link.

### Slug generation

Pattern: `{channelShort}-{YYYYMMDD}-{nanoid(3)}`

ChannelShort mapping (fixed table):
- ig-story → `ig-story`
- ig-post → `ig-post`
- ig-reel → `ig-reel`
- ig-ad → `ig-ad`
- ig-dm → `ig-dm`
- ig-bio → `ig-bio`
- email-campaign → `email`
- email-personal → `email-dm`
- wa-group → `wa-group`
- wa-broadcast → `wa-bc`
- wa-personal → `wa-dm`
- direct → `direct`
- press → `press`
- partner → `partner`
- other → `other`

Examples: `ig-story-20260417-a7x`, `email-20260420-k3m`, `wa-group-20260418-p2n`.

nanoid(3) produces a 3-char alphanumeric suffix. Collision probability within a day is negligible at current volumes. On collision, retry once with a new suffix.

### Auto-generated label

`{ChannelDisplay} · {DD MMM YYYY}` in Spanish locale.

Examples: "IG Story · 17 abr 2026", "Email campaña · 20 abr 2026", "WhatsApp grupo · 18 abr 2026".

Editable inline from the links list. Slug does not change when label changes.

## Redirect route

New route: `src/app/go/[slug]/route.ts`

### Behavior

On GET:

1. Load `link:{slug}`. If not found or `status != "active"`, redirect to `/` (or a friendly 404).
2. Build destination URL:
   - If `link.destination` starts with `http`, use as-is.
   - Otherwise, prefix with `https://www.harisolaas.com`.
   - Append query params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content=slug`.
   - Preserve any existing query on destination.
3. Set cookie `haris_link={slug}` with:
   - Max-Age: 30 days
   - Path: /
   - SameSite: Lax
   - HttpOnly: false (landing pages may read it client-side for ancillary purposes)
4. `INCR link:{slug}:clicks`
5. `INCR link:{slug}:clicks:daily:{today}`
6. Bot filter: skip the INCRs if user-agent matches common bot patterns (googlebot, bingbot, facebookexternalhit, etc.). Still serve the redirect.
7. Return 302 redirect.

### Idempotency / double-counting

Each page load increments. No per-IP dedup (too brittle, and bot filter handles the worst). Accept that clicks are roughly but not exactly counted — signup counts are the ground truth.

## Attribution capture on signup

Update every signup handler (brote webhook, plant register, sinergia RSVP) to build an `AttributionTouch`:

```typescript
function extractAttribution(req: Request): AttributionTouch {
  // 1. Prefer URL params (if form submission preserved them)
  const utm = extractUtmFromBody(req.body);
  // 2. Fall back to cookie
  const linkSlug = getCookie(req, "haris_link");
  // 3. Combine, prefer URL-provided over cookie for this specific signup
  return {
    linkSlug: utm.content ?? linkSlug,
    source: utm.source,
    medium: utm.medium,
    campaign: utm.campaign,
    content: utm.content,
    referrer: req.headers.get("referer") ?? undefined,
    capturedAt: new Date().toISOString(),
  };
}
```

This `AttributionTouch` is stored on `participation.attribution` (per Spec 01's schema). If it's the person's first participation, it's also copied to `person.firstTouch`.

When `linkSlug` is populated, also `SADD link:{slug}:participations participationId` for fast reverse lookup.

**Edge cases:**
- User clicks link, signs up days later in same browser: cookie still present (within 30d) → attributed.
- User clicks link, clears cookies, signs up: no attribution → shows as "directo."
- User clicks link, then clicks another link, then signs up: last-click wins (cookie overwritten on each /go/ hit).
- User arrives via URL with UTMs but no /go/ slug (e.g. someone shared a decorated URL): UTMs captured, `linkSlug` empty → still attributed to channel/source/medium, just not to a specific link.

## UI — creation flow

### Entry point

Admin → Campañas (Spec 02) → "Nuevo enlace" button. If Spec 02 isn't shipped yet, add a standalone page `/admin/links` that lists and creates links.

### Form

Three always-visible fields:

1. **Destino** — dropdown of known landing pages (`/es`, `/es/brote`, `/es/plantacion`, `/es/sinergia`) + "Otra página…" option that reveals a URL input.
2. **Canal** — dropdown grouped by category:
   - Instagram (Story, Post, Reel, Ad, DM, Bio link)
   - Email (Campaña, Personal)
   - WhatsApp (Grupo, Broadcast, Personal)
   - Otro (Directo, Prensa, Partner, Otro)
3. **Fecha** — date picker, defaults to today. This is the date embedded in the slug. User can pick tomorrow if creating a link for a scheduled post.

Collapsible "Más detalles" section:

- **Etiqueta** — label override (default is auto-generated).
- **Campaña** — optional freetext with autocomplete of existing campaign values.
- **URL del recurso** — optional. "Paste the URL of the actual post/story later."
- **Nota** — optional freetext.

Button: **Crear enlace**.

### On submit

- Generate slug: `{channelShort}-{formatDate(createdDate)}-{nanoid(3)}`. Retry once if collision.
- Auto-generate label if not overridden.
- Save `TrackedLink` to `link:{slug}`.
- Add to `link:index`, `link:by-channel:{channel}`, `link:by-campaign:{campaign}` (if set).
- Return to result screen:
  - Full short URL: `https://www.harisolaas.com/go/{slug}` — with large copy button
  - Preview: "Redirige a: /es/plantacion?utm_source=instagram&utm_medium=story&utm_campaign=plantacion&utm_content={slug}"
  - Two action buttons: "Crear otro" (empty form) and "Duplicar" (pre-filled with same values — swap the channel for multi-channel push)

Target creation time end-to-end: under 10 seconds for the 80% case.

## UI — list view

Columns:

| Column | Notes |
|---|---|
| Etiqueta | Click to edit inline |
| Canal | Chip |
| Destino | Short path, truncated |
| Fecha | createdDate |
| Clicks | link:{slug}:clicks |
| Signups | SCARD link:{slug}:participations |
| CVR | signups / clicks, % |
| Permanencia | Stickiness — see below |
| Campaña | Chip, if set |
| Estado | active / archived / disabled |

Default sort: `createdAt` desc. Secondary sorts per column.

Filters: channel, campaign, destination, status, date range, text search on label.

Click row → link detail.

### Stickiness metric

Definition: of the people attributed to this link, what percentage have 2+ total participations across all events.

```
stickiness(link) = count(people with participation via link AND >= 2 total participations) /
                   count(people with participation via link)
```

Displayed as a percentage in the links table. Higher = this content brought in people who stuck around. Lower = this content brought one-shot signups.

This is the metric that separates vanity content from community-building content.

## UI — link detail

Route or drawer showing:

**Header:** label (editable), status toggle, channel chip, campaign chip.

**Short URL** with copy button.

**Metadata:** destination, created, created by, resource URL (editable), note (editable).

**Stats block:**
- Clicks (total)
- Signups (total)
- CVR
- Stickiness
- First click + last click timestamps

**Click history chart:** line chart, daily clicks from `link:{slug}:clicks:daily:*`.

**Attributed people:** reuses Personas table component, filtered to `link:{slug}:participations` members.

**Actions:**
- Duplicate (pre-fills creation form)
- Archive
- Disable
- Delete (with confirmation — only if no signups attributed)

## UI — rollup views

Side toggle or sub-tabs within Campañas:

### By channel

Table grouped by `channel`:

| Canal | Enlaces | Clicks | Signups | CVR | Permanencia |
|---|---|---|---|---|---|
| IG Story | 12 | 842 | 23 | 2.7% | 34% |
| IG Post | 4 | 156 | 5 | 3.2% | 60% |
| Email campaña | 2 | 138 | 1 | 0.7% | 100% |

Answers: "which channel actually brings me community?"

### By campaign

Same structure, grouped by `campaign` field. Answers: "did my plant_launch push work, aggregated across channels?"

## Rollout plan

### Phase 1 — Foundation

- Types and Redis helpers (`src/lib/links.ts`)
- `/go/[slug]` redirect route
- Seed attribution capture into existing plant and sinergia handlers (brote comes with Spec 01)
- Admin list page at `/admin/links` (simple scaffold)

### Phase 2 — Creation flow

- Nuevo enlace form with full field set
- Auto-slug, auto-label
- Duplicate button
- Result screen with copy

### Phase 3 — Link detail + edit

- Edit label, resource URL, note, status inline
- Per-link detail page with stats and click chart
- Attributed people table

### Phase 4 — Rollups

- By-channel rollup view
- By-campaign rollup view
- Stickiness metric (requires Spec 01's unified participations — otherwise can only compute for plant/sinergia)

### Phase 5 — Integration

- Fold into Spec 02's Campañas tab when it ships
- Panorama's "first-touch source" stacked growth chart uses link attribution

## Metrics / definitions glossary

- **Click** — one GET to /go/{slug}, minus obvious bots.
- **Signup** — one participation with `attribution.linkSlug == slug`.
- **CVR (conversion rate)** — signups / clicks.
- **Stickiness** — of attributed signups, fraction with 2+ total participations.
- **First touch** — a person's earliest captured AttributionTouch, set on first participation.
- **Last touch (for event)** — the attribution captured on a specific participation.

## Open questions

1. **Cookie lifetime.** 30 days default. Could extend to 90d for slower-converting audiences. Start at 30, revisit if stickiness metrics show we're losing attributions.

2. **Bot filtering aggressiveness.** Start with a simple user-agent regex. If click counts feel inflated (say, 10× signups with no growth), add stricter filtering or per-IP dedup.

3. **Multi-touch attribution.** Currently last-click wins. In reality people see a story, see another story, read an email, then sign up. Single-touch is simpler and acceptable for v1; the stickiness metric is the safety net (if channel X wins last-click but stickiness is 0, the real builder is upstream).

4. **Permission model.** Only admin users can create/edit/delete links. Check `requireAdminSession` on every endpoint.

5. **Short link branding.** `/go/` is generic. Alternatives: `/l/`, `/ir/` (Spanish), `/e/` (enlace). Recommendation: stick with `/go/` — shorter, conventional, doesn't conflict with existing routes.

6. **Existing UTM traffic.** Existing plant registrations have `utm` but no `linkSlug`. Back-fill by pattern-matching `utm_campaign == "plantacion_email1"` → a pre-seeded link record. One-shot migration script.

## Out of scope

- A/B testing (two destinations, randomized)
- Dynamic destination (country-based, device-based)
- Paid ad cost tracking (cost per signup)
- External analytics integrations (IG Insights, etc.)
- Shareable public analytics pages
- QR code generation (nice-to-have, ~1 afternoon later)

## Acceptance criteria

- [ ] Admin can create a tracked link in under 10 seconds using the form
- [ ] Visiting `/go/{slug}` redirects to the destination with UTMs appended and increments the click counter
- [ ] A signup arriving via a tracked link shows the link in the person's drilldown as "Llegó por {label}"
- [ ] The links list shows clicks, signups, CVR, and stickiness per link
- [ ] By-channel rollup correctly aggregates across all links of a channel
- [ ] Duplicate button creates a new link pre-filled with the original's values
- [ ] Archiving a link removes it from the default list but preserves its historical stats
- [ ] Disabling a link makes `/go/{slug}` stop redirecting while preserving stats
