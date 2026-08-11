"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { BroteSuccessContactDict } from "@/dictionaries/types";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import {
  CONFIRM_TOKEN_STORAGE_KEY,
  decodeStoredToken,
} from "@/lib/brote-confirm-token";

const FOREST = "#3E5226";
const FOREST_60 = "#78855E";
const BODY = "#5C6B45";
const ERROR = "#A0522D";

const inputClasses =
  "w-full rounded-[2px] border border-[#3E5226]/25 bg-white px-4 py-3 text-[15px] text-[#3E5226] placeholder-[#5C6B45]/30 outline-none transition-colors focus:border-[#3E5226]/60";

function clearToken() {
  try {
    window.localStorage.removeItem(CONFIRM_TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do — worst case the token expires on its own in 7 days.
  }
}

type Status = "idle" | "sending" | "applied" | "saved" | "pending";

/**
 * Optional post-payment contact step.
 *
 * The `ct` token comes from localStorage only, where the checkout stashed
 * it before leaving for MercadoPago — that round trip is same-origin, so it
 * survives. It is deliberately NOT read from MP's `external_reference`
 * return param: `capture_pageview` ships `$current_url` to PostHog, so a
 * token in the URL is a capability token exported to a third party.
 *
 * The token is cleared as soon as it has been used or is known to be
 * spent. `/brote/success` is a public URL, so a token left in storage means
 * the next person on a shared browser can open it, read the previous
 * buyer's name/email/phone off the prefill, and rewrite their delivery
 * address.
 */
export default function BroteSuccessContact({
  dict,
}: {
  dict: BroteSuccessContactDict;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  /**
   * One name per ticket, positional. Sized from the quantity stashed at
   * checkout so the fields appear immediately — the webhook is async and
   * usually has not landed yet, and polling for it would be worse.
   */
  const [guestNames, setGuestNames] = useState<string[]>([]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(CONFIRM_TOKEN_STORAGE_KEY);
    } catch {
      // Storage can throw in locked-down browsers — fall through.
    }
    // The stash holds `{ct, qty}` now, but a bare token string is still
    // sitting in the browser of everyone who bought before that change —
    // `decodeStoredToken` reads both, so their contact step keeps working.
    const decoded = decodeStoredToken(raw);
    const stored = decoded?.ct ?? null;
    setToken(stored);
    if (!stored) return;
    // Draw the fields straight away from the stashed quantity; the GET
    // below replaces them with the real tickets once the webhook lands.
    if (decoded && decoded.qty > 1) {
      setGuestNames(Array.from({ length: decoded.qty }, () => ""));
    }

    // Prefill from the ticket if the webhook already landed. It usually
    // hasn't, in which case `found` is false and the form starts empty.
    fetch(`/api/brote/confirm-contact?token=${encodeURIComponent(stored)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.confirmed) {
          // Already confirmed once. Drop the token instead of prefilling
          // someone's details onto a public page.
          clearToken();
          setToken(null);
          return;
        }
        if (!data.found) return;
        setName((v) => v || (data.name === "Asistente" ? "" : data.name || ""));
        setEmail((v) => v || data.email || "");
        setPhone((v) => v || data.phone || "");
        // The authoritative list, once the tickets exist. Prefills whatever
        // was already named so a second visit doesn't look empty.
        if (Array.isArray(data.tickets) && data.tickets.length > 1) {
          setGuestNames((prev) =>
            data.tickets.map(
              (t: { guestName?: string }, i: number) =>
                prev[i] || t.guestName || "",
            ),
          );
        }
      })
      .catch(() => {});
  }, []);

  if (!token) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setError(null);

    if (!name.trim()) return setError(dict.errors.nameRequired);
    if (!isValidEmail(email)) return setError(dict.errors.emailInvalid);
    if (!isValidWhatsApp(phone)) return setError(dict.errors.phoneInvalid);

    setStatus("sending");
    try {
      const res = await fetch("/api/brote/confirm-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          email,
          phone,
          // Only when there is more than one ticket — a single-ticket buyer
          // never sees these fields and should not send an empty array that
          // reads as "clear the names".
          ...(guestNames.length > 1 && { guestNames }),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setError(dict.errors.emailTaken);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        setError(dict.errors.generic);
        setStatus("idle");
        return;
      }
      // Only claim a resend when one actually happened. `applied` with
      // `resent: false` is the common case — someone who came to leave
      // their WhatsApp and confirmed the same address never triggers a
      // send, and telling them "te reenviamos" sends them looking for mail
      // that doesn't exist.
      if (data.outcome === "pending") setStatus("pending");
      else setStatus(data.resent ? "applied" : "saved");
      // Spent. Don't leave a live capability token sitting in the storage
      // of what may be a shared browser.
      clearToken();
    } catch {
      setError(dict.errors.generic);
      setStatus("idle");
    }
  }

  if (status === "applied" || status === "saved" || status === "pending") {
    const message =
      status === "applied"
        ? dict.doneApplied
        : status === "saved"
          ? dict.doneSaved
          : dict.donePending;
    return (
      <div
        className="mt-8 rounded-[2px] border border-[#3E5226]/20 bg-[#3E5226]/[0.06] p-5 text-left"
        role="status"
      >
        <p className="m-0 text-[15px] leading-relaxed" style={{ color: BODY }}>
          🌱 {message}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-[2px] border border-[#3E5226]/20 bg-white/60 p-5 text-left"
    >
      <h2
        className="m-0 font-serif text-[20px] leading-snug"
        style={{ color: FOREST }}
      >
        {dict.heading}
      </h2>
      <p
        className="mt-2 text-[14px] leading-relaxed"
        style={{ color: BODY }}
      >
        {dict.intro}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: FOREST_60 }}>
        {dict.optionalNote}
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: FOREST_60 }}>
            {dict.nameLabel}
          </span>
          <input
            type="text"
            autoComplete="name"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: FOREST_60 }}>
            {dict.emailLabel}
          </span>
          <input
            type="email"
            autoComplete="email"
            className={inputClasses}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="text-[12px]" style={{ color: FOREST_60 }}>
            {dict.emailHelper}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: FOREST_60 }}>
            {dict.phoneLabel}
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder={dict.phonePlaceholder}
            className={inputClasses}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <span className="text-[12px]" style={{ color: FOREST_60 }}>
            {dict.phoneHelper}
          </span>
        </label>

        {/* One name per ticket, only when there is more than one. Optional
            on purpose: the QR is what opens the door, the name only makes
            the door friendlier. */}
        {guestNames.length > 1 && (
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="p-0 text-[13px] font-medium" style={{ color: FOREST_60 }}>
              {dict.guestNames.heading}
            </legend>
            <p className="m-0 text-[12px]" style={{ color: FOREST_60 }}>
              {dict.guestNames.intro}
            </p>
            {guestNames.map((value, i) => (
              <label key={i} className="flex flex-col gap-1.5">
                <span className="text-[12px]" style={{ color: FOREST_60 }}>
                  {dict.guestNames.ticketLabel
                    .replace("{n}", String(i + 1))
                    .replace("{total}", String(guestNames.length))}
                  {i === 0 ? ` · ${dict.guestNames.yours}` : ""}
                </span>
                <input
                  type="text"
                  maxLength={80}
                  className={inputClasses}
                  placeholder={
                    i === 0 ? name || dict.guestNames.placeholder : dict.guestNames.placeholder
                  }
                  value={value}
                  onChange={(e) =>
                    setGuestNames((prev) =>
                      prev.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="m-0 text-[13px]" style={{ color: ERROR }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="self-start rounded-[2px] px-6 py-3 text-[14px] font-semibold text-[#EAE3D2] transition-colors hover:bg-[#2E3D1C] disabled:opacity-60"
          style={{ background: FOREST }}
        >
          {status === "sending" ? dict.submitting : dict.submit}
        </button>
      </div>
    </form>
  );
}
