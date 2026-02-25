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

  return (
    <motion.div
      variants={fadeUp}
      className="group flex flex-col justify-between rounded-lg bg-white/60 p-5 shadow-sm transition-all duration-300 hover:bg-white/90 hover:shadow-md"
    >
      <div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}
          >
            {item.categoryLabel}
          </span>
          <span className="text-xs text-charcoal/40">{item.status}</span>
        </div>
        <h4 className="mt-4 font-serif text-lg text-forest">{item.title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
          {item.description}
        </p>
      </div>
      <div className="mt-5">
        <a
          href={item.cta.href}
          onClick={() => trackCtaClick(item.cta.label, item.cta.href, "now")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta transition-colors hover:text-forest"
        >
          {item.cta.label}
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
    </motion.div>
  );
}
