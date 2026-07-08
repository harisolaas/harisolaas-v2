"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { easeOutExpo } from "@/lib/animations";

interface MetricDisplayProps {
  value: string;
  label: string;
  dark?: boolean;
}

/**
 * Recognize a numeric token's format so the count-up can re-emit every
 * intermediate value in the same shape. Unrecognized shapes return null
 * and render statically — never corrupt a number we can't reproduce.
 */
function numberFormat(token: string): ((v: number) => string) | null {
  if (/^\d+$/.test(token)) {
    return (v) => Math.round(v).toString();
  }
  // Grouped thousands: 50,000 / 18.650 (en / es conventions)
  if (/^\d{1,3}(,\d{3})+$/.test(token)) {
    return (v) => Math.round(v).toLocaleString("en-US");
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    return (v) => Math.round(v).toLocaleString("de-DE");
  }
  // Short decimals: 0.3 / 0,3
  const dotDecimal = token.match(/^\d+\.(\d{1,2})$/);
  if (dotDecimal) {
    return (v) => v.toFixed(dotDecimal[1].length);
  }
  const commaDecimal = token.match(/^\d+,(\d{1,2})$/);
  if (commaDecimal) {
    return (v) => v.toFixed(commaDecimal[1].length).replace(".", ",");
  }
  return null;
}

function tokenTarget(token: string): number {
  if (/^\d{1,3}(,\d{3})+$/.test(token)) return parseFloat(token.replace(/,/g, ""));
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return parseFloat(token.replace(/\./g, ""));
  return parseFloat(token.replace(",", "."));
}

function CountUp({ token }: { token: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Skipping the animation (not the markup) keeps server and client
    // renders identical — no hydration mismatch for reduced-motion users.
    if (!isInView || reducedMotion) return;
    const format = numberFormat(token);
    if (!format) return;
    const controls = animate(0, tokenTarget(token), {
      duration: 1.6,
      ease: easeOutExpo,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [isInView, reducedMotion, token]);

  // Server-rendered as the final value; the animation takes over in view
  return <span ref={ref}>{token}</span>;
}

/**
 * Metric values render in mono with tabular numerals, and every numeric
 * token counts up from zero when scrolled into view — "20→70%" animates
 * both numbers while the arrow and unit stay put.
 */
export default function MetricDisplay({
  value,
  label,
  dark = false,
}: MetricDisplayProps) {
  // Capture full grouped/decimal numbers as single tokens (50,000 · 18.650 · 0.3)
  const tokens = value.split(/(\d(?:[\d.,]*\d)?)/);

  return (
    <div className="text-center">
      <div
        className={`font-mono text-xl tabular-nums md:text-2xl ${
          dark ? "text-terracotta/90" : "text-terracotta"
        }`}
      >
        {tokens.map((token, i) =>
          /^\d/.test(token) ? (
            <CountUp key={i} token={token} />
          ) : (
            <span key={i}>{token}</span>
          )
        )}
      </div>
      <div
        className={`tech-label mt-1 ${
          dark ? "text-cream/50" : "text-charcoal/50"
        }`}
      >
        {label}
      </div>
    </div>
  );
}
