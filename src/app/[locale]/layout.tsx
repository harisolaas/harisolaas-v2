import type { Metadata } from "next";
import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import { locales, type Locale } from "@/i18n/config";
import { socialLinks } from "@/data/links";
import "../globals.css";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
    keywords: dict.metadata.keywords,
    authors: [{ name: "Harald Solaas" }],
    openGraph: {
      title: dict.metadata.ogTitle,
      description: dict.metadata.ogDescription,
      url: `https://harisolaas.com/${locale}`,
      siteName: "Harald Solaas",
      locale: locale === "es" ? "es_AR" : "en_US",
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.metadata.twitterTitle,
      description: dict.metadata.twitterDescription,
      images: ["/og-image.png"],
    },
    metadataBase: new URL("https://harisolaas.com"),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: "/en",
        es: "/es",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  const sameAs = socialLinks
    .filter((l) => l.external)
    .map((l) => l.href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Harald Solaas",
    alternateName: "Hari Solaas",
    jobTitle: "Senior Software Engineer & Technology Consultant",
    url: `https://harisolaas.com/${locale}`,
    description: dict.metadata.description,
    sameAs,
    knowsAbout: [
      "React",
      "Next.js",
      "TypeScript",
      "Node.js",
      "GraphQL",
      "AI Solutions",
      "Full Stack Development",
      "Technology Consulting",
    ],
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Universidad de Belgrano",
    },
  };

  return (
    <html
      lang={locale}
      className={`${dmSerif.variable} ${sourceSans.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: `[style]{opacity:1!important;transform:none!important;height:auto!important}`,
            }}
          />
        </noscript>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
