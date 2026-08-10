import type { Metadata } from "next";
import { Archivo, Instrument_Serif, Space_Mono } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { BROTE_OG_IMAGE } from "@/data/brote";
import { buildBroteEventJsonLd } from "@/lib/brote-jsonld";
import BroteLanding from "@/components/BroteLanding";

// Fonts scoped to the BROTE landing only (the rest of the site keeps
// DM Serif / Source Sans / JetBrains from the shared locale layout).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-brote-archivo",
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-brote-serif",
  display: "swap",
});
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-brote-mono",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const { meta } = dict.brote;

  return {
    title: meta.title,
    description: meta.description,
    // Without this the page inherits `canonical: /${locale}` from the locale
    // layout and tells search engines the homepage is its canonical URL — the
    // landing was competing with, and losing to, the personal site.
    alternates: {
      canonical: `/${locale}/brote`,
      languages: { es: "/es/brote", en: "/en/brote" },
    },
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: `/${locale}/brote`,
      siteName: "BROTE",
      locale: locale === "es" ? "es_AR" : "en_US",
      type: "website",
      // Relative on purpose: `metadataBase` owns the host, so it is written
      // once. The `-v2` name is load-bearing — Facebook, WhatsApp and X cache
      // OG images by URL, so reusing the old path would keep serving the
      // edition-1 card (28 March) from their caches for weeks.
      images: [
        {
          url: `/${BROTE_OG_IMAGE}`,
          width: 1200,
          height: 630,
          alt: meta.ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: [`/${BROTE_OG_IMAGE}`],
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
    },
  };
}

export default async function BrotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <div
      className={`${archivo.variable} ${instrumentSerif.variable} ${spaceMono.variable}`}
    >
      {/* Event structured data — what makes the landing eligible for Google's
          event rich results (date, venue and price in the result itself).
          The locale layout emits a Person node; this adds the event. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBroteEventJsonLd(locale)),
        }}
      />
      <BroteLanding dict={dict.brote} locale={locale} />
    </div>
  );
}
