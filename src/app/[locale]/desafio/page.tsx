import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { loadDesafio } from "@/lib/desafio-server";

// Content comes from the DB and a day appears the moment it's published, so
// this page is rendered per request. Unpublished days reach the page as
// `{ dia, publicado: false }` only — `buildDesafioDays` strips their content.
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

export default async function DesafioPage() {
  // PLACEHOLDER: the design-driven UI (home / día / cierre, localStorage
  // progress) replaces this. `loadDesafio()` never throws.
  const { config, dias } = await loadDesafio();
  return (
    <main className="mx-auto max-w-[560px] px-[22px] py-16">
      <h1 className="font-serif text-4xl">{config.nombre}</h1>
      <p className="mt-4">{config.bienvenida}</p>
      <ol className="mt-8 space-y-1">
        {dias.map((d) => (
          <li key={d.dia}>
            Día {d.dia}
            {d.publicado ? ` · ${d.titulo}` : ""}
          </li>
        ))}
      </ol>
      <a
        className="mt-8 inline-block underline"
        href={config.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
    </main>
  );
}
