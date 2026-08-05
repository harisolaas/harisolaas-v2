import { describe, it, expect } from "vitest";
import es from "./es";
import en from "./en";

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
