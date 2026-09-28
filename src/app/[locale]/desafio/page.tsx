import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import {
  desafioConfig,
  desafioPhase,
  desafioStartDate,
  formatDayDate,
  isRegistrationOpen,
  unlockedDayCount,
  type DesafioLocale,
} from "@/data/desafio";
import { buildPublicDays, type DesafioPublicDay } from "@/lib/desafio";
import { loadPublicDesafioDays } from "@/lib/desafio-server";
import DesafioLanding from "@/components/DesafioLanding";

// Unlocking depends on `now` and content comes from the DB, so this page is
// rendered per request. Locked days are stripped server-side by
// `buildPublicDays` — their content never reaches the client.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const { meta } = dict.desafio;

  return {
    title: meta.title,
    description: meta.description,
    // Without this the page inherits `canonical: /${locale}` from the locale
    // layout and points search engines at the homepage.
    alternates: {
      canonical: `/${locale}/desafio`,
      languages: { es: "/es/desafio", en: "/en/desafio" },
    },
    // A child openGraph REPLACES the layout's, so it carries the full block.
    // The personal-site card is a stand-in until the desafío has its own.
    openGraph: {
      title: meta.title,
      description: meta.ogDescription,
      url: `/${locale}/desafio`,
      siteName: "Harald Solaas",
      locale: locale === "es" ? "es_AR" : "en_US",
      type: "website",
      images: [
        { url: "/og-image.jpg", width: 1200, height: 630, alt: meta.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.ogDescription,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function DesafioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const loc: DesafioLocale = locale === "en" ? "en" : "es";
  const now = new Date();

  let days: DesafioPublicDay[];
  try {
    days = await loadPublicDesafioDays(now, loc);
  } catch (err) {
    // A DB hiccup must never take down the landing or the form: fall back
    // to the date-only view (every unlocked day shows the placeholder).
    console.error("[desafio] failed to load days", err);
    days = buildPublicDays([], now, loc);
  }

  return (
    <DesafioLanding
      dict={dict.desafio}
      locale={loc}
      days={days}
      phase={desafioPhase(now)}
      unlockedDays={unlockedDayCount(now)}
      totalDays={desafioConfig.totalDays}
      startDateLabel={formatDayDate(desafioStartDate(), loc)}
      registrationOpen={isRegistrationOpen(now)}
    />
  );
}
