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
- Returns `{sent, skipped, failed: [{email, error: {name, message, statusCode}}]}`.

Every bulk-sending route then calls `notifyAdminOfCampaign()` from
`src/lib/admin-alert.ts`. That helper emails `h.solaas1@gmail.com`
whenever a run finishes with `failed.length > 0` **or** a
non-zero `audienceSize - sent - skipped` gap. Best-effort: never throws,
so it can run at the tail of a cron handler without wrapping.

## Current bulk senders

| Route | Campaign name | Idempotency key | Cron |
|---|---|---|---|
| `src/lib/plant-reminder.ts` (via `/api/cron/plant-reminder`) | `plant-day-of-reminder-2026-04-19` | `plant:rsvp:<rsvpId>:day-of-reminder` | `0 13 19 4 *` (one-shot, 2026-04-19) |
| `src/app/api/sinergia/send-reminders/route.ts` | `sinergia-reminder-<YYYY-MM-DD>` | `sinergia:rsvp:<rsvpId>:reminder` | `0 13 * * 3` (weekly, Wednesdays) |

`src/app/api/brote/admin/route.ts` also has a `plant-send-reminder`
admin action that wraps `runPlantReminderCampaign` — useful for preview
mode and for re-running with an `audienceOverride`.

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
   - Anything 5xx → Resend-side, usually safe to retry after a few
     minutes.
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
