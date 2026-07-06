"use client";

import Image from "next/image";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { trackSectionView } from "@/lib/analytics";
import { easeOutExpo, staggerContainer } from "@/lib/animations";
import type { ValueData } from "@/dictionaries/types";
import ProofCard from "./ProofCard";
import ScrubText from "./ScrubText";
import SectionQuote from "./SectionQuote";

/**
 * Flattened section colors used for the scroll-driven background morph.
 * These fork the @theme tokens in globals.css (--color-cream, --color-forest)
 * because framer-motion interpolates concrete values, not CSS variables:
 * cream = --color-cream, forest = --color-forest, and tan = --color-tan at
 * 30% alpha composited over cream (0.7·cream + 0.3·tan per channel). If the
 * palette in globals.css changes, re-derive these.
 */
const bgColor = {
  cream: "#FAF6F1",
  tan: "#EFE7DE",
  forest: "#2D4A3E",
} as const;

const bgConfig = {
  cream: { statement: "text-forest", dark: false },
  tan: { statement: "text-forest", dark: false },
  forest: { statement: "text-cream", dark: true },
} as const;

interface ValueSectionProps {
  value: ValueData;
  index: number;
  total: number;
  prevVariant: ValueData["variant"];
}

export default function ValueSection({
  value,
  index,
  total,
  prevVariant,
}: ValueSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reducedMotion = useReducedMotion();
  const config = bgConfig[value.variant];

  // SSR and pre-hydration paint must show the section's OWN color — the
  // morph's initial value is the previous section's, which server-renders
  // the forest section cream-on-cream. Morph only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The section enters wearing the previous section's color and resolves
  // to its own as it climbs the viewport — boundaries melt instead of cut.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.6"],
  });
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 1],
    [bgColor[prevVariant], bgColor[value.variant]]
  );

  // Inner-image parallax while the section is in view
  const { scrollYProgress: sectionProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const photoY = useTransform(sectionProgress, [0, 1], ["-6%", "6%"]);

  useEffect(() => {
    if (isInView) trackSectionView(value.id);
  }, [isInView, value.id]);
  const isEven = index % 2 === 0;

  const indexLabel = `${String(index + 1).padStart(2, "0")} / ${String(
    total
  ).padStart(2, "0")}`;

  return (
    <motion.section
      id={value.id}
      ref={ref}
      style={
        mounted && !reducedMotion
          ? { backgroundColor }
          : { backgroundColor: bgColor[value.variant] }
      }
      className="texture-overlay relative"
    >
      {/* Value statement */}
      <div
        style={{ minHeight: "var(--app-height-half, 50svh)" }}
        className="flex items-center px-6 py-12 md:px-12 md:py-16 lg:px-20"
      >
        <div className={`max-w-4xl ${isEven ? "" : "ml-auto text-right"}`}>
          <span
            className={`tech-label block ${
              config.dark ? "text-sage" : "text-terracotta"
            }`}
          >
            {indexLabel}
          </span>
          <h2
            className={`value-statement mt-5 text-4xl md:text-6xl lg:text-7xl ${config.statement}`}
          >
            <ScrubText text={value.statement} />
          </h2>
        </div>
      </div>

      {/* Evidence section */}
      <div className="relative px-6 pb-12 md:px-12 md:pb-16 lg:px-20">
        <div className="mx-auto max-w-6xl">
          {/* Asymmetric layout: photo + cards */}
          <div
            className={`flex flex-col gap-8 lg:flex-row lg:gap-12 ${
              isEven ? "" : "lg:flex-row-reverse"
            }`}
          >
            {/* Photo — clip-path reveal, inner parallax */}
            <div className="self-center lg:w-4/12 lg:flex-shrink-0">
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
                className="photo-warm-overlay relative aspect-[3/4] overflow-hidden"
              >
                <motion.div
                  style={reducedMotion ? undefined : { y: photoY }}
                  className="absolute -inset-y-[8%] inset-x-0"
                >
                  <Image
                    src={value.photoSrc}
                    alt={value.photoAlt}
                    fill
                    className="object-cover"
                    style={{ objectPosition: value.photoPosition ?? "center" }}
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    priority={index === 0}
                  />
                </motion.div>
              </motion.div>
            </div>

            {/* Proof cards */}
            <motion.div
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              variants={staggerContainer}
              className="flex flex-col gap-5 lg:w-8/12"
            >
              {value.proofPoints.map((proof) => (
                <ProofCard key={proof.label} proof={proof} dark={config.dark} />
              ))}
            </motion.div>
          </div>

          {/* Optional quote */}
          {value.quote && (
            <div className={`mx-auto max-w-3xl ${isEven ? "lg:ml-0" : "lg:mr-0"}`}>
              <SectionQuote text={value.quote.text} dark={config.dark} />
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
