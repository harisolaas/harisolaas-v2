import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  return { title: dict.brote.failure.title };
}

export default async function BroteFailurePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const t = dict.brote.failure;

  return (
    <main
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-12 text-center"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 8%, #24352C 0%, #17211C 45%, #0E1512 100%)",
      }}
    >
      <div className="relative z-10 mx-auto max-w-md">
        <p className="text-6xl">😔</p>
        <h1 className="mt-6 font-serif text-4xl text-cream">{t.heading}</h1>
        <p className="mt-4 text-lg leading-relaxed text-cream/70">{t.body}</p>
        <a
          href={`/${locale}/brote`}
          className="mt-8 inline-block rounded-full bg-terracotta px-8 py-3 text-base font-semibold text-cream shadow-[0_0_30px_rgba(196,112,75,0.35)] transition-all hover:shadow-[0_0_45px_rgba(196,112,75,0.55)]"
        >
          {t.backLink}
        </a>
      </div>
    </main>
  );
}
