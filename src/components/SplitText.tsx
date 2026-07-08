"use client";

import { Fragment, useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { easeOutExpo } from "@/lib/animations";

interface SplitTextProps {
  text: string;
  /** Split granularity — words for body-scale, chars for display-scale type */
  by?: "word" | "char";
  className?: string;
  /** Seconds before the first unit starts */
  delay?: number;
  /** Seconds between units */
  stagger?: number;
  /** Animate on mount (hero) instead of when scrolled into view */
  immediate?: boolean;
}

interface UnitCustom {
  index: number;
  delay: number;
  stagger: number;
  reduced: boolean;
}

const unit: Variants = {
  hidden: { y: "115%" },
  visible: (c: UnitCustom) =>
    c.reduced
      ? { y: "0%", transition: { duration: 0 } }
      : {
          y: "0%",
          transition: {
            duration: 0.9,
            ease: easeOutExpo,
            delay: c.delay + c.index * c.stagger,
          },
        },
};

/**
 * Masked type reveal: each word/char rises out of an overflow-hidden slot.
 * The mask carries a small padding/negative-margin pair so descenders
 * (g, y, j) aren't clipped mid-animation.
 *
 * The real text lives in an sr-only node (screen readers, find-in-page,
 * translation); the animated spans are aria-hidden. Reduced-motion is read
 * after mount so the first client render matches SSR (no hydration
 * mismatch) — those users get an instant reveal instead of the rise.
 */
export default function SplitText({
  text,
  by = "word",
  className,
  delay = 0,
  stagger = 0.04,
  immediate = false,
}: SplitTextProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Flags that framer is hydrated and driving the reveals — globals.css
    // scopes the no-JS CSS fallback animation to html:not(.motion-ready)
    document.documentElement.classList.add("motion-ready");
    setReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  const trigger = immediate
    ? { animate: "visible" as const }
    : {
        whileInView: "visible" as const,
        viewport: { once: true, margin: "-80px" },
      };

  const words = text.trim().split(/\s+/);
  let unitIndex = 0;

  return (
    <motion.span className={className} initial="hidden" {...trigger}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <Fragment key={`${word}-${wi}`}>
          <span aria-hidden className="inline-block whitespace-nowrap">
            {(by === "word" ? [word] : Array.from(word)).map((piece, pi) => (
              <span
                key={pi}
                className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom"
              >
                <motion.span
                  variants={unit}
                  custom={
                    {
                      index: unitIndex++,
                      delay,
                      stagger,
                      reduced,
                    } satisfies UnitCustom
                  }
                  className="st-unit inline-block will-change-transform"
                >
                  {piece}
                </motion.span>
              </span>
            ))}
          </span>
          {/* The joining space must sit OUTSIDE the inline-block wrapper —
              trailing whitespace inside one gets collapsed away */}
          {wi < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </motion.span>
  );
}
