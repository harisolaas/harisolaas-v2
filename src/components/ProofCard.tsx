"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import type { ProofPoint } from "@/data/values";
import MetricDisplay from "./MetricDisplay";

interface ProofCardProps {
  proof: ProofPoint;
  dark?: boolean;
}

export default function ProofCard({ proof, dark = false }: ProofCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      className={`group rounded-lg p-5 transition-all duration-300 md:p-6 ${
        dark
          ? "bg-white/5 hover:bg-white/10"
          : "bg-white/60 hover:bg-white/90 shadow-sm hover:shadow-md"
      }`}
    >
      <span
        className={`inline-block text-xs font-semibold uppercase tracking-widest ${
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
  );
}
