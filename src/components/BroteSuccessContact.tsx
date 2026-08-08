"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { BroteSuccessContactDict } from "@/dictionaries/types";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { CONFIRM_TOKEN_STORAGE_KEY } from "@/lib/brote-confirm-token";

const FOREST = "#3E5226";
const FOREST_60 = "#78855E";
const BODY = "#5C6B45";
const ERROR = "#A0522D";

const inputClasses =
  "w-full rounded-[2px] border border-[#3E5226]/25 bg-white px-4 py-3 text-[15px] text-[#3E5226] placeholder-[#5C6B45]/30 outline-none transition-colors focus:border-[#3E5226]/60";

type Status = "idle" | "sending" | "applied" | "pending";

/**
 * Optional post-payment contact step.
 *
 * The `ct` token is read from localStorage, where the checkout stashed it
 * before leaving for MercadoPago — that round trip is same-origin, so it
 * survives. `external_reference` from MP's return URL is a fallback for
 * when storage was cleared. With neither, the block doesn't render at all
 * and the page stays exactly as it was.
 */
export default function BroteSuccessContact({
  dict,
  fallbackToken,
}: {
  dict: BroteSuccessContactDict;
  fallbackToken?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(CONFIRM_TOKEN_STORAGE_KEY);
    } catch {
      // Storage can throw in locked-down browsers — fall through.
    }
    const resolved = stored || fallbackToken || null;
    setToken(resolved);
    if (!resolved) return;

    // Prefill from the ticket if the webhook already landed. It usually
    // hasn't, in which case `found` is false and the form starts empty.
    fetch(`/api/brote/confirm-contact?token=${encodeURIComponent(resolved)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.found) return;
        setName((v) => v || (data.name === "Asistente" ? "" : data.name || ""));
        setEmail((v) => v || data.email || "");
        setPhone((v) => v || data.phone || "");
      })
      .catch(() => {});
  }, [fallbackToken]);

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
        body: JSON.stringify({ token, name, email, phone }),
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
      setStatus(data.outcome === "pending" ? "pending" : "applied");
    } catch {
      setError(dict.errors.generic);
      setStatus("idle");
    }
  }

  if (status === "applied" || status === "pending") {
    return (
      <div
        className="mt-8 rounded-[2px] border border-[#3E5226]/20 bg-[#3E5226]/[0.06] p-5 text-left"
        role="status"
      >
        <p className="m-0 text-[15px] leading-relaxed" style={{ color: BODY }}>
          🌱 {status === "applied" ? dict.doneApplied : dict.donePending}
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
