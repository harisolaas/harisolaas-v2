"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect } from "react";
import { trackSectionView } from "@/lib/analytics";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { Dictionary } from "@/dictionaries/types";
import NowCard from "./NowCard";

interface NowSectionProps {
  dict: Dictionary["now"];
}

export default function NowSection({ dict }: NowSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (isInView) trackSectionView("now");
  }, [isInView]);

  return (
    <section
      id="now"
      ref={ref}
      className="texture-overlay relative bg-cream px-6 py-12 md:px-12 md:py-16 lg:px-20"
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeUp}
        >
          <h2 className="font-serif text-4xl text-forest md:text-5xl">
            {dict.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-charcoal/60 md:text-lg">
            {dict.subheading}
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {dict.items.map((item) => (
            <NowCard key={item.title} item={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
