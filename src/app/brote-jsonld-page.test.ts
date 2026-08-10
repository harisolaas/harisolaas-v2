import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

/** `next/font/google` is a 0-byte stub outside the Next build. */
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "", className: "", style: {} });
  return {
    Archivo: font,
    Instrument_Serif: font,
    Space_Mono: font,
    DM_Serif_Display: font,
    Source_Sans_3: font,
    JetBrains_Mono: font,
  };
});

/**
 * The sink.
 *
 * `brote-jsonld.test.ts` proves the builder returns the right object, but
 * nothing proved the object reaches the page: deleting the
 * `<script type="application/ld+json">` block from `page.tsx` left the whole
 * suite green while the landing shipped with no structured data at all —
 * which is precisely the outcome this unit exists to produce.
 *
 * The page is an async server component, so it is awaited and its returned
 * element tree walked. No renderer, no DOM.
 */
function findJsonLd(node: ReactNode): string | null {
  if (node === null || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findJsonLd(child);
      if (found) return found;
    }
    return null;
  }

  const element = node as ReactElement<Record<string, unknown>>;
  const props = element.props ?? {};

  if (
    element.type === "script" &&
    props.type === "application/ld+json" &&
    typeof props.dangerouslySetInnerHTML === "object"
  ) {
    const html = props.dangerouslySetInnerHTML as { __html?: string };
    return html.__html ?? null;
  }

  return findJsonLd(props.children as ReactNode);
}

async function jsonLdFor(locale: string) {
  const { default: BrotePage } = await import("@/app/[locale]/brote/page");
  const tree = await BrotePage({ params: Promise.resolve({ locale }) });
  const raw = findJsonLd(tree);
  expect(raw, "no application/ld+json script rendered by the page").toBeTruthy();
  return JSON.parse(raw!);
}

describe("the BROTE page emits its structured data", () => {
  it("renders an Event node into the markup", async () => {
    const node = await jsonLdFor("es");

    expect(node["@type"]).toBe("Event");
    expect(node.startDate).toBeTruthy();
    expect(node.location?.["@type"]).toBe("Place");
    expect(node.offers).toHaveLength(2);
  });

  it("uses the locale it was rendered for", async () => {
    const node = await jsonLdFor("en");
    expect(node.url).toBe("https://www.harisolaas.com/en/brote");
  });
});
