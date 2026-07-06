"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { fadeUp } from "@/lib/animations";
import type { ProofPoint } from "@/dictionaries/types";
import MetricDisplay from "./MetricDisplay";

interface ProofCardProps {
  proof: ProofPoint;
  dark?: boolean;
}

export default function ProofCard({ proof, dark = false }: ProofCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Pointer position within the card, 0–1, springed for the tilt
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springX = useSpring(px, { stiffness: 180, damping: 22 });
  const springY = useSpring(py, { stiffness: 180, damping: 22 });
  const rotateX = useTransform(springY, [0, 1], [2.5, -2.5]);
  const rotateY = useTransform(springX, [0, 1], [-2.5, 2.5]);
  const spotlight = useTransform([springX, springY], ([x, y]) => {
    const glow = dark ? "rgba(250, 246, 241, 0.07)" : "rgba(196, 112, 75, 0.09)";
    return `radial-gradient(320px circle at ${(x as number) * 100}% ${
      (y as number) * 100
    }%, ${glow}, transparent 70%)`;
  });

  return (
    <motion.div variants={fadeUp} style={{ perspective: 800 }}>
      <motion.div
        ref={ref}
        onPointerMove={(e) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          px.set((e.clientX - rect.left) / rect.width);
          py.set((e.clientY - rect.top) / rect.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
        style={reducedMotion ? undefined : { rotateX, rotateY }}
        className={`group relative border p-5 transition-colors duration-300 md:p-6 ${
          dark
            ? "border-cream/10 bg-white/5 hover:border-cream/25"
            : "border-forest/10 bg-white/50 hover:border-forest/30"
        }`}
      >
        {/* Pointer-tracked spotlight */}
        <motion.div
          aria-hidden
          style={{ background: spotlight }}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        <span
          className={`tech-label inline-block ${
            dark ? "text-sage" : "text-terracotta"
          }`}
        >
          {proof.label}
        </span>
        <h4
          className={`mt-2 font-serif text-lg font-normal md:text-xl ${
            dark ? "text-cream" : "text-forest"
          }`}
        >
          {proof.title}
        </h4>
        {proof.metrics && (
          <div className="mt-4 flex flex-wrap gap-4">
            {proof.metrics.map((m) => (
              <MetricDisplay
                key={m.label}
                value={m.value}
                label={m.label}
                dark={dark}
              />
            ))}
          </div>
        )}
        <p
          className={`mt-3 text-sm leading-relaxed md:text-base ${
            dark
              ? "text-cream/70 group-hover:text-cream/90"
              : "text-charcoal/70 group-hover:text-charcoal/90"
          } transition-colors`}
        >
          {proof.description}
        </p>
      </motion.div>
    </motion.div>
  );
}
