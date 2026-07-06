"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Custom cursor: a dot that tracks the pointer 1:1 and a spring-lagged
 * ring that swells over interactive elements. Blend-mode difference keeps
 * it legible on every background. Mounts only for fine pointers — touch
 * devices never see it.
 */
export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 400, damping: 40, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 400, damping: 40, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    setEnabled(true);
    document.documentElement.classList.add("has-custom-cursor");

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null;
      setActive(
        !!target?.closest(
          "a, button, [role='button'], input, textarea, select, [data-cursor='hover']"
        )
      );
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

  return (
    <>
      <motion.div
        aria-hidden
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[100]"
      >
        <div className="h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream mix-blend-difference" />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ x: ringX, y: ringY }}
        className="pointer-events-none fixed left-0 top-0 z-[100]"
      >
        <motion.div
          animate={{
            width: active ? 44 : 28,
            height: active ? 44 : 28,
            opacity: active ? 1 : 0.6,
          }}
          transition={{ duration: 0.25 }}
          className="-translate-x-1/2 -translate-y-1/2 rounded-full border border-cream mix-blend-difference"
        />
      </motion.div>
    </>
  );
}
