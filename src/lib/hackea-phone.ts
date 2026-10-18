// Hackeá tu mente — WhatsApp number parsing, shared by the landing (client)
// and the checkout (server). Pure: no server imports.
//
// Uses libphonenumber-js with its *mobile* metadata (≈24 KB gzipped, ~5 KB
// more than `min`): `min` only checks lengths, so it takes nonexistent area
// codes like `+54 9 999 …`; `mobile` knows the real mobile ranges per area
// code, which is exactly the question for a WhatsApp number.
//
// `npx tsx` scripts crash on this import (CJS ⇄ JSON-metadata interop);
// Vitest and Next load it fine.
import { parsePhoneNumberFromString, type PhoneNumber } from "libphonenumber-js/mobile";

/**
 * Every Argentine area code (2, 3 and 4 digits, without the leading 0).
 * Source: ENACOM's numbering plan as encoded in libphonenumber's AR
 * `national_prefix_for_parsing` (the area codes a local `15` may follow).
 * `hackea-phone.test.ts` re-derives the list from the installed metadata and
 * fails if a libphonenumber-js upgrade changes it.
 */
export const AR_AREA_CODES: ReadonlySet<string> = new Set(
  (
    "11 " +
    "220 221 223 230 236 237 249 260 261 263 264 266 280 291 " +
    "294 297 298 299 336 341 342 343 345 348 351 353 358 362 " +
    "364 370 376 379 380 381 383 385 387 388 " +
    "2202 2221 2223 2224 2225 2226 2227 2229 2241 2242 2243 2244 2245 2246 " +
    "2252 2254 2255 2257 2261 2262 2264 2265 2266 2267 2268 2271 2272 2273 " +
    "2274 2281 2283 2284 2285 2286 2291 2292 2296 2297 2302 2314 2316 2317 " +
    "2320 2323 2324 2325 2326 2331 2333 2334 2335 2336 2337 2338 2342 2343 " +
    "2344 2345 2346 2352 2353 2354 2355 2356 2357 2358 2392 2393 2394 2395 " +
    "2396 2473 2474 2475 2477 2478 2622 2624 2625 2626 2646 2647 2648 2651 " +
    "2655 2656 2657 2658 2901 2902 2903 2920 2921 2922 2923 2924 2925 2926 " +
    "2927 2928 2929 2931 2932 2933 2934 2935 2936 2940 2942 2945 2946 2948 " +
    "2952 2953 2954 2962 2963 2964 2966 2972 2982 2983 3327 3329 3382 3385 " +
    "3387 3388 3400 3401 3402 3404 3405 3406 3407 3408 3409 3435 3436 3437 " +
    "3438 3442 3444 3445 3446 3447 3454 3455 3456 3458 3460 3462 3463 3464 " +
    "3465 3466 3467 3468 3469 3471 3472 3476 3482 3483 3487 3489 3491 3492 " +
    "3493 3496 3497 3498 3521 3522 3524 3525 3532 3533 3537 3541 3542 3543 " +
    "3544 3546 3547 3548 3549 3562 3563 3564 3571 3572 3573 3574 3575 3576 " +
    "3582 3583 3584 3585 3711 3715 3716 3718 3721 3725 3731 3734 3735 3741 " +
    "3743 3751 3754 3755 3756 3757 3758 3772 3773 3774 3775 3777 3781 3782 " +
    "3786 3821 3825 3826 3827 3832 3835 3837 3838 3841 3843 3844 3845 3846 " +
    "3854 3855 3856 3857 3858 3861 3862 3863 3865 3867 3868 3869 3873 3876 " +
    "3877 3878 3885 3886 3887 3888 3891 3892 3894"
  ).split(" "),
);

/**
 * The subscriber parts of a 10-digit AR national number, one per area code
 * it can start with (the plan isn't prefix-free: `220` and `2202` both
 * exist). Empty when it starts with no real area code.
 */
function arSubscribers(national: string): string[] {
  return [2, 3, 4]
    .filter((len) => AR_AREA_CODES.has(national.slice(0, len)))
    .map((len) => national.slice(len));
}

function isMobile(parsed: PhoneNumber): boolean {
  if (!parsed.isValid()) return false;
  const type = parsed.getType();
  return type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE";
}

/** `1111111111`, `11 0000-0000`, `+54 9 351 111-1111`: a placeholder, not a number. */
function isArPlaceholder(national: string): boolean {
  if (/^(\d)\1+$/.test(national)) return true;
  return arSubscribers(national).some((sub) => /^(?:0+|1+)$/.test(sub));
}

/**
 * In Argentina a mobile and a landline look the same unless the number is
 * spelled with the `9` (international) or `15` (local) marker — and people
 * almost never type either: `11 2345-6789` is how everyone writes their own
 * celular. So every AR number is read as a mobile (`+54 9 …`). A real
 * landline slips through, but there is no way to tell them apart and
 * rejecting `11 2345-6789` would turn away nearly every buyer.
 *
 * libphonenumber's AR mobile ranges are block-granular per area code and
 * miss real interior numbers (`221 712-3456`, `3755 91-2345`). Turning a
 * real buyer away loses a sale; letting a junk number through costs little.
 * So when libphonenumber says no, a number is still accepted when it is 10
 * digits, starts with a real area code, and its subscriber part starts with
 * 2–9 (ENACOM never assigns a subscriber starting with 0 or 1).
 *
 * `national` is what libphonenumber kept after the 0 / `+54`: it may still
 * carry the mobile `9` in front and a `15` the parser didn't strip
 * (`2944 15 423456`, which it doesn't list among the `15` spellings).
 */
function parseArNational(national: string): string | null {
  const n = /^9(?:\d{10}|\d{12})$/.test(national) ? national.slice(1) : national;
  if (n.length === 12) {
    for (const at of [2, 3, 4]) {
      if (n.slice(at, at + 2) !== "15") continue;
      const found = parseArNational(n.slice(0, at) + n.slice(at + 2));
      if (found) return found;
    }
    return null;
  }
  if (n.length !== 10 || isArPlaceholder(n)) return null;
  const mobile = parsePhoneNumberFromString(`+549${n}`);
  if (mobile && isMobile(mobile)) return mobile.number;
  return arSubscribers(n).some((sub) => /^[2-9]/.test(sub)) ? `+549${n}` : null;
}

/**
 * The E.164 WhatsApp number (`+549…` for Argentina) for what the buyer
 * typed, or null when it isn't a plausible mobile number.
 *
 * - No `+` / `00`: read as Argentine, in any local spelling — `11 2345-6789`,
 *   `011 15 2345-6789`, `0351 15 612-3456`, `2235 12-3456`,
 *   `2944 15 423456`, `+54 9 …`.
 * - `+` / `00` + another country code: any valid mobile of that country.
 * - Rejected: wrong length, nonexistent area codes, subscriber numbers
 *   starting with 0/1, numbers without area code (`15 2345 6789`), toll-free,
 *   foreign landlines, and placeholders (one repeated digit, or a subscriber
 *   part of all 0s or all 1s).
 */
export function parseHackeaWhatsApp(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), "AR");
  if (!parsed) return null;
  if (parsed.countryCallingCode === "54") {
    const national = parsed.nationalNumber;
    // A mobile range outside the `9` scheme (the `675` block) stays as is.
    if (!national.startsWith("9") && isMobile(parsed) && !isArPlaceholder(national)) {
      return parsed.number;
    }
    return parseArNational(national);
  }
  if (!isMobile(parsed) || /^(\d)\1+$/.test(parsed.nationalNumber)) return null;
  return parsed.number;
}
