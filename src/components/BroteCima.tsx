"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { BroteUnArbolDict } from "@/dictionaries/types";

interface Props {
  dict: BroteUnArbolDict;
  locale: string;
}

export default function BroteCima({ dict, locale }: Props) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [validCode, setValidCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Auto-fill and validate from URL param
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      fetch("/api/brote/cima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", code: urlCode.trim() }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) setValidCode(data.code);
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleValidate = useCallback(async () => {
    if (!code.trim() || validating) return;
    setValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/brote/cima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", code: code.trim() }),
      });
      const data = await res.json();

      if (data.valid) {
        setValidCode(data.code);
      } else {
        setError(dict.codeInvalid);
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setValidating(false);
    }
  }, [code, validating, dict]);

  const handleCheckout = useCallback(async () => {
    if (!validCode || checkoutLoading) return;
    setCheckoutLoading(true);

    try {
      const res = await fetch("/api/brote/cima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", code: validCode }),
      });
      const data = await res.json();

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setError(data.error || "Error al crear el checkout.");
        setCheckoutLoading(false);
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setCheckoutLoading(false);
    }
  }, [validCode, checkoutLoading]);

  return (
    <main className="flex min-h-[100svh] flex-col items-center bg-[#FAF6F1] px-6 py-12 md:py-16">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/logo-cima.png"
              alt="CIMA"
              width={120}
              height={48}
              className="h-8 w-auto"
            />
            <span className="text-[#A8B5A0]">×</span>
            <span className="font-serif text-lg text-[#2D4A3E]/80">BROTE</span>
          </div>

          <h1 className="mt-8 font-serif text-3xl text-[#2D4A3E] md:text-4xl">
            {dict.headline}
          </h1>
        </div>

        {/* Message */}
        <div className="mt-8 space-y-3">
          {dict.message.map((p, i) => (
            <p
              key={i}
              className={`text-base leading-relaxed ${
                i === 1
                  ? "font-semibold text-[#C4704B]"
                  : "text-[#2C2C2C]/70"
              }`}
            >
              {p}
            </p>
          ))}
        </div>

        {/* What's included */}
        <div className="mt-8 rounded-xl border border-[#A8B5A0]/20 bg-white/70 p-5">
          <ul className="space-y-2.5">
            {dict.includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-[#2C2C2C]/70"
              >
                <span className="mt-0.5 text-[#A8B5A0]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing table */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#A8B5A0]">
            {dict.pricingTitle}
          </h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#A8B5A0]/20">
            {dict.pricing.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  i > 0 ? "border-t border-[#A8B5A0]/10" : ""
                } ${
                  row.highlight
                    ? "bg-[#C4704B]/10 font-semibold text-[#C4704B]"
                    : "text-[#2C2C2C]/50"
                }`}
              >
                <span className={row.highlight ? "" : "line-through"}>{row.label}</span>
                <span className={row.highlight ? "" : "line-through"}>{row.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code input + CTA */}
        <div className="mt-10 flex flex-col gap-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-[#A8B5A0]">
            Código de descuento
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && !validCode && handleValidate()}
              placeholder={dict.codePlaceholder}
              readOnly={!!validCode}
              className={`flex-1 rounded-full border px-5 py-3 text-sm outline-none transition-colors ${
                validCode
                  ? "border-[#A8B5A0]/50 bg-[#A8B5A0]/10 text-[#2D4A3E]"
                  : "border-[#A8B5A0]/30 bg-white text-[#2C2C2C] placeholder-[#2C2C2C]/30 focus:border-[#2D4A3E]/40"
              }`}
            />
            {!validCode ? (
              <button
                onClick={handleValidate}
                disabled={!code.trim() || validating}
                className="rounded-full bg-[#2D4A3E] px-6 py-3 text-sm font-semibold text-[#FAF6F1] transition-colors hover:bg-[#2D4A3E]/90 disabled:opacity-50"
              >
                {validating ? "..." : dict.codeButton}
              </button>
            ) : (
              <span className="flex items-center px-4 text-sm font-medium text-[#A8B5A0]">
                ✓
              </span>
            )}
          </div>
          {error && (
            <p className="text-center text-sm text-[#C4704B]">
              {error}
            </p>
          )}
          {validCode && (
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full rounded-full bg-[#2D4A3E] px-8 py-3.5 text-base font-semibold text-[#FAF6F1] transition-colors hover:bg-[#2D4A3E]/90 disabled:opacity-50"
            >
              {checkoutLoading ? dict.loading : dict.cta}
            </button>
          )}
        </div>

        {/* Back link */}
        <div className="mt-10 text-center">
          <a
            href={`/${locale}/brote`}
            className="text-sm text-[#2C2C2C]/40 underline decoration-[#2C2C2C]/20 underline-offset-2 transition-colors hover:text-[#2D4A3E]"
          >
            {dict.backLink}
          </a>
        </div>
      </div>
    </main>
  );
}
