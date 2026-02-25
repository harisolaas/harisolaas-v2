"use client";

import { useEffect, useRef } from "react";
import { initPostHog, trackScrollDepth } from "@/lib/analytics";

export default function Analytics() {
  const milestones = useRef(new Set<number>());

  useEffect(() => {
    initPostHog();

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const percent = Math.round((scrollTop / docHeight) * 100);

      for (const milestone of [25, 50, 75, 100]) {
        if (percent >= milestone && !milestones.current.has(milestone)) {
          milestones.current.add(milestone);
          trackScrollDepth(milestone);
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
