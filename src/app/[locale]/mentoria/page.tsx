import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import MentoriaLanding from "@/components/MentoriaLanding";

/**
 * Lora is loaded here rather than in the shared [locale] layout so it only
 * ships on this route. The design leans on the roman/italic contrast to keep
 * the mentee's voice and Hari's voice visually distinct — DM Serif Display,
 * the site serif, has no italic to make that distinction with.
 */
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-lora",
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
    title: dict.mentoria.meta.title,
    description: dict.mentoria.meta.description,
    openGraph: {
      title: dict.mentoria.meta.title,
      description: dict.mentoria.meta.ogDescription,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.mentoria.meta.title,
      description: dict.mentoria.meta.ogDescription,
      images: ["/og-image.jpg"],
    },
  };
}

export default async function MentoriaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return (
    <MentoriaLanding
      dict={dict.mentoria}
      locale={locale}
      fontClassName={lora.variable}
    />
  );
}
