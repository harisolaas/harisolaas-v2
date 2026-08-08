/**
 * The `ct` capability token that ties a MercadoPago checkout to the
 * post-payment contact step on `/brote/success`.
 *
 * Minted in `/api/brote/checkout`, carried on the MP preference's
 * `external_reference`, and stashed by the client in `localStorage` before
 * it leaves for MercadoPago. Holding it is the only authorization needed to
 * read and rewrite that ticket's delivery contact — it is unguessable
 * (nanoid 21), expires, and never travels by email.
 */

/** 7 days: a cash payment can take days to clear before the webhook fires. */
export const CONFIRM_TTL = 7 * 24 * 60 * 60;

/** Key the browser stashes the token under before redirecting to MP. */
export const CONFIRM_TOKEN_STORAGE_KEY = "brote:ct";

/** `ct` → participation id. Written by the webhook once a ticket exists. */
export const confirmTicketKey = (token: string) => `brote:confirm:${token}`;

/**
 * `ct` → contact confirmed before any ticket existed.
 *
 * This is the NORMAL path, not an edge case: the webhook is asynchronous
 * and MP redirects immediately, so most people reach `/success` before the
 * ticket row exists. The webhook consumes this and mails the ticket
 * straight to the confirmed address the first time — no resend needed.
 */
export const pendingContactKey = (token: string) =>
  `brote:pending-contact:${token}`;

/**
 * `ct` → the checkout stash, mirroring `brote:checkout:{preferenceId}`.
 *
 * MP omits `preference_id` on some Payment objects (see `mp-buyer-info`),
 * and since the by-email stash was retired this is the only anchor that
 * cannot go missing: `external_reference` carries the token on every
 * payment. A ticket is still issued without it — what silently vanishes is
 * the attribution, which is what a partner payout is counted on.
 */
export const checkoutByTokenKey = (token: string) =>
  `brote:checkout-ct:${token}`;

export interface PendingContact {
  name: string;
  email: string;
  phone: string;
  confirmedAt: string;
}
