"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { easeOutExpo } from "@/lib/animations";

interface MetricDisplayProps {
  value: string;
  label: string;
  dark?: boolean;
}

function CountUp({ target }: { target: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const numeric = parseFloat(target);
  const decimals = target.includes(".") ? target.split(".")[1].length : 0;

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, numeric, {
      duration: 1.6,
      ease: easeOutExpo,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals);
      },
    });
    return () => controls.stop();
  }, [isInView, numeric, decimals]);

  // Server-rendered as the final value; the animation takes over in view
  return <span ref={ref}>{target}</span>;
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
  const reducedMotion = useReducedMotion();
  const tokens = value.split(/(\d+(?:\.\d+)?)/);

  return (
    <div className="text-center">
      <div
        className={`font-mono text-xl tabular-nums md:text-2xl ${
          dark ? "text-terracotta/90" : "text-terracotta"
        }`}
      >
        {reducedMotion
          ? value
          : tokens.map((token, i) =>
              /^\d/.test(token) ? (
                <CountUp key={i} target={token} />
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
