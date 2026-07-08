"use client";

import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useEffect } from "react";
import { trackSectionView } from "@/lib/analytics";
import { easeOutExpo, fadeUp, staggerContainer } from "@/lib/animations";
import type { Dictionary } from "@/dictionaries/types";
import ProofCard from "./ProofCard";
import PhotoPlaceholder from "./PhotoPlaceholder";

interface BeyondSectionProps {
  dict: Dictionary["beyond"];
  /** Server-checked: whether /speaking.jpg exists in public yet */
  hasPhoto: boolean;
}

export default function BeyondSection({ dict, hasPhoto }: BeyondSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (isInView) trackSectionView("beyond");
  }, [isInView]);

  return (
    <section
      id="beyond"
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

        {/* Landscape banner — the speaking photo only works horizontal */}
        <div className="mt-8">
          {hasPhoto ? (
            <motion.div
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { clipPath: "inset(10% 6% 10% 6%)", opacity: 0 }
              }
              whileInView={
                reducedMotion
                  ? { opacity: 1 }
                  : { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }
              }
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 1.2, ease: easeOutExpo }}
              className="photo-warm-overlay relative aspect-[3/2] overflow-hidden md:aspect-[2/1]"
            >
              <Image
                src="/speaking.jpg"
                alt={dict.photoAlt}
                fill
                className="object-cover"
                style={{ objectPosition: "center 35%" }}
                sizes="(max-width: 1280px) 100vw, 1152px"
              />
            </motion.div>
          ) : (
            <PhotoPlaceholder alt={dict.photoAlt} aspect="landscape" />
          )}
        </div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="mt-8 grid gap-5 md:grid-cols-3"
        >
          {dict.items.map((item) => (
            <ProofCard key={item.label} proof={item} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
