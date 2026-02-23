"use client";

import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fadeUp, fadeUpSlow, staggerContainer } from "@/lib/animations";
import type { ValueData } from "@/data/values";
import ProofCard from "./ProofCard";
import SectionQuote from "./SectionQuote";

const bgConfig = {
  cream: {
    section: "bg-cream",
    statement: "text-forest",
    dark: false,
  },
  tan: {
    section: "bg-tan/30",
    statement: "text-forest",
    dark: false,
  },
  forest: {
    section: "bg-forest",
    statement: "text-cream",
    dark: true,
  },
} as const;

interface ValueSectionProps {
  value: ValueData;
  index: number;
}

export default function ValueSection({ value, index }: ValueSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const config = bgConfig[value.variant];
  const isEven = index % 2 === 0;

  return (
    <section
      id={value.id}
      ref={ref}
      className={`texture-overlay relative ${config.section}`}
    >
      {/* Value statement */}
      <div className="flex min-h-[50vh] items-center px-6 py-12 md:px-12 md:py-16 lg:px-20">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeUpSlow}
          className={`max-w-4xl ${isEven ? "" : "ml-auto text-right"}`}
        >
          <h2
            className={`value-statement text-4xl md:text-6xl lg:text-7xl ${config.statement}`}
          >
            {value.statement}
          </h2>
        </motion.div>
      </div>

      {/* Evidence section */}
      <div className="relative px-6 pb-12 md:px-12 md:pb-16 lg:px-20">
        <div
          className={`mx-auto max-w-6xl ${isEven ? "" : ""}`}
        >
          {/* Asymmetric layout: photo + cards */}
          <div
            className={`flex flex-col gap-8 lg:flex-row lg:gap-12 ${
              isEven ? "" : "lg:flex-row-reverse"
            }`}
          >
            {/* Photo */}
            <div className="self-center lg:w-4/12 lg:flex-shrink-0">
              <div className="photo-warm-overlay aspect-[3/4] overflow-hidden rounded-lg shadow-md">
                <Image
                  src={value.photoSrc}
                  alt={value.photoAlt}
                  fill
                  className="object-cover"
                  style={{ objectPosition: value.photoPosition ?? "center" }}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  priority={index === 0}
                />
              </div>
            </div>

            {/* Proof cards */}
            <motion.div
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              variants={staggerContainer}
              className="flex flex-col gap-5 lg:w-8/12"
            >
              {value.proofPoints.map((proof) => (
                <ProofCard
                  key={proof.label}
                  proof={proof}
                  dark={config.dark}
                />
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
    </section>
  );
}
