import {
  BROTE_OG_IMAGE,
  broteConfig,
  earlyBirdValidUntil,
  eventEndsAt,
  eventStartsAt,
  regularPriceValidFrom,
} from "@/data/brote";
import { getInvitation, instagramUrl } from "@/lib/brote-invitations";
import type { Locale } from "@/i18n/config";

const ORIGIN = "https://www.harisolaas.com";

/** The two line-up acts, credited from the collaborator registry. */
const PERFORMER_SLUGS = ["jose", "gian"] as const;

export interface BroteOffer {
  "@type": "Offer";
  price: number;
  priceCurrency: string;
  availability: string;
  url: string;
  priceValidUntil?: string;
  validFrom?: string;
}

export interface BroteEventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  eventStatus: string;
  eventAttendanceMode: string;
  url: string;
  image: string[];
  location: {
    "@type": "Place";
    name: string;
    address: {
      "@type": "PostalAddress";
      streetAddress: string;
      addressLocality: string;
      addressRegion: string;
      addressCountry: "AR";
    };
  };
  organizer: { "@type": "Organization"; name: string };
  performer: Array<{ "@type": "PerformingGroup"; name: string; sameAs?: string }>;
  offers: BroteOffer[];
}

const COPY = {
  es: {
    name: "BROTE — Fiesta de reforestación",
    description:
      "Una fiesta de reforestación en Palermo. Música en vivo, catering y DJ set. Cada entrada planta un árbol real en Argentina, a tu nombre.",
  },
  en: {
    name: "BROTE — Reforestation party",
    description:
      "A reforestation party in Palermo, Buenos Aires. Live music, catering and a DJ set. Every ticket plants a real tree in Argentina, in your name.",
  },
} as const;

/**
 * schema.org `Event` for the BROTE landing — what makes the page eligible for
 * Google's event rich results.
 *
 * **Both price tiers are always published.** `/[locale]/brote` is a static
 * prerender, so anything time-dependent a *server* component emits freezes at
 * build time. `BroteLanding` escapes that for the visible price with a
 * `useEffect` that re-reads `currentTicketPrice()` after hydration; markup in
 * `<head>` gets no such correction. A single offer derived from the current
 * price would therefore keep advertising the preventa after 13/8 — the exact
 * "the page says one number and the checkout charges another" failure the
 * pricing helpers exist to prevent.
 *
 * Emitting both, bounded by `priceValidUntil` / `validFrom`, is not a
 * workaround: it is the more truthful markup, and it is time-invariant, so the
 * build can happen on either side of the deadline.
 *
 * Deliberately takes no clock: having nothing to read the time from is a
 * stronger guarantee than being careful with it.
 */
export function buildBroteEventJsonLd(
  locale: Locale | string,
): BroteEventJsonLd {
  const copy = locale === "en" ? COPY.en : COPY.es;
  const url = `${ORIGIN}/${locale === "en" ? "en" : "es"}/brote`;

  const performer = PERFORMER_SLUGS.flatMap((slug) => {
    const invitation = getInvitation(slug);
    if (!invitation) return [];
    const sameAs = instagramUrl(invitation);
    return [
      {
        "@type": "PerformingGroup" as const,
        name: invitation.name,
        ...(sameAs ? { sameAs } : {}),
      },
    ];
  });

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: copy.name,
    description: copy.description,
    startDate: eventStartsAt(),
    endDate: eventEndsAt(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    // Absolute: JSON-LD is never resolved against `metadataBase`.
    image: [`${ORIGIN}/${BROTE_OG_IMAGE}`],
    location: {
      "@type": "Place",
      name: "Costa Rica 5644",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Costa Rica 5644",
        addressLocality: "Palermo Hollywood, CABA",
        addressRegion: "Ciudad Autónoma de Buenos Aires",
        addressCountry: "AR",
      },
    },
    organizer: { "@type": "Organization", name: "El Arte de Vivir" },
    performer,
    offers: [
      {
        "@type": "Offer",
        price: broteConfig.earlyBirdPriceRaw,
        priceCurrency: broteConfig.currency,
        availability: "https://schema.org/InStock",
        url,
        priceValidUntil: earlyBirdValidUntil(),
      },
      {
        "@type": "Offer",
        price: broteConfig.ticketPriceRaw,
        priceCurrency: broteConfig.currency,
        availability: "https://schema.org/InStock",
        url,
        validFrom: regularPriceValidFrom(),
      },
    ],
  };
}
