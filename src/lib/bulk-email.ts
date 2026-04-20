import type { CreateEmailOptions, CreateEmailResponse } from "resend";

// Minimal shape so tests can pass a fake. Real `Resend` instance satisfies it.
export type BulkEmailSender = {
  emails: { send(payload: CreateEmailOptions): Promise<CreateEmailResponse> };
};

export type BulkEmailFailure = {
  email: string;
  error: { name: string; message: string; statusCode: number | null };
};

export type BulkEmailResult = {
  sent: number;
  skipped: number;
  failed: BulkEmailFailure[];
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

  for (let i = 0; i < opts.audience.length; i++) {
    const recipient = opts.audience[i];
    const email = opts.getEmail(recipient);

    if (opts.shouldSkip && (await opts.shouldSkip(recipient))) {
      skipped++;
      continue;
    }

    let result: CreateEmailResponse;
    try {
      result = await opts.resend.emails.send(opts.build(recipient));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} threw for ${email}:`, err);
      failed.push({
        email,
        error: { name: "thrown", message, statusCode: null },
      });
      if (throttle > 0 && i < opts.audience.length - 1) await sleep(throttle);
      continue;
    }

    if (result.error) {
      console.error(
        `${prefix} failed for ${email}: ${result.error.name} — ${result.error.message}`,
      );
      failed.push({
        email,
        error: {
          name: result.error.name,
          message: result.error.message,
          statusCode: result.error.statusCode ?? null,
        },
      });
    } else {
      if (opts.onSent) await opts.onSent(recipient);
      sent++;
    }

    if (throttle > 0 && i < opts.audience.length - 1) await sleep(throttle);
  }

  return { sent, skipped, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
