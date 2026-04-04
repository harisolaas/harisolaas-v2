import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import PlantLanding from "@/components/PlantLanding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const { meta } = dict.plant;

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
      images: [{ url: "https://www.harisolaas.com/og-brote.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: ["https://www.harisolaas.com/og-brote.jpg"],
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
    },
  };
}

export default async function BrotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const dict = await getDictionary(locale as Locale);
  const utmMedium = typeof query.utm_medium === "string" ? query.utm_medium : undefined;

  return <PlantLanding dict={dict.plant} locale={locale} utmMedium={utmMedium} />;
}
