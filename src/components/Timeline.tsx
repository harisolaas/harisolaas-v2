"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { Dictionary } from "@/dictionaries/types";

const typeColors = {
  work: "bg-terracotta",
  life: "bg-forest",
  community: "bg-sage",
} as const;

interface TimelineProps {
  dict: Dictionary["timeline"];
}

export default function Timeline({ dict }: TimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="timeline"
      ref={ref}
      className="texture-overlay relative bg-tan/30 px-6 py-12 md:px-12 md:py-16 lg:px-20"
    >
      <div className="relative z-10 mx-auto max-w-4xl">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeUp}
          className="text-center"
        >
          <h2 className="font-serif text-4xl text-forest md:text-5xl">
            {dict.heading}
          </h2>
          <p className="mt-4 text-charcoal/60">
            {dict.subheading}
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={fadeUp}
          className="mt-6 flex justify-center"
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="group flex items-center gap-2 rounded-full border border-forest/20 px-6 py-3 text-sm font-semibold text-forest transition-all hover:border-forest/40 hover:bg-forest/5"
          >
            {isExpanded ? dict.collapse : dict.expand}
            <motion.svg
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </motion.svg>
          </button>
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="relative mt-10"
              >
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-sage/40 md:left-1/2 md:-translate-x-px" />

                {dict.entries.map((entry, i) => (
                  <motion.div
                    key={entry.year + entry.title}
                    variants={fadeUp}
                    className={`relative mb-8 flex items-start gap-6 md:gap-0 ${
                      i % 2 === 0
                        ? "md:flex-row"
                        : "md:flex-row-reverse"
                    }`}
                  >
                    {/* Dot */}
                    <div
                      className={`relative z-10 mt-1.5 h-3 w-3 flex-shrink-0 rounded-full ${typeColors[entry.type]} md:absolute md:left-1/2 md:-translate-x-1.5`}
                    />

                    {/* Content */}
                    <div
                      className={`flex-1 md:w-[calc(50%-2rem)] ${
                        i % 2 === 0
                          ? "md:pr-12 md:text-right"
                          : "md:pl-12"
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                        {entry.year}
                      </span>
                      <h4 className="mt-1 font-serif text-lg text-forest">
                        {entry.title}
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
                        {entry.description}
                      </p>
                    </div>

                    {/* Spacer for alternating sides */}
                    <div className="hidden flex-1 md:block" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Technologies */}
              <motion.div variants={fadeUp} className="mt-10 text-center">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-sage">
                  {dict.techHeading}
                </h3>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {dict.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-forest/10 bg-white/50 px-3 py-1 text-xs text-charcoal/70"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
