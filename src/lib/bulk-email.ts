import type { CreateEmailOptions, CreateEmailResponse } from "resend";

// Minimal shape so tests can pass a fake. Real `Resend` instance satisfies it.
export type BulkEmailSender = {
  emails: { send(payload: CreateEmailOptions): Promise<CreateEmailResponse> };
};

export type BulkEmailFailure = {
  email: string;
  error: { name: string; message: string; statusCode: number | null };
};

// Email was delivered successfully but something went wrong after the fact
// (e.g. the idempotency-flag callback threw). The recipient IS in `sent`;
// this bucket exists so the admin alert fires and so the runbook can tell
// the operator *not* to clear flags and retry (which would double-send).
export type BulkEmailWarning = {
  email: string;
  reason: string;
};

export type BulkEmailResult = {
  sent: number;
  skipped: number;
  failed: BulkEmailFailure[];
  warnings: BulkEmailWarning[];
};

export interface SendBulkEmailsOpts<T> {
  audience: T[];
  resend: BulkEmailSender;
  getEmail: (recipient: T) => string;
  build: (recipient: T) => CreateEmailOptions;
  // Return true to skip a recipient (e.g. idempotency flag already set).
  shouldSkip?: (recipient: T) => Promise<boolean> | boolean;
  // Called after a successful send (e.g. set the idempotency flag).
  onSent?: (recipient: T) => Promise<void> | void;
  // Delay between sends to stay under Resend's rate limit (default 2 req/sec).
  throttleMs?: number;
  // Prefix for console.error lines so incident logs are greppable.
  logPrefix?: string;
}

const DEFAULT_THROTTLE_MS = 600;

/**
 * Send the same transactional email to every recipient in an audience.
 *
 * The Resend SDK returns `{data, error}` instead of throwing on API errors
 * (including 429 rate limits). A naive try/catch treats every error as
 * success — that's the bug that cost us 19 undelivered emails on
 * 2026-04-19. This helper inspects `result.error` directly and only marks
 * a send as successful when `data` is present.
 *
 * Callers plug in their own idempotency via `shouldSkip` / `onSent`
 * (typically Redis flags).
 */
export async function sendBulkEmails<T>(
  opts: SendBulkEmailsOpts<T>,
): Promise<BulkEmailResult> {
  const throttle = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
  const prefix = opts.logPrefix ?? "bulk-email";

  let sent = 0;
  let skipped = 0;
  const failed: BulkEmailFailure[] = [];
  const warnings: BulkEmailWarning[] = [];

  for (let i = 0; i < opts.audience.length; i++) {
    const recipient = opts.audience[i];
    const email = opts.getEmail(recipient);

    if (opts.shouldSkip && (await opts.shouldSkip(recipient))) {
      skipped++;
      continue;
    }

    let sendResult: CreateEmailResponse | null = null;
    try {
      sendResult = await opts.resend.emails.send(opts.build(recipient));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} threw for ${email}:`, err);
      failed.push({
        email,
        error: { name: "thrown", message, statusCode: null },
      });
    }

    if (sendResult?.error) {
      console.error(
        `${prefix} failed for ${email}: ${sendResult.error.name} — ${sendResult.error.message}`,
      );
      failed.push({
        email,
        error: {
          name: sendResult.error.name,
          message: sendResult.error.message,
          statusCode: sendResult.error.statusCode ?? null,
        },
      });
    } else if (sendResult?.data) {
      // The email went out. Count as sent before onSent so a Redis hiccup
      // in the callback doesn't drop the delivery from the tally — the
      // delivery count stays honest, and the warning fires separately.
      sent++;
      if (opts.onSent) {
        try {
          await opts.onSent(recipient);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `${prefix} onSent failed for ${email} — email delivered but flag unset:`,
            err,
          );
          warnings.push({
            email,
            reason: `onSent hook threw: ${msg}. Email was delivered but the idempotency flag is NOT set — a blind retry will double-send this recipient.`,
          });
        }
      }
    } else if (sendResult) {
      // SDK returned `{data: null, error: null}` — shouldn't happen per
      // Resend's types, but treat it as a failure rather than silently
      // counting as success. Defensive against SDK drift.
      console.error(
        `${prefix} ambiguous response for ${email}: no data and no error`,
      );
      failed.push({
        email,
        error: {
          name: "ambiguous_response",
          message: "Resend returned neither data nor error",
          statusCode: null,
        },
      });
    }

    if (throttle > 0 && i < opts.audience.length - 1) await sleep(throttle);
  }

  return { sent, skipped, failed, warnings };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
