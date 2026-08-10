import { describe, expect, it, vi } from "vitest";
import { buildBroteEventJsonLd } from "./brote-jsonld";
import {
  BROTE_OG_IMAGE,
  broteConfig,
  eventEndsAt,
  eventStartsAt,
} from "@/data/brote";
import { getInvitation } from "./brote-invitations";

const DURING_EARLY_BIRD = new Date("2026-08-10T12:00:00-03:00");
const AFTER_EARLY_BIRD = new Date("2026-08-15T12:00:00-03:00");

const jsonLd = buildBroteEventJsonLd("es");

describe("event timestamps", () => {
  it("carries the Argentina offset explicitly", () => {
    // Without `-03:00` these are read as UTC and the event lands three hours
    // early in every calendar that ingests the markup. Same reasoning as
    // `earlyBirdEndsAt()`.
    expect(eventStartsAt()).toBe("2026-08-20T19:00:00-03:00");
    expect(eventEndsAt()).toBe("2026-08-20T22:30:00-03:00");
  });

  it("derives from the config rather than restating it", () => {
    expect(eventStartsAt()).toContain(broteConfig.eventDate);
    expect(eventStartsAt()).toContain(broteConfig.eventStartTime);
    expect(eventEndsAt()).toContain(broteConfig.eventEndTime);
  });

  it("agrees with the human-readable eventTime", () => {
    // `eventTime` ("19:00 a 22:30") is a second representation of the same
    // fact, and it is the one the flyer, the ticket email and the day-of
    // reminder render. Editing one and not the other publishes 19:00 to
    // Google while the mail says 20:00 — the same class of drift the U4 unit
    // is blocked on. Nothing tied them together, so this does.
    expect(broteConfig.eventTime).toContain(broteConfig.eventStartTime);
    expect(broteConfig.eventTime).toContain(broteConfig.eventEndTime);
  });

  it("ends after it starts", () => {
    expect(new Date(eventEndsAt()).getTime()).toBeGreaterThan(
      new Date(eventStartsAt()).getTime(),
    );
  });
});

describe("the Event node", () => {
  it("declares the fields Google needs for an event result", () => {
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.name).toBeTruthy();
    expect(jsonLd.description).toBeTruthy();
    expect(jsonLd.startDate).toBe(eventStartsAt());
    expect(jsonLd.endDate).toBe(eventEndsAt());
    expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(jsonLd.eventAttendanceMode).toBe(
      "https://schema.org/OfflineEventAttendanceMode",
    );
  });

  it("points image and url at absolute, www URLs", () => {
    // JSON-LD is not resolved against `metadataBase` the way Metadata is —
    // a relative URL here is simply wrong.
    expect(jsonLd.image[0]).toBe(
      `https://www.harisolaas.com/${BROTE_OG_IMAGE}`,
    );
    expect(jsonLd.url).toBe("https://www.harisolaas.com/es/brote");
  });

  it("locates the party at the venue the config names", () => {
    // Derivational, not a repeated literal: asserting "Costa Rica 5644" here
    // and hardcoding it in the builder means both move together only by
    // coincidence, and a venue change would publish the old address to Google
    // while every other surface showed the new one.
    expect(jsonLd.location["@type"]).toBe("Place");
    expect(broteConfig.locationAddress).toContain(
      jsonLd.location.address.streetAddress,
    );
    expect(broteConfig.locationAddress).toContain(
      jsonLd.location.address.addressLocality,
    );
    expect(jsonLd.location.name).toBe(jsonLd.location.address.streetAddress);
    expect(jsonLd.location.address.addressCountry).toBe("AR");
  });

  it("credits exactly the two line-up acts, with links back to them", () => {
    // Names come from the registry rather than being restated here: it is the
    // one source of collaborator identity, and hardcoding them would drift
    // from it the same way the landing's Instagram URL once did.
    const expected = ["jose", "gian"].map((s) => getInvitation(s)!.name);

    expect(jsonLd.performer.map((p) => p.name)).toEqual(expected);
    // Not all five collaborators — the brands sponsor, they don't perform.
    expect(jsonLd.performer).toHaveLength(2);

    for (const performer of jsonLd.performer) {
      expect(performer.sameAs).toContain("instagram.com");
    }
  });
});

describe("offers", () => {
  it("publishes both tiers rather than whichever is live at build time", () => {
    // `/[locale]/brote` is a static prerender. A single offer derived from
    // `currentTicketPrice()` freezes at build and would keep advertising the
    // preventa price after 13/8 — the "page says X, checkout charges Y" bug
    // the pricing helpers exist to prevent. The client-side `useEffect` that
    // corrects the visible price cannot correct server-rendered markup.
    expect(jsonLd.offers).toHaveLength(2);

    const prices = jsonLd.offers.map((o) => o.price);
    expect(prices).toContain(broteConfig.earlyBirdPriceRaw);
    expect(prices).toContain(broteConfig.ticketPriceRaw);
  });

  it("bounds the early bird by the configured deadline", () => {
    const early = jsonLd.offers.find(
      (o) => o.price === broteConfig.earlyBirdPriceRaw,
    )!;
    expect(early.priceValidUntil).toBe("2026-08-13T23:59:59-03:00");
    expect(early.priceValidUntil).toContain(broteConfig.earlyBirdDeadline);
  });

  it("starts the regular tier the day the preventa closes", () => {
    const regular = jsonLd.offers.find(
      (o) => o.price === broteConfig.ticketPriceRaw,
    )!;
    expect(regular.validFrom).toBe("2026-08-14T00:00:00-03:00");
  });

  it("prices everything in ARS and links to the ticket page", () => {
    for (const offer of jsonLd.offers) {
      expect(offer["@type"]).toBe("Offer");
      expect(offer.priceCurrency).toBe(broteConfig.currency);
      expect(offer.availability).toBe("https://schema.org/InStock");
      expect(offer.url).toBe(jsonLd.url);
    }
  });

  it("does not move when the clock crosses the deadline", () => {
    // The whole point of the two-offer shape: the markup is time-invariant,
    // so a build on either side of 13/8 emits the same bytes.
    //
    // The system clock is faked rather than a `now` argument passed, because
    // the regression to guard against is someone reaching for `new Date()` or
    // `currentTicketPrice()` *inside* the builder. A parameter the function
    // ignores would make this test pass no matter what it does internally.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(DURING_EARLY_BIRD);
      const before = JSON.stringify(buildBroteEventJsonLd("es"));

      vi.setSystemTime(AFTER_EARLY_BIRD);
      const after = JSON.stringify(buildBroteEventJsonLd("es"));

      expect(before).toBe(after);
      expect(before).toContain(String(broteConfig.earlyBirdPriceRaw));
      expect(after).toContain(String(broteConfig.ticketPriceRaw));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("locales", () => {
  it("uses the English copy and URL for /en", () => {
    const en = buildBroteEventJsonLd("en");
    expect(en.url).toBe("https://www.harisolaas.com/en/brote");
    expect(en.description).not.toBe(jsonLd.description);
  });
});
