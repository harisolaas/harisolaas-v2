import { describe, it, expect } from "vitest";
import es from "./es";
import en from "./en";
import { fillTokens, pricingTokens } from "../data/brote";
import { getInvitation, instagramUrl } from "../lib/brote-invitations";

// Pure dictionary checks — no DB, no server imports. Guards the bug classes
// typecheck can't see: a locale dict linking into the other locale's routes,
// and content present in one language but missing in the other.

const dicts = [
  { locale: "es", dict: es },
  { locale: "en", dict: en },
] as const;

/** Collect every string value found anywhere inside a dictionary subtree. */
function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectStrings(value, out);
  }
  return out;
}

/** Internal app links: root-relative hrefs like "/es/sinergia". */
function internalHrefs(node: unknown): string[] {
  return collectStrings(node).filter((s) => /^\/[a-z]/.test(s));
}

/** Leaf paths -> string value, for structural comparison across locales. */
function leafPaths(
  node: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (typeof node === "string") {
    out[prefix] = node;
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => leafPaths(item, `${prefix}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      leafPaths(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

describe.each(dicts)("$locale dictionary — brote landing", ({ dict }) => {
  const brote = dict.brote;

  it("keeps the subtrees the other brote pages read", () => {
    // page.tsx reads meta; success/ and failure/ read their own subtrees.
    // The redesign restructures lineup/impact/pricing/includes only.
    expect(brote.meta.title.trim()).not.toBe("");
    expect(brote.success.heading.trim()).not.toBe("");
    expect(brote.failure.heading.trim()).not.toBe("");
  });

  it("has the three line-up blocks with their schedule slots", () => {
    const { timeRange, welcome, live, dj } = brote.lineup;
    expect(timeRange.trim()).not.toBe("");
    for (const block of [welcome, live, dj]) {
      expect(block.number).toMatch(/^0[123]$/);
      expect(block.time.trim()).not.toBe("");
      expect(block.title.trim()).not.toBe("");
    }
    expect([welcome.number, live.number, dj.number]).toEqual([
      "01",
      "02",
      "03",
    ]);
  });

  it("points the DJ link at a real Instagram profile", () => {
    // The URL no longer lives in the dictionary — it is derived from the
    // invitation registry via the slug, which is what stopped the landing and
    // the registry from drifting apart. The assertion follows it there.
    const gian = getInvitation(brote.lineup.dj.mention.slug);
    expect(gian).not.toBeNull();

    const url = new URL(instagramUrl(gian!)!);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toMatch(/(^|\.)instagram\.com$/);
    expect(url.pathname.replace(/\//g, "")).not.toBe("");
  });

  it("lists exactly three ticket inclusions plus the featured one", () => {
    expect(brote.includes.items).toHaveLength(3);
    brote.includes.items.forEach((item, i) => {
      expect(item.number).toBe(String(i + 1).padStart(2, "0"));
      expect(item.title.trim()).not.toBe("");

      // An item carries either plain copy or a collaborator mention, never
      // neither — the two that name Un Árbol and MateLab use `mention` so the
      // brand inside the sentence can be a link.
      const copy = item.mention
        ? `${item.mention.bodyBefore}${item.mention.bodyAfter}`
        : item.body;
      expect(copy?.trim()).not.toBe("");
      expect(copy).toBeDefined();
    });
    expect(brote.includes.featured.number).toBe("04");
    expect(brote.includes.featured.title.trim()).not.toBe("");
  });

  it("has no empty copy anywhere in the redesigned sections", () => {
    const sections = {
      lineup: brote.lineup,
      impact: brote.impact,
      pricing: brote.pricing,
      includes: brote.includes,
    };
    for (const [path, value] of Object.entries(leafPaths(sections))) {
      expect(value.trim(), `${path} must not be empty`).not.toBe("");
    }
  });

  // ── interpolation ────────────────────────────────────────────────────────
  // The null-implementation trap: if the component hardcodes "$8.250" instead
  // of calling earlyBirdSavings(), the token disappears from the dict and the
  // first assertion goes red. If the dict carries a token nothing fills, a
  // literal "{savings}" renders on a live payment block — second assertion.

  it("declares the tokens the pricing copy expects to be filled", () => {
    expect(brote.pricing.savingsLine).toContain("{savings}");
    expect(brote.pricing.generalNote).toContain("{price}");
  });

  it("leaves no unfilled token once the known values are applied", () => {
    const values = pricingTokens();
    for (const [path, value] of Object.entries(leafPaths(brote.pricing))) {
      expect(
        fillTokens(value, values),
        `${path} still has an unfilled {token}`,
      ).not.toMatch(/\{\w+\}/);
    }
  });
});

// Paths that are identical across locales by design: block numbers, the
// artist's handle/URL, the discount badge, and "DJ set" — the same term in
// both languages. Everything else is copy and must actually differ, or it was
// never translated. Adding a key forces a decision here, which is the point:
// this list is an inventory of deliberate exceptions, not a filter.
//
// `lineup.timeRange` is deliberately NOT here: ES runs on a 24h clock and EN
// on a 12h one, matching each locale's infoBar.
const UNTRANSLATED_BY_DESIGN = [
  /\.number$/,
  // A collaborator's slug is a lookup key into the invitation registry, not
  // copy — identical in both locales by definition. It replaced
  // `lineup.dj.link.*`, which was the same exemption for the same reason back
  // when the dictionary carried the handle and URL itself.
  /\.slug$/,
  /^lineup\.dj\.title$/,
  /^pricing\.earlyBirdBadge$/,
];

describe("brote landing — EN is a translation, not a copy of ES", () => {
  // A grep for Spanish words would be the `rename` archetype: reword the copy
  // and the grep passes while the text stays Spanish. Field-wise inequality
  // cannot be defeated that way, because rewording into English *is* the fix.
  const pick = (d: typeof es) => ({
    lineup: d.brote.lineup,
    impact: d.brote.impact,
    pricing: d.brote.pricing,
    includes: d.brote.includes,
  });

  const esLeaves = leafPaths(pick(es));
  const enLeaves = leafPaths(pick(en));

  it("has the same shape in both locales", () => {
    expect(Object.keys(enLeaves).sort()).toEqual(Object.keys(esLeaves).sort());
  });

  it("translates every copy field", () => {
    const untranslated = Object.keys(esLeaves).filter(
      (path) =>
        !UNTRANSLATED_BY_DESIGN.some((re) => re.test(path)) &&
        esLeaves[path] === enLeaves[path],
    );
    expect(
      untranslated,
      `these brote fields are byte-identical in es.ts and en.ts`,
    ).toEqual([]);
  });
});

describe.each(dicts)("$locale dictionary — mentoria", ({ locale, dict }) => {
  it("has the mentoria section with non-empty core copy", () => {
    const mentoria = (dict as Record<string, unknown>).mentoria as
      | Record<string, unknown>
      | undefined;
    expect(mentoria, "mentoria dict section must exist").toBeDefined();
    const strings = collectStrings(mentoria);
    expect(strings.length).toBeGreaterThan(10);
    for (const s of strings) {
      expect(s.trim(), "no empty copy strings in mentoria").not.toBe("");
    }
  });

  it("only links into its own locale's routes", () => {
    const sections = {
      mentoria: (dict as Record<string, unknown>).mentoria,
      now: dict.now,
    };
    const hrefs = internalHrefs(sections);
    for (const href of hrefs) {
      expect(
        href === `/${locale}` || href.startsWith(`/${locale}/`),
        `internal href ${href} must be under /${locale}`
      ).toBe(true);
    }
  });

  it("has a landing Now card linking to the mentoria page", () => {
    const card = dict.now.items.find(
      (item) => item.cta?.href === `/${locale}/mentoria`
    );
    expect(
      card,
      `now.items must contain a card whose CTA is /${locale}/mentoria`
    ).toBeDefined();
    expect(card!.title.trim()).not.toBe("");
    expect(card!.description.trim()).not.toBe("");
    expect(card!.cta!.label.trim()).not.toBe("");
  });

  it("uses the site WhatsApp number for the mentoria CTA", () => {
    const mentoria = (dict as Record<string, unknown>).mentoria;
    const waLinks = collectStrings(mentoria).filter((s) =>
      s.startsWith("https://wa.me/")
    );
    expect(waLinks.length, "mentoria must expose a wa.me CTA").toBeGreaterThan(
      0
    );
    for (const link of waLinks) {
      const url = new URL(link);
      expect(url.pathname).toBe("/5491122555110");
      expect(
        url.searchParams.get("text"),
        "wa.me CTA must carry a prefilled text"
      ).toBeTruthy();
    }
  });
});
