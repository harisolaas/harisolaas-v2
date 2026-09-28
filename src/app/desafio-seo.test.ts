import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `next/font/google` ships a 0-byte stub — the real loader is a build-time
 * SWC transform — so importing the locale layout throws under vitest without
 * this. Same mock as `brote-seo.test.ts`; it has to live in this file.
 */
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

// The page's DB loader. Mocked so this suite never needs a database, and so
// the fallback path (loader throws) can be driven directly.
const loadPublicDesafioDays = vi.fn();
vi.mock("@/lib/desafio-server", () => ({
  loadPublicDesafioDays: (...args: unknown[]) => loadPublicDesafioDays(...args),
}));

const CANONICAL_HOST = "https://www.harisolaas.com";
const locales = ["es", "en"] as const;
const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

/** `Metadata["robots"]` is `null | string | Robots`; both spellings de-index. */
function isIndexable(robots: unknown): boolean {
  if (robots == null) return true;
  if (typeof robots === "string") return !robots.includes("noindex");
  return (robots as { index?: boolean }).index !== false;
}

describe("desafío landing metadata", () => {
  it.each(locales)("declares itself canonical in %s", async (locale) => {
    const { generateMetadata } = await import("@/app/[locale]/desafio/page");
    const md = await generateMetadata(params(locale));

    // Without it the page inherits `/${locale}` from the locale layout and
    // tells search engines the homepage is its canonical URL.
    expect(md.alternates?.canonical).toBe(`/${locale}/desafio`);
    expect(md.alternates?.languages).toMatchObject({
      es: "/es/desafio",
      en: "/en/desafio",
    });
  });

  it.each(locales)("is indexable in %s", async (locale) => {
    const { generateMetadata } = await import("@/app/[locale]/desafio/page");
    const md = await generateMetadata(params(locale));
    expect(isIndexable(md.robots)).toBe(true);
  });

  it("has no ancestor layout that de-indexes the subtree", () => {
    expect(
      existsSync(resolve(process.cwd(), "src/app/[locale]/desafio/layout.tsx")),
    ).toBe(false);
  });

  it.each(locales)("carries a complete openGraph block in %s", async (locale) => {
    const { generateMetadata } = await import("@/app/[locale]/desafio/page");
    const md = await generateMetadata(params(locale));

    // A child openGraph REPLACES the layout's rather than merging, so a
    // partial block would drop siteName/type/images.
    expect(md.openGraph?.title).toBeTruthy();
    expect(md.openGraph?.description).toBeTruthy();
    expect(md.openGraph?.siteName).toBeTruthy();
    expect(md.openGraph?.type).toBeTruthy();
    expect(md.openGraph?.url).toBe(`/${locale}/desafio`);
    const images = md.openGraph?.images as Array<{ url: string }>;
    expect(images?.[0]?.url.startsWith("/")).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public", images[0].url.slice(1)))).toBe(true);
  });
});

describe("desafío page render", () => {
  beforeEach(() => {
    loadPublicDesafioDays.mockReset();
  });

  it("falls back to the date-only path when the DB loader throws", async () => {
    loadPublicDesafioDays.mockImplementation(async () => {
      throw new Error("db down");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: DesafioPage } = await import("@/app/[locale]/desafio/page");

    const el = (await DesafioPage(params("es"))) as {
      props: { days: Array<{ state: string; title?: string }> };
    };

    expect(el.props.days).toHaveLength(15);
    for (const d of el.props.days) {
      expect(d.state).not.toBe("open");
      expect(d.title).toBeUndefined();
    }
    errSpy.mockRestore();
  });
});

describe("sitemap", () => {
  it("lists both desafío locales with mutual hreflang alternates", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${CANONICAL_HOST}/es/desafio`);
    expect(urls).toContain(`${CANONICAL_HOST}/en/desafio`);

    const es = entries.find((e) => e.url.endsWith("/es/desafio"));
    expect(es?.alternates?.languages).toMatchObject({
      es: `${CANONICAL_HOST}/es/desafio`,
      en: `${CANONICAL_HOST}/en/desafio`,
    });
  });
});
