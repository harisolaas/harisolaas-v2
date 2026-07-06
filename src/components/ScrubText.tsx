"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
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
  reduced,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  reduced: boolean;
}) {
  const opacity = useTransform(progress, [start, end], [0.14, 1]);
  return (
    <span aria-hidden className="inline-block whitespace-pre">
      <motion.span
        style={{ opacity: reduced ? 1 : opacity }}
        className="st-fade inline-block"
      >
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
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "start 0.4"],
  });

  // Read after mount so the first client render matches SSR — reduced-motion
  // users get static full-opacity words instead of the scrub.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const words = text.trim().split(/\s+/);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          word={word}
          progress={scrollYProgress}
          start={i / words.length}
          end={(i + 1) / words.length}
          reduced={reduced}
        />
      ))}
    </span>
  );
}
