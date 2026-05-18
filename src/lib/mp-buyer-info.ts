/**
 * MercadoPago buyer-info resolution.
 *
 * On MP Payment objects, `preference_id` may be absent and `payer.first_name`
 * may be empty depending on the funding source. `payer.email` is reliable.
 *
 * `DEFAULT_BUYER_NAME` is the documented placeholder used when no real name
 * is available; it must match the literal that `upsertPerson` in
 * `community.ts` treats as overwritable. If you change one, change the other.
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
 * Name precedence (each step short-circuits if it yields a non-empty name):
 *   1. Redis stash by `payment.preference_id`
 *   2. Redis stash by `payment.payer.email` (lowercased + trimmed)
 *   3. `payment.additional_info.payer.first_name + last_name`
 *   4. `payment.payer.first_name + last_name`
 *   5. `DEFAULT_BUYER_NAME`
 *
 * Phone is only sourced from the stashes — MP's payer object doesn't carry
 * one. Stash readers are passed as callbacks so this helper is unit-testable
 * without Redis.
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

  const stashByPrefName = stashByPref?.name?.trim() ?? "";

  // A preference stash with an empty name must not short-circuit the
  // email lookup — the email stash may still yield a real name.
  const payerEmail = (payment.payer?.email ?? "").trim().toLowerCase();
  const stashByEmail =
    !stashByPrefName && payerEmail
      ? await readers.readStashByEmail(payerEmail)
      : null;

  // Non-name fields stay sourced from the preference stash if present,
  // even when its name was blank.
  const stash = stashByPref ?? stashByEmail;
  const stashByEmailName = stashByEmail?.name?.trim() ?? "";

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
  if (stashByPrefName) {
    name = stashByPrefName;
    nameSource = "stash-by-preference";
  } else if (stashByEmailName) {
    name = stashByEmailName;
    nameSource = "stash-by-email";
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
