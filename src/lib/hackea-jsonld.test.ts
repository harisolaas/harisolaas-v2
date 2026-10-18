import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildHackeaEventJsonLd } from "./hackea-jsonld";
import { HACKEA_OG_IMAGE, hackeaConfig } from "@/data/hackea";

const COPY = { name: "Hackeá tu mente", description: "Charla presencial." };
const BEFORE_START = new Date("2026-10-20T12:00:00-03:00");
const AFTER_START = new Date("2026-10-29T19:00:01-03:00");

const jsonLd = buildHackeaEventJsonLd(COPY, BEFORE_START);

describe("the Hackeá Event node", () => {
  it("declares the fields Google needs for an event result", () => {
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.name).toBe(COPY.name);
    expect(jsonLd.description).toBe(COPY.description);
    expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(jsonLd.eventAttendanceMode).toBe(
      "https://schema.org/OfflineEventAttendanceMode",
    );
    expect(jsonLd.url).toBe("https://www.harisolaas.com/es/hackea-tu-mente");
  });

  it("starts at the config's startIso, Argentina offset included", () => {
    expect(jsonLd.startDate).toBe(hackeaConfig.startIso);
    expect(jsonLd.startDate).toMatch(/-03:00$/);
  });

  it("ends at the config's endIso, after it starts", () => {
    expect(jsonLd.endDate).toBe(hackeaConfig.endIso);
    expect(jsonLd.endDate).toMatch(/-03:00$/);
    expect(Date.parse(jsonLd.endDate)).toBeGreaterThan(
      Date.parse(jsonLd.startDate),
    );
  });

  it("derives the venue from the config's address", () => {
    expect(jsonLd.location["@type"]).toBe("Place");
    expect(jsonLd.location.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Costa Rica 5644",
      addressLocality: "Palermo, Buenos Aires",
      addressRegion: "Ciudad Autónoma de Buenos Aires",
      addressCountry: "AR",
    });
    expect(hackeaConfig.exactAddress).toContain(jsonLd.location.name);
  });

  it("credits Hari as organizer and performer", () => {
    expect(jsonLd.organizer.name).toBe("Hari Solaas");
    expect(jsonLd.performer.name).toBe("Hari Solaas");
  });

  it("uses the share card as an absolute image URL that exists in /public", () => {
    expect(jsonLd.image).toEqual([
      `https://www.harisolaas.com/${HACKEA_OG_IMAGE}`,
    ]);
    const file = path.join(process.cwd(), "public", HACKEA_OG_IMAGE);
    expect(existsSync(file)).toBe(true);
    // 1200×630: the PNG IHDR holds width/height as big-endian u32 at 16/20.
    const header = readFileSync(file).subarray(0, 24);
    expect(header.readUInt32BE(16)).toBe(1200);
    expect(header.readUInt32BE(20)).toBe(630);
  });
});

describe("the offer", () => {
  it("charges what the checkout charges, in ARS", () => {
    expect(jsonLd.offers.price).toBe(hackeaConfig.ticketPriceCents / 100);
    expect(jsonLd.offers.price).toBe(21300);
    expect(jsonLd.offers.priceCurrency).toBe("ARS");
    expect(jsonLd.offers.url).toBe(jsonLd.url);
  });

  it("declares validFrom as the sales-open date, before the event", () => {
    expect(jsonLd.offers.validFrom).toBe(hackeaConfig.salesOpenIso);
    expect(jsonLd.offers.validFrom).toMatch(/-03:00$/);
    expect(Date.parse(jsonLd.offers.validFrom)).toBeLessThan(
      Date.parse(jsonLd.startDate),
    );
  });

  it("is InStock while sales are open", () => {
    expect(jsonLd.offers.availability).toBe("https://schema.org/InStock");
  });

  it("is SoldOut once sales close at startIso", () => {
    const closed = buildHackeaEventJsonLd(COPY, AFTER_START);
    expect(closed.offers.availability).toBe("https://schema.org/SoldOut");
  });
});
