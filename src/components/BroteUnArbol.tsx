"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { BroteUnArbolDict } from "@/dictionaries/types";

interface Props {
  dict: BroteUnArbolDict;
  locale: string;
}

export default function BroteUnArbol({ dict, locale }: Props) {
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
      // Auto-validate
      fetch("/api/brote/unarbol", {
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
      const res = await fetch("/api/brote/unarbol", {
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
      const res = await fetch("/api/brote/unarbol", {
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
    <main className="flex min-h-[100svh] flex-col items-center bg-[#EAE3D2] px-6 py-12 md:py-16">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/logo-unarbol-blanco.png"
              alt="Un Árbol"
              width={120}
              height={34}
              className="h-6 w-auto brightness-0 opacity-40"
            />
            <span className="text-[#BBC2A9]">×</span>
            <span className="font-serif text-lg text-[#3E5226]/80">BROTE</span>
          </div>

          <h1 className="mt-8 font-serif text-3xl text-[#3E5226] md:text-4xl">
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
                  ? "font-semibold text-[#3E5226]"
                  : "text-[#5C6B45]/70"
              }`}
            >
              {p}
            </p>
          ))}
        </div>

        {/* What's included */}
        <div className="mt-8 rounded-[2px] border border-[#BBC2A9]/20 bg-white/70 p-5">
          <ul className="space-y-2.5">
            {dict.includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-[#5C6B45]/70"
              >
                <span className="mt-0.5 text-[#BBC2A9]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing table */}
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#BBC2A9]">
            {dict.pricingTitle}
          </h3>
          <div className="mt-3 overflow-hidden rounded-[2px] border border-[#BBC2A9]/20">
            {dict.pricing.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  i > 0 ? "border-t border-[#BBC2A9]/10" : ""
                } ${
                  row.highlight
                    ? "bg-[#3E5226]/10 font-semibold text-[#3E5226]"
                    : "text-[#5C6B45]/50"
                }`}
              >
                <span>{row.label}</span>
                <span>{row.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code input or CTA */}
        <div className="mt-10">
          {!validCode ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                  placeholder={dict.codePlaceholder}
                  className="flex-1 rounded-[2px] border border-[#BBC2A9]/30 bg-white px-5 py-3 text-sm text-[#5C6B45] placeholder-[#5C6B45]/30 outline-none transition-colors focus:border-[#3E5226]/40"
                />
                <button
                  onClick={handleValidate}
                  disabled={!code.trim() || validating}
                  className="rounded-[2px] bg-[#3E5226] px-6 py-3 text-sm font-semibold text-[#EAE3D2] transition-colors hover:bg-[#3E5226]/90 disabled:opacity-50"
                >
                  {validating ? "..." : dict.codeButton}
                </button>
              </div>
              {error && (
                <p className="mt-3 text-center text-sm text-[#3E5226]">
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-[#3E5226]/60">
                ✓ {validCode}
              </p>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full rounded-[2px] bg-[#3E5226] px-8 py-3.5 text-base font-semibold text-[#EAE3D2] transition-colors hover:bg-[#3E5226]/90 disabled:opacity-50"
              >
                {checkoutLoading ? dict.loading : dict.cta}
              </button>
              {error && (
                <p className="text-center text-sm text-[#3E5226]">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-10 text-center">
          <a
            href={`/${locale}/brote`}
            className="text-sm text-[#5C6B45]/40 underline decoration-[#5C6B45]/20 underline-offset-2 transition-colors hover:text-[#3E5226]"
          >
            {dict.backLink}
          </a>
        </div>
      </div>
    </main>
  );
}
