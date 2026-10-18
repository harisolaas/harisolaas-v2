import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { hackeaDisplay } from "@/lib/hackea-display";
import HackeaStatus, { HACKEA_WHATSAPP_HREF } from "@/components/hackea/HackeaStatus";
import { buttonClass } from "@/components/hackea/ui";

// Spanish-only, like the landing (`/en/...` redirects here).
const LOCALE = "es";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(LOCALE);
  return {
    title: dict.hackea.successPage.title,
    robots: { index: false, follow: false },
  };
}

/**
 * MP's back_url. `?state=pending` (cash / slow methods) swaps the copy: the
 * participation is already a lead in the CRM, the webhook confirms it later.
 */
export default async function HackeaSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const [dict, { state }] = await Promise.all([getDictionary(LOCALE), searchParams]);
  const copy = dict.hackea.successPage;
  const pending = state === "pending";
  const d = hackeaDisplay();

  return (
    <HackeaStatus
      eyebrowLead={pending ? copy.pendingEyebrowLead : copy.eyebrowLead}
      eyebrowRest={pending ? copy.pendingEyebrowRest : copy.eyebrowRest}
      heading={pending ? copy.pendingHeading : copy.heading}
    >
      <p>{pending ? copy.pendingBody : copy.body}</p>
      <div className="htm-datestamp">
        <span className="htm-datestamp__date">{d.stamp}</span>
        <span className="htm-datestamp__time">/ {d.stampTime}</span>
      </div>
      <p>{d.placeFull}</p>
      <p className="htm-status__small">{copy.emailNote}</p>
      <div className="htm-row">
        <a href={HACKEA_WHATSAPP_HREF} className={buttonClass({ size: "sm" })}>
          {copy.whatsappCta}
        </a>
        <Link
          href={`/${LOCALE}/hackea-tu-mente`}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {copy.backLink}
        </Link>
      </div>
    </HackeaStatus>
  );
}
