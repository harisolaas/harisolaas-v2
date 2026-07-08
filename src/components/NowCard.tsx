"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { trackCtaClick } from "@/lib/analytics";
import type { NowItem, NowCategoryKey } from "@/dictionaries/types";

const categoryColors: Record<NowCategoryKey, { bg: string; text: string }> = {
  teaching: { bg: "bg-sage/20", text: "text-forest" },
  building: { bg: "bg-terracotta/20", text: "text-terracotta" },
  community: { bg: "bg-forest/20", text: "text-forest" },
  personal: { bg: "bg-tan/40", text: "text-charcoal" },
};

interface NowCardProps {
  item: NowItem;
}

export default function NowCard({ item }: NowCardProps) {
  const colors = categoryColors[item.categoryKey];
  const { cta } = item;

  return (
    <motion.div
      variants={fadeUp}
      className="group flex flex-col justify-between border border-forest/10 bg-white/50 p-5 transition-colors duration-300 hover:border-forest/30 hover:bg-white/80"
    >
      <div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}
          >
            {item.categoryLabel}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-charcoal/40">
            <span aria-hidden className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sage" />
            </span>
            {item.status}
          </span>
        </div>
        <h4 className="mt-4 font-serif text-lg text-forest">{item.title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
          {item.description}
        </p>
      </div>
      {cta && (
        <div className="mt-5">
          <a
            href={cta.href}
            onClick={() => trackCtaClick(cta.label, cta.href, "now")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta transition-colors hover:text-forest"
          >
            {cta.label}
            <svg
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </div>
      )}
    </motion.div>
  );
}
