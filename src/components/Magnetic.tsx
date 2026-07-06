"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticProps {
  children: ReactNode;
  /** How far the element chases the pointer (0–1 of the offset) */
  strength?: number;
  className?: string;
}

/** Eases its child toward the pointer while hovered, springs back on leave. */
export default function Magnetic({
  children,
  strength = 0.3,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Measured once on enter (pre-chase, so the spring offset never feeds
  // back into it) instead of forcing a layout read on every pointermove
  const rect = useRef<DOMRect | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      className={`inline-block ${className ?? ""}`}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch") return;
        rect.current = ref.current?.getBoundingClientRect() ?? null;
      }}
      onPointerMove={(e) => {
        const r = rect.current;
        if (!r || e.pointerType === "touch") return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        rect.current = null;
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
