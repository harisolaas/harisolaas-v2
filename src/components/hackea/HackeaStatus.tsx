// Shell of the post-MercadoPago pages (/success, /failure): the landing's
// hero background with a centred column. Server component.
import type { ReactNode } from "react";
import { hackeaFontClassName } from "./fonts";
import { Eyebrow, GlitchText } from "./ui";
import "./hackea.css";

/** Same number the Sinergia landings use for questions. */
export const HACKEA_WHATSAPP_HREF = "https://wa.me/5491122555110";

export default function HackeaStatus({
  eyebrowLead,
  eyebrowRest,
  heading,
  children,
}: {
  eyebrowLead: string;
  eyebrowRest: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className={`hackea ${hackeaFontClassName}`}>
      <main className="htm-status htm-hero htm-grain">
        <div className="htm-hero__scan htm-scanlines" aria-hidden="true" />
        <div className="htm-status__inner">
          <Eyebrow lead={eyebrowLead}>{eyebrowRest}</Eyebrow>
          <GlitchText as="h1" fill="violet">
            {heading}
          </GlitchText>
          {children}
        </div>
      </main>
    </div>
  );
}
