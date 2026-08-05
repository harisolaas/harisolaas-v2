import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import MentoriaLanding from "@/components/MentoriaLanding";

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

  return <MentoriaLanding dict={dict.mentoria} locale={locale} />;
}
