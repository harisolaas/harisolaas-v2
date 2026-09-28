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

// The DB read under the page's loader. Mocked so this suite never needs a
// database, and so the fallback path (read throws) can be driven directly.
const getChallengeDayRows = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => getChallengeDayRows() }),
      }),
    }),
  },
  schema: { challengeDays: {}, events: {} },
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

describe("desafío page data", () => {
  beforeEach(() => {
    getChallengeDayRows.mockReset();
  });

  it("loadDesafio falls back to 15 unpublished days when the DB read throws", async () => {
    getChallengeDayRows.mockImplementation(async () => {
      throw new Error("db down");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadDesafio } = await import("@/lib/desafio-server");

    const { config, dias } = await loadDesafio();

    expect(config.whatsapp).toMatch(/^https:\/\/chat\.whatsapp\.com\//);
    expect(dias).toHaveLength(15);
    for (const d of dias) expect(d).toEqual({ dia: d.dia, publicado: false });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("loadDesafio only carries content for published days", async () => {
    getChallengeDayRows.mockResolvedValue([
      {
        dayNumber: 1,
        title: "Público",
        body: "ok",
        introVideoUrl: null,
        meditationTitle: "M",
        mediaUrl: "https://youtu.be/sq9Ug1hrqW4",
        durationLabel: "18 min",
        reflection: null,
        reflectionVideoUrl: null,
        published: true,
      },
      {
        dayNumber: 2,
        title: "Borrador",
        body: "no debería salir",
        introVideoUrl: null,
        meditationTitle: null,
        mediaUrl: null,
        durationLabel: null,
        reflection: null,
        reflectionVideoUrl: null,
        published: false,
      },
    ]);
    const { loadDesafio } = await import("@/lib/desafio-server");
    const { dias } = await loadDesafio();
    expect(dias[0]).toMatchObject({ dia: 1, publicado: true, titulo: "Público" });
    expect(dias[1]).toEqual({ dia: 2, publicado: false });
    expect(JSON.stringify(dias)).not.toContain("no debería salir");
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
