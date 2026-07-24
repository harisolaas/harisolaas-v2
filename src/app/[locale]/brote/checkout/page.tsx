import type { Metadata } from "next";
import { Archivo, Instrument_Serif, Space_Mono } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { broteConfig } from "@/data/brote";
import BroteCheckoutForm from "@/components/BroteCheckoutForm";

// Same BROTE-scoped fonts as the landing (the rest of the site keeps
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
  const { meta } = dict.broteCheckout;

  return {
    title: meta.title,
    description: meta.description,
    robots: { index: false, follow: false },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
    },
  };
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function BroteCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const dict = await getDictionary(locale as Locale);

  // Early-bird resolved the same way as the landing / checkout API
  // (end of deadline day, Argentina time). Display-only — the checkout
  // route recomputes the authoritative price.
  const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
  const isEarlyBird = new Date() <= deadline;

  return (
    <div
      className={`${archivo.variable} ${instrumentSerif.variable} ${spaceMono.variable}`}
    >
      <BroteCheckoutForm
        dict={dict.broteCheckout}
        locale={locale}
        isEarlyBird={isEarlyBird}
        priceDisplay={
          isEarlyBird ? broteConfig.earlyBirdPrice : broteConfig.ticketPrice
        }
        priceRaw={
          isEarlyBird ? broteConfig.earlyBirdPriceRaw : broteConfig.ticketPriceRaw
        }
        initialName={firstParam(sp.verifName)}
        initialEmail={firstParam(sp.verifEmail)}
        initialCode={firstParam(sp.verifCode)}
      />
    </div>
  );
}
