import posthog from "posthog-js";

let initialized = false;

/**
 * Query params that must never leave the browser inside an analytics URL.
 *
 * `capture_pageview` sends `$current_url` verbatim — query string included —
 * to PostHog Cloud. Some of our return/magic-link URLs carry credentials:
 * `external_reference` is the BROTE `ct` capability token (holding it lets
 * you rewrite a ticket's delivery address), and `verifCode` is the 6-digit
 * email-verification code from the checkout magic link. The checkout form
 * strips its params on mount, but that runs *after* the layout-level
 * PostHog effect, so the pre-strip URL is already captured.
 */
const REDACTED_QUERY_PARAMS = [
  "external_reference",
  "verifCode",
  "verifEmail",
  "payment_id",
  "collection_id",
  "token",
];

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    let touched = false;
    for (const param of REDACTED_QUERY_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, "redacted");
        touched = true;
      }
    }
    return touched ? url.toString() : value;
  } catch {
    return value;
  }
}

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
    sanitize_properties: (properties) => {
      for (const key of ["$current_url", "$referrer", "$pathname"]) {
        const value = properties[key];
        if (typeof value === "string") properties[key] = redactUrl(value);
      }
      return properties;
    },
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

