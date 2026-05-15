import { Suspense } from "react";
import type { Metadata } from "next";
import { Unbounded, Dancing_Script } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import SinergiaParrafoDoubleLanding from "@/components/SinergiaParrafoDoubleLanding";
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
    title: dict.sinergiaParrafoDouble.meta.title,
    description: dict.sinergiaParrafoDouble.meta.description,
    // Code-gated landing — keep it out of search results.
    robots: { index: false, follow: false },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📖</text></svg>",
    },
  };
}

export default async function SinergiaParrafoDoublePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <Suspense>
      <div className={`${unbounded.variable} ${dancingScript.variable}`}>
        <SinergiaParrafoDoubleLanding
          dict={dict.sinergiaParrafoDouble}
          locale={locale}
        />
      </div>
    </Suspense>
  );
}
