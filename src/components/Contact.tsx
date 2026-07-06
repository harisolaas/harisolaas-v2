"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, heroStagger } from "@/lib/animations";
import { trackSectionView, trackCtaClick } from "@/lib/analytics";
import { socialLinks, caseStudyLink } from "@/data/links";
import SplitText from "./SplitText";
import type { Dictionary } from "@/dictionaries/types";

const email =
  socialLinks.find((l) => l.key === "email")?.href.replace("mailto:", "") ??
  "";

interface ContactProps {
  dict: Dictionary["contact"];
}

export default function Contact({ dict }: ContactProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isInView) trackSectionView("contact");
  }, [isInView]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <section
      id="contact"
      ref={ref}
      className="texture-overlay relative bg-forest px-6 py-12 md:px-12 md:py-20 lg:px-20"
    >
      <motion.div
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={heroStagger}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <h2 className="font-serif text-4xl text-cream md:text-5xl lg:text-6xl">
          <SplitText text={dict.heading} stagger={0.06} />
        </h2>
        <motion.p
          variants={fadeUp}
          className="mt-6 text-cream/70 md:text-lg md:leading-relaxed"
        >
          {dict.description}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          {socialLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              onClick={() => trackCtaClick(link.key, link.href, "contact")}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-full border border-cream/20 px-6 py-3 text-sm font-semibold text-cream transition-all hover:border-cream/50 hover:bg-cream/10"
            >
              {dict.linkLabels[link.key]}
            </a>
          ))}
        </motion.div>

        {/* Copy-to-clipboard affordance under the link pills */}
        <motion.div variants={fadeUp} className="mt-5">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(email).then(() => setCopied(true));
              trackCtaClick("copy_email", email, "contact");
            }}
            className="tech-label text-cream/50 transition-colors hover:text-cream"
            aria-live="polite"
          >
            {copied ? dict.copiedEmail : `${dict.copyEmail} — ${email}`}
          </button>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8">
          <a
            href={caseStudyLink}
            onClick={() => trackCtaClick("case_study", caseStudyLink, "contact")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-terracotta/80 transition-colors hover:text-terracotta"
          >
            {dict.caseStudyLabel}
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
              />
            </svg>
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
