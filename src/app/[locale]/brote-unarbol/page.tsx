import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import BroteUnArbol from "@/components/BroteUnArbol";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "BROTE × Un Árbol",
    description:
      locale === "es"
        ? "Entrada especial para la comunidad de Un Árbol. 25% OFF."
        : "Special ticket for the Un Árbol community. 25% OFF.",
    robots: { index: false, follow: false },
    openGraph: {
      title: "BROTE × Un Árbol",
      description:
        locale === "es"
          ? "Entrada especial para la comunidad de Un Árbol. 25% OFF."
          : "Special ticket for the Un Árbol community. 25% OFF.",
      images: [{ url: "https://www.harisolaas.com/og-brote.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: ["https://www.harisolaas.com/og-brote.jpg"],
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
    },
  };
}

export default async function BroteUnArbolPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <Suspense>
      <BroteUnArbol dict={dict.broteUnArbol} locale={locale} />
    </Suspense>
  );
}
