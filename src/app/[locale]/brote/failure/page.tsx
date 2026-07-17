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
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-[#FAF6F1] px-6 py-12 text-center">
      <div className="mx-auto max-w-md">
        <p className="text-6xl">😔</p>
        <h1 className="mt-6 font-serif text-4xl text-[#2D4A3E]">{t.heading}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#2C2C2C]/70">
          {t.body}
        </p>
        <a
          href={`/${locale}/brote`}
          className="mt-8 inline-block rounded-full bg-[#2D4A3E] px-8 py-3 text-base font-semibold text-[#FAF6F1] transition-colors hover:bg-[#2D4A3E]/90"
        >
          {t.backLink}
        </a>
      </div>
    </main>
  );
}
