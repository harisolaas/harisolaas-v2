import Link from "next/link";
import type { Metadata } from "next";
import { Unbounded, Dancing_Script } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { sinergiaConfig } from "@/data/sinergia";
import "../sinergia.css";

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

const WHATSAPP_HREF = "https://wa.me/5491122555110";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  return {
    title: dict.sinergia.successPage.title,
    robots: { index: false, follow: false },
  };
}

export default async function SinergiaSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const copy = dict.sinergia.successPage;

  const sessionLine = copy.sessionLine
    .replace("{date}", sinergiaConfig.dayLabelEs)
    .replace("{time}", sinergiaConfig.time);
  const addressLine = copy.addressLine
    .replace("{venue}", sinergiaConfig.venueName)
    .replace("{address}", sinergiaConfig.exactAddress);

  return (
    <div className={`${unbounded.variable} ${dancingScript.variable}`}>
      <div className="sinergia-theme min-h-[100svh] bg-cream">
        <main className="mx-auto flex min-h-[100svh] max-w-lg flex-col items-center justify-center gap-8 px-6 py-16 text-center">
          <span className="font-script text-3xl text-terracotta">Gracias</span>
          <h1 className="font-serif text-3xl text-forest md:text-4xl">
            {copy.heading}
          </h1>
          <p className="text-base leading-relaxed text-charcoal/75 md:text-lg">
            {copy.body}
          </p>
          <div className="w-full rounded-2xl border border-sage/30 bg-white/70 p-6 text-left">
            <p className="text-sm font-semibold uppercase tracking-wider text-sage">
              {sinergiaConfig.dayLabelEs}
            </p>
            <p className="mt-1 text-base text-forest">{sessionLine}</p>
            <p className="mt-1 text-sm text-charcoal/70">{addressLine}</p>
          </div>
          <div className="flex flex-col items-stretch gap-3 md:flex-row">
            <a
              href={WHATSAPP_HREF}
              className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest/90"
            >
              {copy.whatsappCta}
            </a>
            <Link
              href={`/${locale}/sinergia`}
              className="rounded-full border border-forest/30 px-6 py-3 text-sm font-semibold text-forest transition-colors hover:border-forest/60"
            >
              {copy.backLink}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
