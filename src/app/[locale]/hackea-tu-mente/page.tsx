import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { HACKEA_OG_IMAGE, hackeaConfig } from "@/data/hackea";
import { hackeaDisplay, isHackeaSalesOpen } from "@/lib/hackea-display";
import { buildHackeaEventJsonLd } from "@/lib/hackea-jsonld";
import HackeaLanding from "@/components/hackea/HackeaLanding";
import { hackeaFontClassName } from "@/components/hackea/fonts";

/**
 * Hackeá tu mente is Spanish-only: `/en/hackea-tu-mente` redirects here
 * (next.config.ts), so the page always renders — and declares itself — as
 * `/es/hackea-tu-mente`.
 */
const LOCALE = "es";
const PATH = `/${LOCALE}/hackea-tu-mente`;

// Re-rendered at most a minute after the talk starts, so the form gives way
// to the closed card without a deploy (the checkout 410s on its own).
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(LOCALE);
  const { meta } = dict.hackea;

  return {
    title: meta.title,
    description: meta.description,
    // Without this the page inherits `canonical: /es` from the locale layout.
    alternates: { canonical: PATH, languages: { es: PATH } },
    // A child openGraph REPLACES the layout's, so it carries the full block.
    // Relative image: `metadataBase` owns the host.
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: PATH,
      siteName: "Harald Solaas",
      locale: "es_AR",
      type: "website",
      images: [
        { url: `/${HACKEA_OG_IMAGE}`, width: 1200, height: 630, alt: meta.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: [`/${HACKEA_OG_IMAGE}`],
    },
  };
}

export default async function HackeaPage() {
  const dict = await getDictionary(LOCALE);
  // One clock read, so the markup and the form can't disagree on open/closed.
  const now = new Date();
  const jsonLd = buildHackeaEventJsonLd(
    { name: dict.hackea.meta.title, description: dict.hackea.meta.description },
    now,
  );
  return (
    <>
      {/* Event structured data — eligibility for Google's event rich results
          (date, venue and price in the result). The locale layout emits a
          Person node; this adds the event. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HackeaLanding
        dict={dict.hackea}
        display={hackeaDisplay()}
        priceLabel={hackeaConfig.ticketPriceLabel}
        locale={LOCALE}
        fontClassName={hackeaFontClassName}
        salesOpen={isHackeaSalesOpen(now)}
      />
    </>
  );
}
