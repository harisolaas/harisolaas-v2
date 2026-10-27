# Registration / checkout form analytics — the standard

Every registration or ticket form (Hackeá, BROTE, Sinergia, whatever comes
next) emits the events below. The goal is that a funnel with zero sales can
be explained from dashboards in five minutes, not reconstructed from session
recordings.

**Why this exists:** the Hackeá tu mente landing (Oct 2026) got ~750 visits
and 0 sales, and we only learned where people dropped off by digging through
PostHog autocapture and recordings. There was no event for form start, field
errors, submit attempts or server rejections; Meta `InitiateCheckout` only
fires after the server accepts, so client-side validation failures were
invisible in Meta *and* in the DB; there was no error monitoring; and Vercel
Hobby keeps runtime logs ~1h, so the 4xx/5xx history was gone.

## Rules

- **No PII in event properties.** Never send name, phone, email or free-text
  values to PostHog or as Meta custom data. Field *names* and error *codes*
  only. (CAPI `user_data` in `src/lib/meta-capi.ts` carries only IP, UA,
  `fbp`, `fbc`; if we ever add email/phone there, it must be SHA-256 hashed
  per Meta's spec.) Keep recordings' input masking on.
- **Same names on every form.** Event names are fixed (table below); the form
  is identified by the `form` property, not by a different event name.
- **One attempt id per submit.** Generate the id once per submit (the
  Hackeá form already does: `crypto.randomUUID()`), send it as
  `attempt_id` on every PostHog event of that submit, as the Meta `eventID`,
  and in the request body so the server logs it too. That id is how a client
  event, a server log line and a Meta event get joined.
- **Only what we read.** Don't add events nobody will look at. If an event
  isn't in the table, it needs a question it answers.

## PostHog events (client, `posthog.capture`)

Common properties on all of them: `form` (e.g. `hackea-checkout`),
`event_id` of the event being sold (e.g. `hackea-tu-mente-2026-10-29`),
`locale`. Wrap the calls in small helpers in `src/lib/analytics.ts`, next to
`trackCtaClick`.

| Event | When | Extra properties |
|---|---|---|
| `form_viewed` | Form scrolls into view (once per page load) | — |
| `form_started` | First focus on any field (once per page load) | `field` |
| `form_field_error` | A field fails validation (on blur or submit) | `field`, `code` (e.g. `phone_invalid`, `required`, `too_long`) |
| `form_submit_attempted` | Submit pressed, before validation | `attempt_id`, `quantity` if relevant |
| `form_submit_rejected` | Client validation blocked the submit | `attempt_id`, `fields` (array of names) |
| `form_server_accepted` | API answered 2xx | `attempt_id`, `participation_id` |
| `form_server_rejected` | API answered non-2xx, or the fetch threw | `attempt_id`, `status` (0 for network), `error` (server code: `phone`, `already_paid`, `closed`, `server`…) |
| `payment_redirected` | Right before `window.location = initPoint` | `attempt_id`, `provider` (`mercadopago`) |

Error codes come from the shared validator (`validateHackeaLead` and
equivalents), so client and server speak the same codes.

## Meta pixel + CAPI

- `PageView` (layout) and `ViewContent` (landing mount) — standard.
- **`InitiateCheckout` = the server accepted the lead** (pending row written,
  payment preference created). Fire it browser-side on 2xx and server-side via
  CAPI with the **same `event_id`** (the attempt id). This is the existing
  Hackeá pattern; keep it. Don't move it earlier to "see" failed submits —
  that's PostHog's job, and inflating `InitiateCheckout` poisons optimisation.
- `Purchase` — CAPI only, from the payment webhook, once per payment.
- **No un-deduplicated duplicates.** Any event that reaches Meta from both the
  browser and a server (ours or a Meta-side CAPI gateway/integration) needs a
  shared `eventID`. In Oct 2026 `PageView`/`ViewContent`/`Vsl*` showed ~50%
  BROWSER / ~50% SERVER without an eventID, so counts look doubled: either
  find and switch off the mirroring integration in Events Manager, or pass an
  `eventID` on those browser calls so the mirror dedupes.
- Custom events (`VslPlay`, `VslCta`) only for things we'd build an audience
  or a report on.

## Server-side (the checkout route)

- **Persist every non-2xx outcome**, because Vercel logs vanish in ~1h. One
  line per rejection with `form`, `attempt_id`, `status`, `error`, timestamp,
  user-agent family, `in_app` (Instagram/Facebook UA) — no body fields.
  Default: a PostHog server event `checkout_server_rejected` via
  `posthog-node` (no migration). Use a small DB table instead only if we need
  to join it against `participations` in SQL.
- Keep **writing the pending participation before creating the payment
  preference** (Hackeá/Sinergia pattern) — abandoned checkouts stay as leads.
- Keep `attribution` jsonb on the participation (UTMs + `/go/[slug]`
  cookie via `readBrowserAttribution`).

## Client error capture

Unhandled errors and promise rejections must reach somewhere persistent:
turn on PostHog exception autocapture (`$exception` events) — or Sentry's free
tier if we want stack traces with source maps. Either is fine; having none is
not.

## Known gap: identity across visits

PostHog runs cookieless (`persistence: "memory"`, no consent banner), so a
person who comes back tomorrow is a new anonymous user. That's a deliberate
privacy choice — don't change it as a side effect of a form PR. Within one
page load, `attempt_id` + `participation_id` are enough to join the funnel.

## Verify before launching a campaign

Do this on prod, on the exact URL the ad will use (a `/go/` link):

- [ ] Submit once with a deliberately invalid phone, then a valid one, in the
      **Instagram in-app browser on iOS** and again on **Android**.
- [ ] PostHog (live events): `form_viewed`, `form_started`,
      `form_field_error`, `form_submit_attempted`, `form_submit_rejected`,
      `form_server_accepted`, `payment_redirected` all show, with no PII in
      properties.
- [ ] Meta Events Manager → Test events: `PageView`, `ViewContent`,
      `InitiateCheckout` arrive, and `InitiateCheckout` shows as
      deduplicated (browser + server, one event).
- [ ] DB: the `pending` participation exists, with `attribution` naming the
      `/go/` slug; `link_clicks` has the click.
- [ ] Force a server error path (e.g. a phone already paid → 409) and confirm
      `form_server_rejected` and the server-side rejection record both show.
- [ ] Cancel the test participation in the admin afterwards.
