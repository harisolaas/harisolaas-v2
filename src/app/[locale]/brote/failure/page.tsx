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
      style={{ background: "#EAE3D2", color: "#3E5226" }}
    >
      <div className="relative z-10 mx-auto max-w-md">
        <p className="text-6xl">😔</p>
        <h1 className="mt-6 font-serif text-4xl text-[#3E5226]">{t.heading}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#5C6B45]">{t.body}</p>
        <a
          href={`/${locale}/brote`}
          className="mt-8 inline-block rounded-[2px] bg-[#3E5226] px-8 py-3 text-base font-semibold text-[#EAE3D2] transition-colors hover:bg-[#2E3D1C]"
        >
          {t.backLink}
        </a>
      </div>
    </main>
  );
}
