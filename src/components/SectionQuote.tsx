"use client";

import ScrollReveal from "./ScrollReveal";
import { fadeUpSlow } from "@/lib/animations";

interface SectionQuoteProps {
  text: string;
  dark?: boolean;
}

export default function SectionQuote({ text, dark = false }: SectionQuoteProps) {
  return (
    <ScrollReveal variants={fadeUpSlow} className="mt-8 md:mt-10">
      <blockquote
        className={`relative border-l-2 pl-6 md:pl-8 ${
          dark ? "border-terracotta/50" : "border-terracotta/40"
        }`}
      >
        <p
          className={`font-serif text-lg italic leading-relaxed md:text-xl lg:text-2xl ${
            dark ? "text-cream/80" : "text-forest/80"
          }`}
        >
          &ldquo;{text}&rdquo;
        </p>
      </blockquote>
    </ScrollReveal>
  );
}
