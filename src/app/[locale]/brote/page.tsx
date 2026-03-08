import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import BroteLanding from "@/components/BroteLanding";

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
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: `https://harisolaas.com/${locale}/brote`,
      siteName: "BROTE",
      locale: locale === "es" ? "es_AR" : "en_US",
      type: "website",
      images: [{ url: "https://harisolaas.com/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: ["https://harisolaas.com/og-image.jpg"],
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

  return <BroteLanding dict={dict.brote} locale={locale} />;
}
