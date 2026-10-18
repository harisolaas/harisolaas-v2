import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import HackeaStatus, { HACKEA_WHATSAPP_HREF } from "@/components/hackea/HackeaStatus";
import { HACKEA_FORM_ANCHOR, buttonClass } from "@/components/hackea/ui";

// Spanish-only, like the landing (`/en/...` redirects here).
const LOCALE = "es";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(LOCALE);
  return {
    title: dict.hackea.failurePage.title,
    robots: { index: false, follow: false },
  };
}

export default async function HackeaFailurePage() {
  const dict = await getDictionary(LOCALE);
  const copy = dict.hackea.failurePage;

  return (
    <HackeaStatus
      eyebrowLead={copy.eyebrowLead}
      eyebrowRest={copy.eyebrowRest}
      heading={copy.heading}
    >
      <p>{copy.body}</p>
      <div className="htm-row">
        <Link
          href={`/${LOCALE}/hackea-tu-mente#${HACKEA_FORM_ANCHOR}`}
          className={buttonClass({ size: "sm" })}
        >
          {copy.retryCta}
        </Link>
        <a
          href={HACKEA_WHATSAPP_HREF}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {copy.whatsappCta}
        </a>
      </div>
    </HackeaStatus>
  );
}
