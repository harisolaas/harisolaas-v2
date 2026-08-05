"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, heroStagger, staggerContainer } from "@/lib/animations";
import { trackSectionView, trackCtaClick } from "@/lib/analytics";
import SectionQuote from "./SectionQuote";
import type { MentoriaDict, MentoriaSection } from "@/dictionaries/types";

interface MentoriaLandingProps {
  dict: MentoriaDict;
  locale: string;
}

function Section({
  id,
  section,
}: {
  id: string;
  section: MentoriaSection;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (isInView) trackSectionView(`mentoria_${id}`);
  }, [isInView, id]);

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className="mx-auto max-w-2xl px-6 py-10 md:py-14"
    >
      <motion.h2
        variants={fadeUp}
        className="font-serif text-3xl text-forest md:text-4xl"
      >
        {section.heading}
      </motion.h2>
      {section.paragraphs.map((paragraph, i) => (
        <motion.p
          key={`${id}-${i}`}
          variants={fadeUp}
          className="mt-5 leading-relaxed text-charcoal/80 md:text-lg"
        >
          {paragraph}
        </motion.p>
      ))}
      {section.quote && <SectionQuote text={section.quote} />}
    </motion.section>
  );
}

export default function MentoriaLanding({
  dict,
  locale,
}: MentoriaLandingProps) {
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });

  useEffect(() => {
    trackSectionView("mentoria_hero");
  }, []);

  return (
    <main className="texture-overlay relative min-h-screen bg-cream">
      <div className="relative z-10">
        {/* Minimal top bar: brand link back home */}
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <a
            href={`/${locale}`}
            onClick={() => trackCtaClick("brand_home", `/${locale}`, "mentoria")}
            className="font-serif text-lg text-forest/70 transition-colors hover:text-forest"
          >
            Hari
          </a>
        </div>

        {/* Hero */}
        <motion.header
          initial="hidden"
          animate="visible"
          variants={heroStagger}
          className="mx-auto max-w-2xl px-6 pt-14 md:pt-20"
        >
          <motion.p variants={fadeUp} className="tech-label text-terracotta">
            {dict.hero.eyebrow}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-4 font-serif text-4xl leading-tight text-forest md:text-5xl lg:text-6xl"
          >
            {dict.hero.heading}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg leading-relaxed text-charcoal/70 md:text-xl"
          >
            {dict.hero.intro}
          </motion.p>
        </motion.header>

        <div className="mt-6 md:mt-10">
          <Section id="for_who" section={dict.sections.forWho} />
          <Section id="what" section={dict.sections.what} />
          <Section id="how" section={dict.sections.how} />
          <Section id="why_me" section={dict.sections.whyMe} />
        </div>

        {/* Practical block */}
        <section className="mx-auto max-w-2xl px-6 py-10 md:py-14">
          <h2 className="font-serif text-3xl text-forest md:text-4xl">
            {dict.practical.heading}
          </h2>
          <dl className="mt-6 divide-y divide-forest/10 border-y border-forest/10">
            {dict.practical.items.map((item) => (
              <div
                key={item.label}
                className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4"
              >
                <dt className="text-sm font-semibold uppercase tracking-wide text-forest/60">
                  {item.label}
                </dt>
                <dd className="text-charcoal/80">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 font-serif italic text-forest/70 md:text-lg">
            {dict.practical.note}
          </p>
        </section>

        {/* CTA */}
        <motion.section
          ref={ctaRef}
          initial="hidden"
          animate={ctaInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="texture-overlay relative mt-6 bg-forest px-6 py-14 md:py-20"
        >
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <motion.h2
              variants={fadeUp}
              className="font-serif text-3xl text-cream md:text-4xl"
            >
              {dict.cta.heading}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl leading-relaxed text-cream/70 md:text-lg"
            >
              {dict.cta.body}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8">
              <a
                href={dict.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackCtaClick("mentoria_whatsapp", dict.cta.href, "mentoria")
                }
                className="inline-block rounded-full border border-cream/30 bg-terracotta px-8 py-4 font-semibold text-cream transition-all hover:bg-terracotta/90 hover:shadow-lg"
              >
                {dict.cta.buttonLabel}
              </a>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
