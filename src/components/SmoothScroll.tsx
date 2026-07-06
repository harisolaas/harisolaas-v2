"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Lerped scrolling for the landing page. Renders nothing — mounting it
 * attaches Lenis to the document, unmounting tears it down. Not used on
 * conversion funnels (BROTE, Sinergia), only the storytelling landing.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.1,
      anchors: { offset: 0 },
    });

    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
