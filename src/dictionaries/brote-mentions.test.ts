import { describe, expect, it } from "vitest";
import es from "./es";
import en from "./en";
import type { BroteCollaboratorMention, BroteDict } from "./types";
import {
  brandInvitations,
  collaboratorNameUrl,
  getInvitation,
  instagramUrl,
} from "@/lib/brote-invitations";

/**
 * Every place the landing names a collaborator inline. Collected by walking
 * the dictionary rather than by listing paths by hand, so a mention added in
 * a new section is covered the day it lands instead of the day someone
 * remembers to extend this list.
 */
function mentions(dict: BroteDict): Array<[string, BroteCollaboratorMention]> {
  const found: Array<[string, BroteCollaboratorMention]> = [];

  const walk = (node: unknown, path: string) => {
    if (node === null || typeof node !== "object") return;

    const candidate = node as Partial<BroteCollaboratorMention>;
    if (
      typeof candidate.slug === "string" &&
      typeof candidate.bodyBefore === "string" &&
      typeof candidate.bodyAfter === "string"
    ) {
      found.push([path, node as BroteCollaboratorMention]);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      walk(value, path ? `${path}.${key}` : key);
    }
  };

  walk(dict, "");
  return found;
}

const esMentions = mentions(es.brote);
const enMentions = mentions(en.brote);

describe("collaborator mentions on the BROTE landing", () => {
  it("finds mentions at all (guards the walker itself)", () => {
    // Without this, a walker that silently matched nothing would make every
    // other assertion in this file vacuously true.
    expect(esMentions.length).toBeGreaterThanOrEqual(5);
  });

  it("every slug resolves to a real collaborator", () => {
    // This is the assertion that makes the Gian class of drift impossible.
    // The landing used to carry its own copy of his Instagram URL, which had
    // gone stale against the registry (`gianbejarano` vs `_gianbejarano`) —
    // a dead link on a live page. Identity now has exactly one home.
    for (const [path, mention] of [...esMentions, ...enMentions]) {
      expect(getInvitation(mention.slug), `${path} → ${mention.slug}`).not.toBeNull();
    }
  });

  it("names the same collaborators in the same order in both locales", () => {
    expect(enMentions.map(([path]) => path)).toEqual(
      esMentions.map(([path]) => path),
    );
    expect(enMentions.map(([, m]) => m.slug)).toEqual(
      esMentions.map(([, m]) => m.slug),
    );
  });

  it("never leaves a mention with nothing around it", () => {
    // `bodyBefore` empty would render the name flush against the previous
    // sentence; the dictionary suite's no-empty-copy rule covers lineup and
    // includes, but not footer or community, so it is pinned here too.
    for (const [path, mention] of [...esMentions, ...enMentions]) {
      expect(
        `${mention.bodyBefore}${mention.bodyAfter}`.trim(),
        `${path} has no surrounding copy`,
      ).not.toBe("");
    }
  });
});

describe("where a mention points", () => {
  it("sends Gian to the handle the registry actually holds", () => {
    const gian = getInvitation("gian")!;
    expect(instagramUrl(gian)).toContain("_gianbejarano");
  });

  it("prefers a website for the name and keeps Instagram for the chip", () => {
    const matelab = getInvitation("matelab")!;
    expect(collaboratorNameUrl(matelab)).toBe("https://matelabco.com/");
    expect(instagramUrl(matelab)).toContain("instagram.com");

    const unarbol = getInvitation("unarbol")!;
    expect(collaboratorNameUrl(unarbol)).toBe("https://unarbol.org/");
  });

  it("falls back to Instagram when there is no website", () => {
    const jose = getInvitation("jose")!;
    expect(collaboratorNameUrl(jose)).toBe(instagramUrl(jose));
    expect(collaboratorNameUrl(jose)).toContain("josedezanzo");
  });

  it("returns null when a collaborator has neither", () => {
    // `comunidad` is the returning-audience page: no account, nobody to link.
    const comunidad = getInvitation("comunidad")!;
    expect(comunidad.handle).toBeUndefined();
    expect(collaboratorNameUrl(comunidad)).toBeNull();
  });
});

describe("brandInvitations", () => {
  it("returns exactly the brands, not the artists or the community page", () => {
    expect(brandInvitations().map((i) => i.slug)).toEqual([
      "pulso",
      "matelab",
      "unarbol",
    ]);
  });

  it("selects on kind, not on the discount that happens to match today", () => {
    // Filtering `discountPct > 0` is indistinguishable from filtering
    // `kind === "brand"` against the current data — and wrong the moment a
    // brand goes to 0% or a community page keeps its 35%. `comunidad`
    // already discounts 35% and must still be excluded.
    const comunidad = getInvitation("comunidad")!;
    expect(comunidad.discountPct).toBeGreaterThan(0);
    expect(brandInvitations().map((i) => i.slug)).not.toContain("comunidad");

    for (const brand of brandInvitations()) {
      expect(brand.kind).toBe("brand");
    }
  });
});
