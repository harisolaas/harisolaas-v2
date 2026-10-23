// Shell of the post-MercadoPago pages (/success, /failure): the landing's
// hero background with a centred column. Server component.
import type { ReactNode } from "react";
import MetaPixel from "@/components/MetaPixel";
import { hackeaFontClassName } from "./fonts";
import { Eyebrow, GlitchText } from "./ui";
import "./hackea.css";

export { HACKEA_WHATSAPP_HREF } from "./ui";

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
      <MetaPixel />
    </div>
  );
}
