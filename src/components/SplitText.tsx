"use client";

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
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

const unit: Variants = {
  hidden: { y: "115%" },
  visible: (i: { index: number; delay: number; stagger: number }) => ({
    y: "0%",
    transition: {
      duration: 0.9,
      ease: easeOutExpo,
      delay: i.delay + i.index * i.stagger,
    },
  }),
};

/**
 * Masked type reveal: each word/char rises out of an overflow-hidden slot.
 * The mask carries a small padding/negative-margin pair so descenders
 * (g, y, j) aren't clipped mid-animation.
 */
export default function SplitText({
  text,
  by = "word",
  className,
  delay = 0,
  stagger = 0.04,
  immediate = false,
}: SplitTextProps) {
  const reducedMotion = useReducedMotion();
  const trigger = immediate
    ? { animate: "visible" as const }
    : {
        whileInView: "visible" as const,
        viewport: { once: true, margin: "-80px" },
      };

  if (reducedMotion) {
    return (
      <motion.span
        className={className}
        initial={{ opacity: 0 }}
        {...(immediate
          ? { animate: { opacity: 1 } }
          : { whileInView: { opacity: 1 }, viewport: { once: true } })}
        transition={{ duration: 0.6 }}
      >
        {text}
      </motion.span>
    );
  }

  const words = text.trim().split(/\s+/);
  let unitIndex = 0;

  return (
    <motion.span
      className={className}
      initial="hidden"
      {...trigger}
      aria-label={text}
    >
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
                  custom={{ index: unitIndex++, delay, stagger }}
                  className="inline-block will-change-transform"
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
