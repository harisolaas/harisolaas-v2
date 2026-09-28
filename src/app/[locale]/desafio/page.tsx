import type { Metadata } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import { loadDesafio } from "@/lib/desafio-server";
import DesafioApp from "@/components/desafio/DesafioApp";

// The design's type (Organic design system), loaded for this page only.
const caprasimo = Caprasimo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-desafio-heading",
  display: "swap",
});

const figtree = Figtree({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-desafio-body",
  display: "swap",
});

/**
 * The desafío is Spanish-only: its practices, day content and event copy
 * are all in Spanish. `/en/desafio` redirects here (next.config.ts), so the
 * page always renders — and declares itself — as `/es/desafio`.
 */
const LOCALE = "es";

// Content comes from the DB and a day appears the moment it's published, so
// this page is rendered per request. Unpublished days reach the page as
// `{ dia, publicado: false }` only — `buildDesafioDays` strips their content.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = LOCALE;
  const dict = await getDictionary(locale);
  const { meta } = dict.desafio;

  return {
    title: meta.title,
    description: meta.description,
    // Without this the page inherits `canonical: /${locale}` from the locale
    // layout and points search engines at the homepage.
    alternates: {
      canonical: `/${locale}/desafio`,
      // Only one language: override the layout's es/en home alternates.
      languages: { es: "/es/desafio" },
    },
    // A child openGraph REPLACES the layout's, so it carries the full block.
    // The personal-site card is a stand-in until the desafío has its own.
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: `/${locale}/desafio`,
      siteName: "Harald Solaas",
      locale: "es_AR",
      type: "website",
      images: [
        { url: "/og-image.jpg", width: 1200, height: 630, alt: meta.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function DesafioPage() {
  const [data, dict] = await Promise.all([loadDesafio(), getDictionary(LOCALE)]);
  return (
    <DesafioApp
      data={data}
      dict={dict.desafio}
      fontClassName={`${caprasimo.variable} ${figtree.variable}`}
    />
  );
}
