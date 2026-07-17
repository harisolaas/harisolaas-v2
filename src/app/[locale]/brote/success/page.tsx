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
  return { title: dict.brote.success.title };
}

export default async function BroteSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const dict = await getDictionary(locale as Locale);
  const t = dict.brote.success;

  // Build WhatsApp link with context from MP redirect query params
  const paymentId = typeof query.payment_id === "string" ? query.payment_id : "";
  const whatsappText = encodeURIComponent(
    locale === "es"
      ? `Hola! Compré mi entrada para BROTE pero no me llegó el email con el QR.${paymentId ? ` Mi ID de pago es ${paymentId}.` : ""}`
      : `Hi! I bought my BROTE ticket but didn't get the email with the QR.${paymentId ? ` My payment ID is ${paymentId}.` : ""}`,
  );
  const whatsappUrl = `https://wa.me/5491122555110?text=${whatsappText}`;

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-[#FAF6F1] px-6 py-12 text-center">
      <div className="mx-auto max-w-md">
        <p className="text-6xl">🌳</p>
        <h1 className="mt-6 font-serif text-4xl text-[#2D4A3E]">{t.heading}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#2C2C2C]/70">
          {t.body}
        </p>

        <div className="mt-8 rounded-xl border border-[#A8B5A0]/20 bg-white/70 p-5">
          <p className="text-sm leading-relaxed text-[#2C2C2C]/60">
            {t.emailNote}
          </p>
        </div>

        <div className="mt-6">
          <p className="text-sm text-[#2C2C2C]/40">{t.noEmail}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/15 px-5 py-2.5 text-sm font-medium text-[#2D4A3E] transition-colors hover:bg-[#2D4A3E]/5"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t.whatsappCta}
          </a>
        </div>

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
