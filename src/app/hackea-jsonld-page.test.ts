import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { HACKEA_OG_IMAGE } from "@/data/hackea";

/** `next/font/google` is a 0-byte stub outside the Next build. */
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "", className: "", style: {} });
  return {
    Orbitron: font,
    Lexend_Exa: font,
    Share_Tech_Mono: font,
    DM_Serif_Display: font,
    Source_Sans_3: font,
    JetBrains_Mono: font,
  };
});

/**
 * The sink: `hackea-jsonld.test.ts` proves the builder, this proves the page
 * actually renders it (and the share card reaches the metadata). Same walk as
 * `brote-jsonld-page.test.ts` — the async server component is awaited and its
 * element tree searched. No renderer, no DOM.
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

describe("the Hackeá page", () => {
  it("renders an Event node into the markup", async () => {
    const { default: HackeaPage } = await import(
      "@/app/[locale]/hackea-tu-mente/page"
    );
    const raw = findJsonLd(await HackeaPage());
    expect(raw, "no application/ld+json script rendered by the page").toBeTruthy();

    const node = JSON.parse(raw!);
    expect(node["@type"]).toBe("Event");
    expect(node.name).toBeTruthy();
    expect(node.description).toBeTruthy();
    expect(node.location?.["@type"]).toBe("Place");
    expect(node.offers?.price).toBeGreaterThan(0);
    // `<` is escaped so copy can never close the <script> tag early.
    expect(raw).not.toContain("<");
  });

  it("shares its own card, not the personal-site one", async () => {
    const { generateMetadata } = await import(
      "@/app/[locale]/hackea-tu-mente/page"
    );
    const meta = await generateMetadata();

    expect(meta.description).toBeTruthy();
    expect(meta.alternates?.canonical).toBe("/es/hackea-tu-mente");
    const og = meta.openGraph?.images as Array<{ url: string }>;
    expect(og[0].url).toBe(`/${HACKEA_OG_IMAGE}`);
    expect(meta.twitter?.images).toEqual([`/${HACKEA_OG_IMAGE}`]);
  });
});
