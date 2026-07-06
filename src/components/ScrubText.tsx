"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

interface ScrubTextProps {
  text: string;
  className?: string;
}

function Word({
  word,
  progress,
  start,
  end,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.14, 1]);
  return (
    <span aria-hidden className="inline-block whitespace-pre">
      <motion.span style={{ opacity }} className="inline-block">
        {word}
      </motion.span>{" "}
    </span>
  );
}

/**
 * Scroll-scrubbed text: words resolve from ghost to full ink as the line
 * crosses the viewport, tied to scroll position rather than a one-shot
 * trigger — scrolling back re-dims them.
 */
export default function ScrubText({ text, className }: ScrubTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "start 0.4"],
  });

  if (reducedMotion) {
    return <span className={className}>{text}</span>;
  }

  const words = text.trim().split(/\s+/);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          word={word}
          progress={scrollYProgress}
          start={i / words.length}
          end={(i + 1) / words.length}
        />
      ))}
    </span>
  );
}
