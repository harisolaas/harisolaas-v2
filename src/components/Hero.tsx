"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import dynamic from "next/dynamic";
import { easeOutExpo } from "@/lib/animations";
import { trackSectionView, trackCtaClick } from "@/lib/analytics";
import SplitText from "./SplitText";
import type { Dictionary } from "@/dictionaries/types";

// Client-only, loaded after the type has painted; CSS texture is the fallback
const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

interface HeroProps {
  dict: Dictionary["hero"];
}

export default function Hero({ dict }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  // Parallax as the hero scrolls away: type drifts up, portrait lags behind
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  // Max travel must stay inside the wrapper's -inset-y-[8%] bleed or the
  // frame edge exposes background mid-scroll (8% × 1.16 wrapper ≈ 6.9% frame)
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "6%"]);

  useEffect(() => {
    trackSectionView("hero");
  }, []);

  const [firstName, ...restName] = dict.name.split(" ");
  const lastName = restName.join(" ");

  return (
    <section
      id="hero"
      ref={ref}
      style={{ minHeight: "var(--app-height, 100svh)" }}
      className="texture-overlay relative flex items-center overflow-hidden bg-cream px-6 pb-24 pt-28 md:px-12 lg:px-20"
    >
      <HeroCanvas />
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          {/* Type block */}
          <motion.div
            style={reducedMotion ? undefined : { y: textY }}
            className="lg:flex-1"
          >
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.15 }}
              className="tech-label flex flex-wrap items-center gap-x-3 gap-y-1 text-charcoal/50"
            >
              <span>{dict.metaRole}</span>
              <span aria-hidden className="text-terracotta">
                /
              </span>
              <span>{dict.metaLocation}</span>
            </motion.p>

            <h1 className="mt-6 font-serif uppercase leading-[0.95] tracking-tight text-forest">
              <span className="block text-[clamp(3.4rem,11vw,9.5rem)]">
                <SplitText
                  text={firstName}
                  by="char"
                  immediate
                  delay={0.35}
                  stagger={0.04}
                />
              </span>
              <span className="block text-[clamp(3.4rem,11vw,9.5rem)] lg:pl-[0.9em]">
                <SplitText
                  text={lastName}
                  by="char"
                  immediate
                  delay={0.55}
                  stagger={0.04}
                />
              </span>
            </h1>

            <p className="mt-8 max-w-md font-serif text-lg italic leading-relaxed text-charcoal/70 md:text-xl">
              <SplitText text={dict.tagline} immediate delay={1.1} stagger={0.02} />
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.6 }}
              className="mt-8"
            >
              <p className="max-w-md text-sm leading-relaxed text-charcoal/60 md:text-base">
                {dict.positioning}
              </p>
              <a
                href="#contact"
                onClick={() => trackCtaClick("hero_contact", "#contact", "hero")}
                className="group/cta mt-4 inline-flex items-center gap-3 text-sm font-semibold text-terracotta transition-colors hover:text-forest"
              >
                {dict.ctaLabel}
                <span
                  aria-hidden
                  className="block h-px w-8 bg-terracotta transition-all group-hover/cta:w-12 group-hover/cta:bg-forest"
                />
              </a>
            </motion.div>
          </motion.div>

          {/* Portrait */}
          <motion.figure
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: easeOutExpo, delay: 0.9 }}
            className="w-52 md:w-60 lg:w-[290px] lg:flex-shrink-0"
          >
            <div className="photo-warm-overlay relative aspect-[3/4] overflow-hidden">
              <motion.div
                style={reducedMotion ? undefined : { y: photoY }}
                className="absolute -inset-y-[8%] inset-x-0"
              >
                <Image
                  src="/hari.jpg"
                  alt={dict.photoAlt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 240px, 290px"
                  className="object-cover"
                  style={{
                    filter: "brightness(1.02) saturate(0.95) sepia(0.08)",
                  }}
                />
              </motion.div>
            </div>
            <figcaption className="tech-label mt-3 text-charcoal/40">
              {dict.photoCaption}
            </figcaption>
          </motion.figure>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        className="absolute bottom-8 left-6 z-10 md:left-12 lg:left-20"
      >
        <a
          href="#impact"
          className="group flex items-center gap-3 text-charcoal/50 transition-colors hover:text-forest"
        >
          <span className="tech-label">{dict.scrollCta}</span>
          <motion.span
            aria-hidden
            animate={reducedMotion ? undefined : { scaleX: [0.25, 1, 0.25] }}
            transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
            className="block h-px w-12 origin-left bg-terracotta"
          />
        </a>
      </motion.div>
    </section>
  );
}
