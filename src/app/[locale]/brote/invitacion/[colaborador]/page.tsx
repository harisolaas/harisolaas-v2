import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archivo, Instrument_Serif, Space_Mono } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { getInvitation } from "@/lib/brote-invitations";
import { BROTE_OG_IMAGE } from "@/data/brote";
import BroteInvitacion from "@/components/BroteInvitacion";

/**
 * Rendered per request, not prerendered.
 *
 * Without this the page is built once and cached with no revalidate, which
 * freezes the early-bird state at build time: a deploy before the 13th would
 * keep advertising the preventa price to the two artists' visitors for the
 * week between the deadline and the event, while the server charges the
 * regular one. That is the "page says X, checkout charges Y" failure the
 * U2/U4 split is meant to make impossible, and the split does not cover it —
 * it is render staleness, not ordering.
 */
export const dynamic = "force-dynamic";

// BROTE-scoped fonts, declared per page (the shared locale layout serves DM
// Serif / Source Sans). Skipping this is why the retired partner pages fell
// back to the wrong serif.
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
  params: Promise<{ locale: string; colaborador: string }>;
}): Promise<Metadata> {
  const { locale, colaborador } = await params;
  const invitation = getInvitation(colaborador);
  if (!invitation) return { title: "BROTE", robots: { index: false, follow: false } };

  const dict = await getDictionary(locale as Locale);
  const { meta } = dict.broteInvitacion;

  return {
    title: `${invitation.name} × ${meta.title}`,
    description: meta.description,
    // Not indexed and not in the sitemap: these links are handed out by the
    // collaborators, not found in search.
    robots: { index: false, follow: false },
    openGraph: {
      title: `${invitation.name} × BROTE`,
      description: meta.description,
      images: [
        {
          url: `/${BROTE_OG_IMAGE}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${invitation.name} × BROTE`,
      description: meta.description,
      images: [`/${BROTE_OG_IMAGE}`],
    },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌱</text></svg>",
    },
  };
}

export default async function BroteInvitacionPage({
  params,
}: {
  params: Promise<{ locale: string; colaborador: string }>;
}) {
  const { locale, colaborador } = await params;

  const invitation = getInvitation(colaborador);
  if (!invitation) notFound();

  const dict = await getDictionary(locale as Locale);

  return (
    <div
      className={`${archivo.variable} ${instrumentSerif.variable} ${spaceMono.variable}`}
    >
      <BroteInvitacion
        dict={dict.broteInvitacion}
        locale={locale}
        invitation={invitation}
      />
    </div>
  );
}
