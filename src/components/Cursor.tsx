"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const INTERACTIVE =
  "a, button, [role='button'], input, textarea, select, [data-cursor='hover']";

/**
 * Custom cursor: a dot that tracks the pointer 1:1 and a spring-lagged
 * ring that swells over interactive elements. Blend-mode difference keeps
 * it legible on every background. Fine pointers only — and the native
 * cursor is hidden only after the first pointermove positions the custom
 * one, so a stationary mouse is never left with no cursor at all.
 */
export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 400, damping: 40, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 400, damping: 40, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      // Hide the native cursor only once ours is actually positioned
      if (!document.documentElement.classList.contains("has-custom-cursor")) {
        document.documentElement.classList.add("has-custom-cursor");
        setEnabled(true);
      }
    };
    const onOver = (e: PointerEvent) => {
      const next = !!(e.target as Element | null)?.closest(INTERACTIVE);
      // pointerover fires on every element-boundary crossing — only pay a
      // React render when the interactive state actually flips
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
    };
  }, [x, y]);

  if (!enabled) return null;

  // The blend lives on the transformed element itself: a transform isolates
  // its children's blending, so a blended child would never see the page and
  // the cursor would vanish on cream. White + difference self-inverts against
  // any backdrop (same trick as the BROTE locale switcher).
  return (
    <>
      <motion.div
        aria-hidden
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[100] mix-blend-difference"
      >
        <div className="h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ x: ringX, y: ringY }}
        className="pointer-events-none fixed left-0 top-0 z-[100] mix-blend-difference"
      >
        {/* Scale, not width/height — keeps the swell compositor-only. The
            centering translate lives on its own wrapper because framer's
            scale would overwrite a transform on the same element. */}
        <div className="-translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{ scale: active ? 1 : 0.64, opacity: active ? 1 : 0.65 }}
            transition={{ duration: 0.25 }}
            className="h-11 w-11 rounded-full border border-white"
          />
        </div>
      </motion.div>
    </>
  );
}
