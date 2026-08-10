import { describe, expect, it } from "vitest";
import { broteConfig } from "@/data/brote";
import {
  INVITATION_SLUGS,
  getInvitation,
  instagramUrl,
  resolveInvitationPrice,
} from "./brote-invitations";

// The early-bird deadline is inclusive to the end of that day, Argentina time.
const DURING_EARLY_BIRD = new Date("2026-08-10T12:00:00-03:00");
const AFTER_EARLY_BIRD = new Date("2026-08-15T12:00:00-03:00");

describe("getInvitation", () => {
  it("resolves every collaborator slug", () => {
    for (const slug of INVITATION_SLUGS) {
      expect(getInvitation(slug)?.slug).toBe(slug);
    }
  });

  it("rejects anything that is not a known slug", () => {
    for (const bad of [undefined, "", "  ", "unknown", "../../etc/passwd"]) {
      expect(getInvitation(bad)).toBeNull();
    }
  });

  it("does not resolve inherited Object properties", () => {
    // A bare `RECORD[slug]` lookup answers `constructor`, `toString` and
    // friends with something truthy off Object.prototype. The price stays
    // public either way, but the caller gets an object that is not an
    // invitation and stamps "Invitación undefined" on the MercadoPago item.
    for (const key of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
    ]) {
      expect(getInvitation(key), key).toBeNull();
    }
  });

  it("does not accept a slug in the wrong case", () => {
    // The slug is a URL segment and a Redis-adjacent key, not free text.
    // Accepting case variants would mint a second identity for one partner.
    expect(getInvitation("Pulso")).toBeNull();
  });

  it("gives every collaborator a distinct tracked-link slug", () => {
    const slugs = INVITATION_SLUGS.map((s) => getInvitation(s)!.linkSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("resolveInvitationPrice — brands", () => {
  const pulso = getInvitation("pulso")!;

  it("prices a brand at 35% off the regular ticket", () => {
    const p = resolveInvitationPrice(pulso, DURING_EARLY_BIRD);
    expect(p.priceRaw).toBe(21450);
    expect(p.priceDisplay).toBe("$21.450");
    expect(p.compareAtDisplay).toBe("$33.000");
    expect(p.badge).toBe("discount");
  });

  it("derives the discount from config rather than a pasted literal", () => {
    // Fails the day someone changes the ticket price and leaves 21450 behind.
    const p = resolveInvitationPrice(pulso, DURING_EARLY_BIRD);
    expect(p.priceRaw).toBe(
      Math.round(broteConfig.ticketPriceRaw * (1 - pulso.discountPct / 100)),
    );
  });

  it("keeps the same price after the early-bird deadline passes", () => {
    // The 35% is off the REGULAR price, so it is a fixed number that must not
    // move on 14/8 — gating it behind isEarlyBird would silently raise it.
    const before = resolveInvitationPrice(pulso, DURING_EARLY_BIRD);
    const after = resolveInvitationPrice(pulso, AFTER_EARLY_BIRD);
    expect(after.priceRaw).toBe(before.priceRaw);
    expect(after.compareAtDisplay).toBe("$33.000");
    expect(after.badge).toBe("discount");
  });

  it("prices all three brands the same", () => {
    for (const slug of ["pulso", "matelab", "unarbol"] as const) {
      expect(
        resolveInvitationPrice(getInvitation(slug)!, DURING_EARLY_BIRD).priceRaw,
      ).toBe(21450);
    }
  });
});

describe("the returning-community invitation", () => {
  const comunidad = getInvitation("comunidad")!;

  it("discounts like a brand", () => {
    // It is not a collaborator, but the offer is identical: 35% off the
    // regular price, fixed across the early-bird deadline.
    const before = resolveInvitationPrice(comunidad, DURING_EARLY_BIRD);
    const after = resolveInvitationPrice(comunidad, AFTER_EARLY_BIRD);
    expect(before.priceRaw).toBe(21450);
    expect(after.priceRaw).toBe(21450);
    expect(before.badge).toBe("discount");
  });

  it("has no Instagram account to link to", () => {
    // Nobody is inviting anybody, so there is no handle and the chip is not
    // rendered. `instagramUrl` has to say so rather than build
    // "https://instagram.com/undefined".
    expect(comunidad.handle).toBeUndefined();
    expect(instagramUrl(comunidad)).toBeNull();
  });

  it("still resolves a handle for everyone who has one", () => {
    for (const slug of INVITATION_SLUGS) {
      const inv = getInvitation(slug)!;
      if (!inv.handle) continue;
      expect(instagramUrl(inv)).toBe(
        `https://instagram.com/${inv.handle.replace(/^@/, "")}`,
      );
    }
  });

  it("is not an artist, so it is never owed a fee", () => {
    expect(comunidad.kind).toBe("community");
  });
});

describe("resolveInvitationPrice — artists", () => {
  const jose = getInvitation("jose")!;

  it("charges the public early-bird price while the preventa runs", () => {
    const p = resolveInvitationPrice(jose, DURING_EARLY_BIRD);
    expect(p.priceRaw).toBe(broteConfig.earlyBirdPriceRaw);
    expect(p.priceDisplay).toBe("$24.750");
    expect(p.compareAtDisplay).toBe("$33.000");
    expect(p.badge).toBe("earlybird");
  });

  it("falls back to the regular price with no badge once it ends", () => {
    const p = resolveInvitationPrice(jose, AFTER_EARLY_BIRD);
    expect(p.priceRaw).toBe(broteConfig.ticketPriceRaw);
    expect(p.badge).toBeNull();
    expect(p.compareAtDisplay).toBeUndefined();
  });

  it("never discounts an artist", () => {
    for (const slug of ["jose", "gian"] as const) {
      const inv = getInvitation(slug)!;
      expect(inv.discountPct).toBe(0);
      expect(resolveInvitationPrice(inv, AFTER_EARLY_BIRD).priceRaw).toBe(
        broteConfig.ticketPriceRaw,
      );
    }
  });
});

describe("resolveInvitationPrice — no invitation", () => {
  it("falls back to the public price for a null invitation", () => {
    const p = resolveInvitationPrice(null, DURING_EARLY_BIRD);
    expect(p.priceRaw).toBe(broteConfig.earlyBirdPriceRaw);
    expect(p.badge).toBe("earlybird");
  });
});
