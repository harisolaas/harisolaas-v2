/**
 * MercadoPago buyer-info resolution.
 *
 * MP's Payment object exposes buyer identity in three places, none of which
 * is reliable on its own:
 *
 * 1. `payment.preference_id` — present on some flows, absent on others.
 *    Production has shown this field undefined for the bulk of Account
 *    Money / wallet payments, which broke our preference-id-keyed Redis
 *    stash recovery on the Sinergia × Párrafo webhook.
 * 2. `payment.payer.first_name` / `last_name` — populated for credit-card
 *    flows where the card carries cardholder name. Empty for most
 *    Account Money payments.
 * 3. `payment.additional_info.payer.first_name` / `last_name` — what MP
 *    collects via Checkout Pro's identity form. Reliably populated when
 *    we pass a `payer` block in the Preference, even on Account Money.
 *
 * `payment.payer.email` is reliably populated across flows and is our
 * email source of truth when the Redis stash is unavailable.
 *
 * This helper walks every source in fallback order so the webhooks have a
 * single, testable resolution path and so future bugs in any one source
 * don't silently degrade to the literal "Asistente".
 *
 * The "Asistente" string is intentionally the last resort and matches the
 * literal we self-heal in `upsertPerson` (see `community.ts`). If you
 * change one, change the other.
 */

export interface CheckoutMetaLike {
  name?: string;
  email?: string;
  phone?: string;
}

export interface MpPaymentLike {
  preference_id?: string | null;
  payer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  additional_info?: {
    payer?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
}

export interface ResolvedBuyerInfo {
  name: string;
  email: string;
  phone: string | undefined;
  /** Which source filled `name`. Useful for log lines and tests. */
  nameSource:
    | "stash-by-preference"
    | "stash-by-email"
    | "additional-info-payer"
    | "payer"
    | "fallback";
}

export const DEFAULT_BUYER_NAME = "Asistente";

function joinName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return [first, last]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Resolve a buyer's display name, email, and phone from a MercadoPago
 * payment payload, falling back through every available source.
 *
 * The two `readStashBy*` callbacks return a stash (or null) and let the
 * caller wire whichever Redis prefix it owns. Keeping the lookups as
 * thunks means this helper stays unit-testable without spinning up Redis.
 *
 * Precedence (each step short-circuits the rest if it yields a non-empty
 * name):
 *   1. Redis stash by `payment.preference_id`
 *   2. Redis stash by `payment.payer.email` (lowercased + trimmed)
 *   3. `payment.additional_info.payer.first_name + last_name`
 *   4. `payment.payer.first_name + last_name`
 *   5. `DEFAULT_BUYER_NAME` ("Asistente")
 *
 * Email and phone use the same chain where present. Phone only comes from
 * our own stashes — MP's payer object doesn't carry one reliably for
 * Account Money flows.
 */
export async function resolveBuyerInfo(
  payment: MpPaymentLike,
  readers: {
    readStashByPreferenceId: (
      preferenceId: string,
    ) => Promise<CheckoutMetaLike | null>;
    readStashByEmail: (email: string) => Promise<CheckoutMetaLike | null>;
  },
): Promise<ResolvedBuyerInfo> {
  const stashByPref = payment.preference_id
    ? await readers.readStashByPreferenceId(payment.preference_id)
    : null;

  const payerEmail = (payment.payer?.email ?? "").trim().toLowerCase();
  const stashByEmail =
    !stashByPref && payerEmail
      ? await readers.readStashByEmail(payerEmail)
      : null;

  const stash = stashByPref ?? stashByEmail;

  const stashName = stash?.name?.trim() ?? "";
  const additionalInfoName = joinName(
    payment.additional_info?.payer?.first_name,
    payment.additional_info?.payer?.last_name,
  );
  const payerName = joinName(
    payment.payer?.first_name,
    payment.payer?.last_name,
  );

  let name = DEFAULT_BUYER_NAME;
  let nameSource: ResolvedBuyerInfo["nameSource"] = "fallback";
  if (stashName) {
    name = stashName;
    nameSource = stashByPref ? "stash-by-preference" : "stash-by-email";
  } else if (additionalInfoName) {
    name = additionalInfoName;
    nameSource = "additional-info-payer";
  } else if (payerName) {
    name = payerName;
    nameSource = "payer";
  }

  const email =
    stash?.email?.trim() ||
    (payment.payer?.email ?? "").trim() ||
    "";

  const phone = stash?.phone?.trim() || undefined;

  return { name, email, phone, nameSource };
}
