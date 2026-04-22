# Mass email sends — runbook

How we send bulk transactional email from this repo, how failures are
surfaced, and how to recover when something drops on the floor.

## Architecture

All bulk sends route through `src/lib/bulk-email.ts`. The helper exists
because the Resend SDK does **not** throw on API errors — it returns a
`{data, error}` discriminated union. A naïve `try/catch` marks every
rate-limited (`429`) response as success and the message is silently lost.
That's exactly what happened on 2026-04-19 (see incident log below).

`sendBulkEmails()`:

- Calls `resend.emails.send()` for each recipient.
- Inspects `result.error` — only counts a send as successful when `data`
  is present.
- Throttles between sends (default `600ms` ≈ 1.6 req/s, under the Resend
  free tier's 2 req/s limit).
- Lets callers plug in idempotency via `shouldSkip` / `onSent` callbacks
  (typically Redis flags so retries don't double-send).
- Returns `{sent, skipped, failed, warnings}`:
  - `failed[]` — email did NOT go out. Safe to retry after fixing the
    cause (see recovery below).
  - `warnings[]` — email DID go out, but `onSent` threw so the
    idempotency flag wasn't set. **Do not clear flags and retry** for
    these addresses; a blind retry will double-send. Set the flag
    manually if you want to suppress the next run's re-attempt.

Every bulk-sending route then calls `notifyAdminOfCampaign()` from
`src/lib/admin-alert.ts`. That helper emails the admin whenever a run
finishes with **failures**, **warnings**, or a **reconciliation gap**
(see definitions below). Best-effort: never throws, so it can run at
the tail of a cron handler without wrapping.

The admin recipient is configured via the `ADMIN_ALERT_EMAIL` env var
(falls back to `h.solaas1@gmail.com` if unset — preserves current prod
behavior but should be set explicitly on any fork / new deployment).

Four distinct alert conditions, each actionable in a different way:

- **`failed.length > 0`** — emails that didn't go out. Classify by
  error code and retry (see recovery).
- **`warnings.length > 0`** — emails that went out but whose
  idempotency flag didn't get set. **Do NOT clear flags and retry.**
- **`gap = audienceSize - sent - skipped - failed.length ≠ 0`** —
  every recipient should end up in exactly one bucket. `gap ≠ 0` means
  counts don't reconcile (positive = lost recipients, negative =
  double-counting). Real bug — investigate in Vercel logs, don't just
  retry.
- **`missingEmails > 0`** — confirmed attendees that never entered
  the audience because they have no email on file. Surfaces data
  quality issues the helper can't see. Fix the `people` table (or
  whatever upstream source) before the next run.

**Caveat:** if Resend is rate-limiting the main campaign hard enough,
the alert email itself can 429. That failure surfaces as
`adminAlert: { notified: false, reason: "rate_limit_exceeded" }` in the
cron handler's JSON response (also visible in Vercel logs). So: if a
campaign ran and you didn't get an alert email in your inbox, don't
conclude everything was fine — check the cron response first.

## Current bulk senders

| Route | Campaign name | Idempotency key | Cron |
|---|---|---|---|
| `src/lib/plant-reminder.ts` (via `/api/cron/plant-reminder`) | `plant-day-of-reminder-2026-04-19` | `plant:rsvp:<rsvpId>:day-of-reminder` | `0 13 19 4 *` (one-shot, 2026-04-19) |
| `src/app/api/sinergia/send-reminders/route.ts` | `sinergia-reminder-<YYYY-MM-DD>` | `sinergia:rsvp:<rsvpId>:reminder` | `0 13 * * 3` (weekly, Wednesdays) |
| `src/app/api/sinergia/admin/route.ts` (`send-first-session-extras`) | `sinergia-first-session-extras-<YYYY-MM-DD>` | `sinergia:rsvp:<rsvpId>:first-session-extra` | admin-triggered (one-off) |

`src/app/api/brote/admin/route.ts` also has a `plant-send-reminder`
admin action that wraps `runPlantReminderCampaign` — useful for preview
mode and for re-running with an `audienceOverride`.

The `send-first-session-extras` action also embeds a trackable WhatsApp
link (`/api/sinergia/menu-click?r=<rsvpId>&s=<sessionDate>`) in the email
body. Clicks land in Redis as `sinergia:menu-click:<sessionDate>:<rsvpId>`
(first-click timestamp) and `sinergia:menu-clicks:<sessionDate>` (SET of
rsvpIds) before the 302 to `wa.me`.

## Adding a new bulk send

1. Build the audience and the email template.
2. Pick an idempotency key pattern: `<campaign-prefix>:rsvp:<rsvpId>:<event>`.
3. Call `sendBulkEmails` with `shouldSkip` / `onSent` reading and setting
   that Redis key.
4. Call `notifyAdminOfCampaign` at the end. Pass a stable `campaign`
   slug so the admin inbox stays greppable.
5. Add the route (or the campaign) to the "Current bulk senders" table
   above.

Do **not** call `resend.emails.send` directly in a loop. If you see a
`try { resend.emails.send(...); sent++ } catch { failed++ }` in a PR,
block it — that's the 2026-04-19 bug.

## Recovery protocol

When the admin alert email lands (or you notice a gap some other way):

1. **Don't panic-retry.** The idempotency flags are real — blindly
   curling the cron again will just skip every address that made it
   through on the first attempt.
2. **Read the alert.** It lists failed emails with the Resend error code
   (`rate_limit_exceeded`, `validation_error`, etc.) and the gap count.
3. **Classify the failures:**
   - `rate_limit_exceeded` → retry, with a longer throttle (`throttleMs`
     ≥ `1000`).
   - `validation_error` / `invalid_from_address` → fix the payload; retry
     will keep failing until you do.
   - `monthly_quota_exceeded` / `daily_quota_exceeded` → bump the Resend
     plan or wait for reset; don't retry in the meantime.
   - `ambiguous_response` → the SDK returned neither data nor error.
     Could be SDK drift. Check Resend's dashboard to see whether the
     email actually went out before retrying.
   - Anything 5xx → Resend-side, usually safe to retry after a few
     minutes.

   **Warnings are separate.** `onSent hook threw` means the email
   was delivered but the idempotency flag isn't set. Options:
   (a) accept that the next cron run will re-send — harmless if the
   campaign is one-shot and the cron won't fire again; or (b) set
   the Redis flag manually for each warning email to suppress the
   resend. Never clear a warning's flag.
4. **Clear the stale flags for failed recipients only.** The
   failing-recipient emails never actually sent, so the flag (if set) is
   wrong. Delete each `plant:rsvp:<id>:day-of-reminder` (or equivalent
   sinergia key) from Redis for the failed addresses.
5. **Retry.** Options:
   - For a small number of recipients, use the admin route with
     `audienceOverride: ["a@x", "b@y"]`.
   - For everyone, just re-hit the cron URL — flags will skip the
     already-delivered ones.
   - For extreme rate-limit situations (what we did on 2026-04-19 after
     two failed rounds), send one-by-one with a longer pause.
6. **Verify.** Check Resend's dashboard (filter by subject) and a few
   inboxes. Don't trust the `sent` counter alone — it reflects
   `result.data` presence, not delivery.
7. **Write down what happened.** Append to the incident log at the
   bottom of this file. Include: date, campaign, audience size, final
   delivery count, root cause, fix.

## Incident log

### 2026-04-19 — Plantación day-of reminder

- **Audience:** 34 confirmed registrants for `plant-2026-04`.
- **First cron run (10:00 ART):** reported `sent: 34`. Actual deliveries: 15.
- **Root cause:** The loop wrapped `resend.emails.send()` in a
  `try/catch`. The SDK returns `{error: {name: 'rate_limit_exceeded',
  ...}, data: null}` on 429 responses — it does **not** throw. Every
  rate-limited response was counted as a success, the Redis flag was
  set, and the address was lost.
- **First recovery:** Deleted the 19 stale Redis flags for undelivered
  addresses, re-ran the admin action with `audienceOverride`. Only 10
  more delivered — same bug, same 429s, same silent failure.
- **Final recovery:** Deleted the remaining 9 flags and sent one-by-one
  with a 2s sleep between sends. All 34 delivered.
- **Fix:** Introduced `sendBulkEmails` + `notifyAdminOfCampaign`. The
  loop now checks `result.error` directly and only marks success when
  `result.data` is present. The admin alert email surfaces failure
  details and any gap between audience size and deliveries, so the next
  silent failure stops being silent.
