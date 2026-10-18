import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { hackeaConfig } from "@/data/hackea";
import { hackeaDisplay } from "@/lib/hackea-display";
import HackeaLanding from "@/components/hackea/HackeaLanding";
import { hackeaFontClassName } from "@/components/hackea/fonts";

/**
 * Hackeá tu mente is Spanish-only: `/en/hackea-tu-mente` redirects here
 * (next.config.ts), so the page always renders — and declares itself — as
 * `/es/hackea-tu-mente`.
 */
const LOCALE = "es";
const PATH = `/${LOCALE}/hackea-tu-mente`;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(LOCALE);
  const { meta } = dict.hackea;

  return {
    title: meta.title,
    description: meta.description,
    // Without this the page inherits `canonical: /es` from the locale layout.
    alternates: { canonical: PATH, languages: { es: PATH } },
    // A child openGraph REPLACES the layout's, so it carries the full block.
    // The personal-site card stands in until the charla has its own.
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: PATH,
      siteName: "Harald Solaas",
      locale: "es_AR",
      type: "website",
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function HackeaPage() {
  const dict = await getDictionary(LOCALE);
  return (
    <HackeaLanding
      dict={dict.hackea}
      display={hackeaDisplay()}
      priceLabel={hackeaConfig.ticketPriceLabel}
      locale={LOCALE}
      fontClassName={hackeaFontClassName}
    />
  );
}
