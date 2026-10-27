# Meta ads playbook — lessons learned

Living document. Add a dated entry whenever a campaign teaches us something;
promote a lesson to the checklist once it has held up. Newest entries first.

## Checklist for every paid campaign

1. **Placements: manual, Instagram + Facebook only** — feed, stories, reels.
   Exclude Audience Network for event-ticket sales.
2. **Every ad link is a `/go/[slug]` tracked link** (create it in the admin
   link builder). Never link straight to the landing — without the slug,
   `link_clicks` and the participation's `attribution` can't tell us which ad
   brought whom.
3. **Run the pre-launch verification** in
   [`form-analytics.md`](./form-analytics.md#verify-before-launching-a-campaign)
   before spending a peso: real submit in the Instagram in-app browser (iOS +
   Android), events in PostHog and Meta Test events, pending row in the DB.
4. **Monitor the funnel daily** while the campaign runs:
   `link_clicks` (non-bot) → PostHog `form_viewed` / `form_started` /
   `form_submit_attempted` → `form_server_accepted` → `participations`
   (pending → confirmed). Compare Meta's link clicks with `link_clicks` — a big
   gap means low-quality traffic or a broken link.
5. **Pause rule:** after ~100 real (non-bot) visits with clicks but **no
   `form_started`**, pause and investigate before spending more — the page,
   the offer or the traffic is broken, and more budget won't fix it. Same if
   there are form starts but no `form_server_accepted`.

## Entries

### 2026-10 — Hackeá tu mente (charla paga, 29 Oct 2026)

- **Audience Network burned the budget.** With automatic placements, AN
  produced 77% of link clicks at a 31–36% CTR — accidental, low-intent taps —
  and 0 sales. A CTR that high is a red flag, not a win. → Manual placements,
  IG/FB feed, stories and reels only.
- **We couldn't see the drop-off.** ~750 visits, 0 sales, and the only way to
  find where people stopped was PostHog autocapture + session recordings: no
  form events, no record of client validation failures or server rejections,
  Vercel logs gone after ~1h. → The form analytics standard in
  [`form-analytics.md`](./form-analytics.md) and the daily funnel check above.
- **Where it actually leaked.** PostHog showed ~26 sessions tapping the CTA,
  ~19 touching the form and 9 real visitors (Android, from the ads) pressing
  submit — all blocked by client validation with WhatsApp (often name too)
  left empty, the errors partly hidden under the sticky header. None reached
  the server, so the DB and Meta both read "0". The owner's own submits
  (desktop and Instagram in-app on iPhone) worked: test with the form's
  real friction in mind, not just "does it go through".
- **Meta counts looked doubled.** `PageView`/`ViewContent`/`Vsl*` arrived
  ~50% browser / ~50% server with no `eventID`, so Meta couldn't dedupe them.
  Trust `InitiateCheckout` (shared event id) and our own DB over Meta's
  top-of-funnel counts until that's fixed.
- **What worked and stays:** `/go/` tracked links with `link_clicks` (UA,
  referer, ip_hash, is_bot), `attribution` on participations, and writing the
  pending participation before the MercadoPago preference.
