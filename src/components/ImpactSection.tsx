"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import { trackSectionView } from "@/lib/analytics";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { Dictionary } from "@/dictionaries/types";
import ProofCard from "./ProofCard";

interface ImpactSectionProps {
  dict: Dictionary["impact"];
}

export default function ImpactSection({ dict }: ImpactSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (isInView) trackSectionView("impact");
  }, [isInView]);

  return (
    <section
      id="impact"
      ref={ref}
      className="texture-overlay relative bg-cream px-6 py-12 md:px-12 md:py-16 lg:px-20"
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.h2
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeUp}
          className="font-serif text-4xl text-forest md:text-5xl"
        >
          {dict.heading}
        </motion.h2>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="mt-8 grid gap-5 lg:grid-cols-2"
        >
          {dict.items.map((item) => (
            <ProofCard key={item.label} proof={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
