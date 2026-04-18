import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  buildDestinationUrl,
  deriveCampaignFromDestination,
  formatAutoLabel,
  generateSlug,
  isBotUserAgent,
  isChannelKey,
} from "./links";

describe("isChannelKey", () => {
  it("accepts valid keys", () => {
    expect(isChannelKey("ig-story")).toBe(true);
    expect(isChannelKey("email-campaign")).toBe(true);
  });
  it("rejects unknown keys", () => {
    expect(isChannelKey("whatever")).toBe(false);
    expect(isChannelKey(null)).toBe(false);
  });
});

describe("generateSlug", () => {
  it("follows {prefix}-{YYYYMMDD}-{nanoid} shape", () => {
    const s = generateSlug("ig-story", "2026-04-18");
    expect(s).toMatch(/^ig-story-20260418-[a-z2-9]{3}$/);
  });
  it("uses channel prefix overrides (wa-broadcast → wa-bc)", () => {
    const s = generateSlug("wa-broadcast", "2026-04-18");
    expect(s).toMatch(/^wa-bc-20260418-[a-z2-9]{3}$/);
  });
  it("uses email-dm prefix for email-personal", () => {
    const s = generateSlug("email-personal", "2026-04-18");
    expect(s).toMatch(/^email-dm-20260418-[a-z2-9]{3}$/);
  });
});

describe("formatAutoLabel", () => {
  it("produces Spanish month labels", () => {
    expect(formatAutoLabel("ig-story", "2026-04-18")).toBe(
      "IG Story · 18 abr 2026",
    );
    expect(formatAutoLabel("wa-group", "2026-01-03")).toBe(
      "WhatsApp grupo · 3 ene 2026",
    );
  });
});

describe("deriveCampaignFromDestination", () => {
  it("pulls the last path segment", () => {
    expect(deriveCampaignFromDestination("/es/plantacion")).toBe("plantacion");
    expect(deriveCampaignFromDestination("/es/sinergia")).toBe("sinergia");
  });
  it("returns 'home' for locale roots", () => {
    expect(deriveCampaignFromDestination("/es")).toBe("home");
    expect(deriveCampaignFromDestination("/en")).toBe("home");
  });
  it("handles fully-qualified URLs", () => {
    expect(
      deriveCampaignFromDestination("https://www.harisolaas.com/es/brote"),
    ).toBe("brote");
  });
});

describe("buildDestinationUrl", () => {
  it("appends UTMs to a relative path", () => {
    const url = buildDestinationUrl("/es/plantacion", {
      source: "instagram",
      medium: "story",
      campaign: "plant_launch",
      slug: "ig-story-20260418-a7x",
    });
    expect(url).toContain("/es/plantacion");
    expect(url).toContain("utm_source=instagram");
    expect(url).toContain("utm_medium=story");
    expect(url).toContain("utm_campaign=plant_launch");
    expect(url).toContain("utm_content=ig-story-20260418-a7x");
  });

  it("preserves pre-existing query strings on the destination", () => {
    const url = buildDestinationUrl("/es/brote?ref=legacy", {
      source: "email",
      medium: "campaign",
      campaign: "brote",
      slug: "email-20260418-k3m",
    });
    expect(url).toContain("ref=legacy");
    expect(url).toContain("utm_source=email");
  });

  it("handles absolute destination URLs", () => {
    const url = buildDestinationUrl("https://example.com/landing", {
      source: "partner",
      medium: "referral",
      campaign: "launch",
      slug: "partner-20260418-z00",
    });
    expect(url.startsWith("https://example.com/landing")).toBe(true);
    expect(url).toContain("utm_content=partner-20260418-z00");
  });
});

describe("isBotUserAgent", () => {
  it("flags common bots", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("WhatsApp/2.0")).toBe(true);
    expect(isBotUserAgent("curl/7.85.0")).toBe(true);
  });
  it("treats missing UA as bot", () => {
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });
  it("does not flag real browsers", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });
});

describe("CHANNELS map sanity", () => {
  it("every channel key maps to the correct utm source/medium", () => {
    expect(CHANNELS["ig-story"].source).toBe("instagram");
    expect(CHANNELS["ig-story"].medium).toBe("story");
    expect(CHANNELS["email-campaign"].source).toBe("email");
    expect(CHANNELS["email-campaign"].medium).toBe("campaign");
    expect(CHANNELS["wa-broadcast"].source).toBe("whatsapp");
    expect(CHANNELS["wa-broadcast"].medium).toBe("broadcast");
  });
});
