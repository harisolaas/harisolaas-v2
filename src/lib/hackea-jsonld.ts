import { HACKEA_OG_IMAGE, hackeaConfig } from "@/data/hackea";
import { isHackeaSalesOpen } from "@/lib/hackea-display";

const ORIGIN = "https://www.harisolaas.com";

export interface HackeaEventJsonLd {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description: string;
  startDate: string;
  eventStatus: string;
  eventAttendanceMode: string;
  inLanguage: "es";
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
  organizer: { "@type": "Person"; name: string; url: string };
  performer: { "@type": "Person"; name: string; url: string };
  offers: {
    "@type": "Offer";
    price: number;
    priceCurrency: string;
    availability: string;
    url: string;
  };
}

const HARI = { "@type": "Person" as const, name: "Hari Solaas", url: ORIGIN };

/**
 * schema.org `Event` for the Hackeá tu mente landing — what makes the page
 * eligible for Google's event rich results.
 *
 * Unlike BROTE's builder this one reads the clock (`now`): the landing is ISR
 * (`revalidate = 60`), not a build-time prerender, so the availability flips
 * to SoldOut within a minute of sales closing — the same `isHackeaSalesOpen`
 * rule that swaps the form for the closed card and makes the checkout 410.
 *
 * The exact address is public on the landing's hero, so it is published here
 * too. Name/description come from the page's dictionary so the copy lives in
 * one place.
 */
export function buildHackeaEventJsonLd(
  copy: { name: string; description: string },
  now: Date = new Date(),
): HackeaEventJsonLd {
  const url = `${ORIGIN}${hackeaConfig.landingPath}`;

  // "Costa Rica 5644, Palermo, Buenos Aires" → street / "Palermo, Buenos Aires".
  const [streetAddress, ...rest] = hackeaConfig.exactAddress
    .split(",")
    .map((part) => part.trim());
  const addressLocality = rest.join(", ");

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: copy.name,
    description: copy.description,
    startDate: hackeaConfig.startIso,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: "es",
    url,
    // Absolute: JSON-LD is never resolved against `metadataBase`.
    image: [`${ORIGIN}/${HACKEA_OG_IMAGE}`],
    location: {
      "@type": "Place",
      name: streetAddress,
      address: {
        "@type": "PostalAddress",
        streetAddress,
        addressLocality,
        addressRegion: "Ciudad Autónoma de Buenos Aires",
        addressCountry: "AR",
      },
    },
    organizer: HARI,
    performer: HARI,
    offers: {
      "@type": "Offer",
      // Derived from the cents the checkout charges, so the two can't drift.
      price: hackeaConfig.ticketPriceCents / 100,
      priceCurrency: hackeaConfig.currency,
      availability: isHackeaSalesOpen(now)
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      url,
    },
  };
}
