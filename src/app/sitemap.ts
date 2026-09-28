import type { MetadataRoute } from "next";

/**
 * www, not the apex — Vercel 307-redirects `harisolaas.com` to `www`, so every
 * apex URL listed here costs a crawler a redirect before it reaches the page.
 */
const BASE = "https://www.harisolaas.com";

const homeAlternates = {
  en: `${BASE}/en`,
  es: `${BASE}/es`,
};

const broteAlternates = {
  en: `${BASE}/en/brote`,
  es: `${BASE}/es/brote`,
};

const desafioAlternates = {
  en: `${BASE}/en/desafio`,
  es: `${BASE}/es/desafio`,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${BASE}/en`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: { languages: homeAlternates },
    },
    {
      url: `${BASE}/es`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1.0,
      alternates: { languages: homeAlternates },
    },
    // The ticketed event. `daily` while it is live: the page carries a
    // countdown and a price that changes at the preventa deadline.
    // Invitation pages stay out on purpose — they are `noindex`, handed out by
    // collaborators rather than found in search.
    {
      url: `${BASE}/es/brote`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: broteAlternates },
    },
    {
      url: `${BASE}/en/brote`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: broteAlternates },
    },
    // The 15-day challenge. `daily`: a new practice unlocks every day while
    // it runs.
    {
      url: `${BASE}/es/desafio`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
      alternates: { languages: desafioAlternates },
    },
    {
      url: `${BASE}/en/desafio`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
      alternates: { languages: desafioAlternates },
    },
  ];
}
