import { Suspense } from "react";
import type { Metadata } from "next";
import { Unbounded, Dancing_Script } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import SinergiaParrafoLanding from "@/components/SinergiaParrafoLanding";
// Reuse the Sinergia theme — palette, fonts, and Aileron face — so this
// landing inherits the same look without forking CSS.
import "../sinergia/sinergia.css";

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-sinergia-display",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-sinergia-script",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  return {
    title: dict.sinergiaParrafo.meta.title,
    description: dict.sinergiaParrafo.meta.description,
    openGraph: {
      title: dict.sinergiaParrafo.meta.title,
      description: dict.sinergiaParrafo.meta.ogDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: dict.sinergiaParrafo.meta.title,
      description: dict.sinergiaParrafo.meta.ogDescription,
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📖</text></svg>",
    },
  };
}

export default async function SinergiaParrafoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <Suspense>
      <div className={`${unbounded.variable} ${dancingScript.variable}`}>
        <SinergiaParrafoLanding dict={dict.sinergiaParrafo} locale={locale} />
      </div>
    </Suspense>
  );
}
