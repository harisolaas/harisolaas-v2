"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, heroStagger } from "@/lib/animations";
import { socialLinks, caseStudyLink } from "@/data/links";

export default function Contact() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

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
        <motion.h2
          variants={fadeUp}
          className="font-serif text-4xl text-cream md:text-5xl lg:text-6xl"
        >
          Let&rsquo;s build something.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-6 text-cream/70 md:text-lg md:leading-relaxed"
        >
          I work as a senior technology consultant &mdash; helping companies
          build the right products with the right technologies. I bring deep
          engineering expertise, human communication, and a service-oriented
          mindset. If you want an engineer who cares about your problem as much
          as you do, let&rsquo;s talk.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-full border border-cream/20 px-6 py-3 text-sm font-semibold text-cream transition-all hover:border-cream/50 hover:bg-cream/10"
            >
              {link.label}
            </a>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8">
          <a
            href={caseStudyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-terracotta/80 transition-colors hover:text-terracotta"
          >
            Read the Carewell Case Study on Toptal
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
