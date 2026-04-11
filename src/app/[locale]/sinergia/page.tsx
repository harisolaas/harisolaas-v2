import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import SinergiaLanding from "@/components/SinergiaLanding";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  return {
    title: dict.sinergia.meta.title,
    description: dict.sinergia.meta.description,
    openGraph: {
      title: dict.sinergia.meta.title,
      description: dict.sinergia.meta.ogDescription,
      images: [{ url: "https://www.harisolaas.com/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.sinergia.meta.title,
      description: dict.sinergia.meta.ogDescription,
      images: ["https://www.harisolaas.com/og-image.jpg"],
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪵</text></svg>",
    },
  };
}

export default async function SinergiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <Suspense>
      <SinergiaLanding dict={dict.sinergia} locale={locale} />
    </Suspense>
  );
}
