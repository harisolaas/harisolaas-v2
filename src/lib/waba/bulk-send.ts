import {
  WabaClientError,
  WabaTemplateNotApprovedError,
  type WabaTemplateDefinition,
  type WabaTemplateVariables,
} from "./types";
import { sendWabaTemplate } from "./send";

// Bulk WhatsApp template send with the same shape as
// `sendBulkEmails` from `src/lib/bulk-email.ts` so cron / admin
// callers can use the two side-by-side without learning a second
// API. Failures are captured per-recipient and returned to the
// caller; one bad number never aborts the whole campaign.

export type BulkWabaFailure = {
  to: string;
  error: {
    name: string;
    message: string;
    statusCode: number | null;
    metaErrorCode: string | null;
  };
};

// Successfully delivered to Meta but the post-send callback (e.g.
// idempotency flag write) threw. Same semantics as the email
// helper's warning bucket: do NOT retry blindly — that would
// double-send.
export type BulkWabaWarning = {
  to: string;
  reason: string;
};

export type BulkWabaResult = {
  sent: number;
  skipped: number;
  failed: BulkWabaFailure[];
  warnings: BulkWabaWarning[];
};

export interface SendBulkWabaOpts<T> {
  audience: T[];
  template: WabaTemplateDefinition;
  // E.164 digits-only (no leading +). Use phoneToWaMe(...) at the
  // call site if you start from a stored phone string.
  getTo: (recipient: T) => string;
  // Build the variable map for this recipient. Same shape as the
  // template expects; runtime-validated inside `sendWabaTemplate`.
  buildVariables: (recipient: T) => WabaTemplateVariables;
  // Optional foreign key into `people` for the message row.
  getPersonId?: (recipient: T) => number | null | undefined;
  // Idempotency hooks (typically Redis flags), mirroring the bulk
  // email helper.
  shouldSkip?: (recipient: T) => Promise<boolean> | boolean;
  onSent?: (
    recipient: T,
    result: { messageId: string },
  ) => Promise<void> | void;
  // Optional URL-button param resolver if the template has a URL
  // button with a runtime variable.
  buildUrlButtonParams?: (
    recipient: T,
  ) => Array<{ index: number; param: string }> | undefined;
  // Persisted on each message row (campaign column) so admin views
  // can answer "how did the last Sinergia reminder do?".
  campaign?: string;
  // Throttle between sends. WABA's per-second budget is 80 msg/sec
  // by default, but conservative throttling protects against bursts
  // pushing the phone-number quality score down.
  throttleMs?: number;
  logPrefix?: string;
}

const DEFAULT_THROTTLE_MS = 200;

export async function sendBulkWabaTemplate<T>(
  opts: SendBulkWabaOpts<T>,
): Promise<BulkWabaResult> {
  const throttle = opts.throttleMs ?? DEFAULT_THROTTLE_MS;
  const prefix = opts.logPrefix ?? "bulk-waba";

  let sent = 0;
  let skipped = 0;
  const failed: BulkWabaFailure[] = [];
  const warnings: BulkWabaWarning[] = [];

  for (let i = 0; i < opts.audience.length; i++) {
    const recipient = opts.audience[i];
    const to = opts.getTo(recipient);

    if (opts.shouldSkip && (await opts.shouldSkip(recipient))) {
      skipped++;
      continue;
    }

    try {
      const variables = opts.buildVariables(recipient);
      const result = await sendWabaTemplate({
        to,
        template: opts.template,
        variables,
        urlButtonParams: opts.buildUrlButtonParams?.(recipient),
        campaign: opts.campaign,
        personId: opts.getPersonId?.(recipient) ?? null,
      });
      sent++;
      if (opts.onSent) {
        try {
          await opts.onSent(recipient, result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `${prefix} onSent failed for ${to} — message delivered but flag unset:`,
            err,
          );
          warnings.push({
            to,
            reason: `onSent hook threw: ${msg}. Message was delivered but the idempotency flag is NOT set — a blind retry will double-send this recipient.`,
          });
        }
      }
    } catch (err) {
      const failure = describeError(err, to, prefix);
      failed.push(failure);
    }

    if (throttle > 0 && i < opts.audience.length - 1) {
      await sleep(throttle);
    }
  }

  return { sent, skipped, failed, warnings };
}

function describeError(
  err: unknown,
  to: string,
  prefix: string,
): BulkWabaFailure {
  if (err instanceof WabaTemplateNotApprovedError) {
    console.error(`${prefix} aborted for ${to}: ${err.message}`);
    return {
      to,
      error: {
        name: "template_not_approved",
        message: err.message,
        statusCode: null,
        metaErrorCode: null,
      },
    };
  }
  if (err instanceof WabaClientError) {
    console.error(
      `${prefix} failed for ${to} (${err.statusCode ?? "?"} ${err.metaErrorCode ?? ""}): ${err.message}`,
    );
    return {
      to,
      error: {
        name: "waba_client_error",
        message: err.message,
        statusCode: err.statusCode,
        metaErrorCode: err.metaErrorCode,
      },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${prefix} threw for ${to}:`, err);
  return {
    to,
    error: {
      name: "thrown",
      message,
      statusCode: null,
      metaErrorCode: null,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
