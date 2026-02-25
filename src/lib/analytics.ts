import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: "memory", // cookieless — no banner needed
  });

  initialized = true;
}

// Section visibility tracking
export function trackSectionView(sectionId: string) {
  posthog.capture("section_viewed", { section: sectionId });
}

// CTA click tracking
export function trackCtaClick(label: string, href: string, section: string) {
  posthog.capture("cta_clicked", { label, href, section });
}

// Timeline expand/collapse
export function trackTimelineToggle(expanded: boolean) {
  posthog.capture("timeline_toggled", { expanded });
}

// Scroll depth milestones
export function trackScrollDepth(percent: number) {
  posthog.capture("scroll_depth", { percent });
}

// Navigation click
export function trackNavClick(label: string, href: string) {
  posthog.capture("nav_clicked", { label, href });
}

// Locale switch
export function trackLocaleSwitch(from: string, to: string) {
  posthog.capture("locale_switched", { from, to });
}
