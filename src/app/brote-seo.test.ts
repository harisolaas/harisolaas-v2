import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `next/font/google` ships a 0-byte stub in `node_modules` — the real loader is
 * a build-time SWC transform, so importing any page that calls `Archivo()`
 * throws `TypeError: Archivo is not a function` under vitest. The mock has to
 * live in this file: a setup module outside `src/` does not apply.
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

const CANONICAL_HOST = "https://www.harisolaas.com";

/**
 * Imported rather than restated, so bumping the share card is one edit and
 * not seven. The name itself is checked as a *property* below — asserting the
 * literal here would fail on every legitimate version bump while still not
 * catching the mutation that matters (pointing the constant at a different
 * card that happens to exist).
 */
const { BROTE_OG_IMAGE: OG_FILE } = await import("@/data/brote");

const locales = ["es", "en"] as const;

/** The pages take `params` as a promise, the way Next 16 hands them over. */
const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

/**
 * `Metadata["robots"]` is `null | string | Robots`. Both spellings de-index,
 * so a check that only understands the object form is blind to half of them.
 */
function isIndexable(robots: unknown): boolean {
  if (robots == null) return true;
  if (typeof robots === "string") return !robots.includes("noindex");
  return (robots as { index?: boolean }).index !== false;
}

describe("BROTE landing metadata", () => {
  it.each(locales)("declares itself canonical in %s", async (locale) => {
    const { generateMetadata } = await import("@/app/[locale]/brote/page");
    const md = await generateMetadata(params(locale));

    // The whole point: without this the page inherits `/${locale}` from the
    // locale layout and tells Google the homepage is its canonical URL.
    expect(md.alternates?.canonical).toBe(`/${locale}/brote`);
    expect(md.alternates?.languages).toMatchObject({
      es: "/es/brote",
      en: "/en/brote",
    });
  });

  it.each(locales)("points %s at the edition-2 OG card", async (locale) => {
    const { generateMetadata } = await import("@/app/[locale]/brote/page");
    const md = await generateMetadata(params(locale));

    const images = md.openGraph?.images as Array<{ url: string; alt?: string }>;
    expect(images?.[0]?.url).toContain(OG_FILE);
    // Relative, so `metadataBase` resolves it. A hardcoded absolute URL would
    // still "contain the filename" while pinning the host in two places — this
    // is the assertion that kills that mutation, not the one above.
    expect(images?.[0]?.url.startsWith("/")).toBe(true);
    expect(images?.[0]?.alt).toBeTruthy();

    const twitter = md.twitter?.images as string[];
    expect(twitter?.[0]?.startsWith("/")).toBe(true);
    expect(twitter?.[0]).toContain(OG_FILE);
  });

  it("is NOT noindex — the landing must stay discoverable", async () => {
    const { generateMetadata } = await import("@/app/[locale]/brote/page");
    const md = await generateMetadata(params("es"));

    // Over-restriction is the likelier harm here: a robots rule meant for the
    // gate/success pages that also swallows the landing would silently
    // de-index the event ten days before it happens.
    //
    // Checking `robots.index !== false` is NOT enough — `Metadata["robots"]`
    // also accepts a string, and `"noindex, nofollow"` has no `.index` at all,
    // so the naive assertion passes while the landing is de-indexed.
    expect(isIndexable(md.robots)).toBe(true);
  });

  it("has no ancestor layout that de-indexes the whole subtree", async () => {
    // The other half of the same trap, and the likelier shortcut: one
    // `[locale]/brote/layout.tsx` carrying `robots: { index: false }` to cover
    // gate+success+failure in a single file would also swallow the landing.
    // The page returns no `robots` of its own, so nothing above can be seen
    // from its metadata object — it has to be asserted structurally.
    expect(
      existsSync(resolve(process.cwd(), "src/app/[locale]/brote/layout.tsx")),
    ).toBe(false);

    const { generateMetadata } = await import("@/app/[locale]/layout");
    const layoutMd = await generateMetadata(params("es"));
    expect(isIndexable(layoutMd.robots)).toBe(true);
  });
});

describe("the OG asset itself", () => {
  it("names a BROTE card, not some other image that happens to exist", () => {
    // Without this, repointing the constant at `og-image.jpg` — the personal
    // site's card, which is a real file — passes every other assertion here:
    // the file exists and all four pages still agree with each other, while
    // BROTE shares render the wrong artwork. Asserted as a shape rather than
    // a literal so a v2→v3 bump stays a one-line change.
    expect(OG_FILE).toMatch(/^og-brote[\w.-]*\.(png|jpe?g)$/);
  });

  it("exists in public/ and is not empty", async () => {
    const { BROTE_OG_IMAGE } = await import("@/data/brote");
    const file = resolve(process.cwd(), "public", BROTE_OG_IMAGE);

    // Every other assertion in this file only proves the pages agree on a
    // *name*. Nothing tied that name to a file on disk — so bumping the
    // constant to `-v3` without committing the asset, or renaming the asset
    // without touching the constant, left the whole suite green while the
    // card 404'd and shares rendered with no image at all. Which is the one
    // visible outcome this change exists to produce.
    //
    // The doc comment on BROTE_OG_IMAGE tells the next person to bump the
    // filename on every artwork change, so this trap re-arms on every edit.
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(0);
  });
});

describe("locale layout metadata", () => {
  it("canonicalises on the www host that actually serves 200s", async () => {
    const { generateMetadata } = await import("@/app/[locale]/layout");
    const md = await generateMetadata(params("es"));

    // The apex 307-redirects to www, so every canonical built on it costs a
    // redirect hop. `metadataBase` is unreachable from the page's own returned
    // object — Next resolves it in `mergeMetadata` — so it is asserted here.
    expect(String(md.metadataBase)).toBe(`${CANONICAL_HOST}/`);
    expect(md.openGraph?.url).toBe(`${CANONICAL_HOST}/es`);
  });
});

describe("fb:app_id", () => {
  // Facebook's debugger reports it as a missing required property. It does not
  // change how the card renders — it ties shares to a Meta app for domain
  // insights — so it is emitted only when the env var is set. A placeholder
  // would be a claim about an app that isn't ours.
  const ENV_KEY = "NEXT_PUBLIC_FACEBOOK_APP_ID";

  afterEach(() => {
    delete process.env[ENV_KEY];
    vi.resetModules();
  });

  it("is emitted when the app id is configured", async () => {
    process.env[ENV_KEY] = "1234567890";
    vi.resetModules();

    const { generateMetadata } = await import("@/app/[locale]/layout");
    const md = await generateMetadata(params("es"));

    expect(md.other?.["fb:app_id"]).toBe("1234567890");
  });

  it("is absent — not empty — when it is not configured", async () => {
    delete process.env[ENV_KEY];
    vi.resetModules();

    const { generateMetadata } = await import("@/app/[locale]/layout");
    const md = await generateMetadata(params("es"));

    // `fb:app_id=""` would be worse than no tag: Facebook reads it as a
    // malformed id rather than an absent one.
    expect(md.other?.["fb:app_id"]).toBeUndefined();
  });
});

describe("post-payment pages", () => {
  const pages = [
    ["success", () => import("@/app/[locale]/brote/success/page")],
    ["failure", () => import("@/app/[locale]/brote/failure/page")],
  ] as const;

  it.each(pages)("%s is noindex", async (_name, load) => {
    const { generateMetadata } = await load();
    const md = await generateMetadata(params("es"));

    expect(md.robots).toMatchObject({ index: false, follow: false });
  });

  it.each(pages)("%s carries a complete openGraph block", async (_name, load) => {
    const { generateMetadata } = await load();
    const md = await generateMetadata(params("es"));

    // A child `openGraph` REPLACES the parent's rather than merging into it
    // (`resolve-metadata.js` assigns straight through), so a partial block
    // silently drops siteName/type/images inherited from the locale layout.
    expect(md.openGraph?.title).toBeTruthy();
    expect(md.openGraph?.description).toBeTruthy();
    expect(md.openGraph?.siteName).toBeTruthy();
    expect(md.openGraph?.type).toBeTruthy();

    const images = md.openGraph?.images as Array<{ url: string }>;
    expect(images?.[0]?.url).toContain(OG_FILE);
  });
});

describe("invitation pages", () => {
  it("stay noindex and use the edition-2 card", async () => {
    const { generateMetadata } = await import(
      "@/app/[locale]/brote/invitacion/[colaborador]/page"
    );
    const md = await generateMetadata({
      params: Promise.resolve({ locale: "es", colaborador: "matelab" }),
    });

    expect(md.robots).toMatchObject({ index: false, follow: false });
    const images = md.openGraph?.images as Array<{ url: string }>;
    expect(images?.[0]?.url).toContain(OG_FILE);
    expect(images?.[0]?.url.startsWith("/")).toBe(true);

    // Asserted symmetrically with openGraph: checking only one of the two let
    // `twitter.images` keep pointing at the `og-brote.jpg` this change
    // deletes — a hard 404 on X, across the five pages the collaborators are
    // handing out right now.
    const twitter = md.twitter?.images as string[];
    expect(twitter?.[0]).toContain(OG_FILE);
    expect(twitter?.[0]?.startsWith("/")).toBe(true);
  });

  it("carries a complete openGraph block", async () => {
    const { generateMetadata } = await import(
      "@/app/[locale]/brote/invitacion/[colaborador]/page"
    );
    const md = await generateMetadata({
      params: Promise.resolve({ locale: "es", colaborador: "matelab" }),
    });

    // Same rule as success/failure, and it matters most here: these are the
    // pages the five collaborators share from their own accounts, so a card
    // degraded to the personal-site defaults is the costliest place to have it.
    expect(md.openGraph?.siteName).toBeTruthy();
    expect(md.openGraph?.type).toBeTruthy();
    expect(md.openGraph?.locale).toBeTruthy();

    const images = md.openGraph?.images as Array<{ alt?: string }>;
    expect(images?.[0]?.alt).toBeTruthy();
  });
});

describe("sitemap", () => {
  it("lists both BROTE locales", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = sitemap().map((e) => e.url);

    expect(urls).toContain(`${CANONICAL_HOST}/es/brote`);
    expect(urls).toContain(`${CANONICAL_HOST}/en/brote`);
  });

  it("uses the www host for every entry", async () => {
    const { default: sitemap } = await import("@/app/sitemap");

    for (const entry of sitemap()) {
      expect(entry.url.startsWith(`${CANONICAL_HOST}/`)).toBe(true);
    }
  });

  it("gives the BROTE entries mutual hreflang alternates", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const es = sitemap().find((e) => e.url.endsWith("/es/brote"));

    expect(es?.alternates?.languages).toMatchObject({
      es: `${CANONICAL_HOST}/es/brote`,
      en: `${CANONICAL_HOST}/en/brote`,
    });
  });
});

describe("robots", () => {
  it("advertises the sitemap on the canonical host", async () => {
    const { default: robots } = await import("@/app/robots");

    expect(robots().sitemap).toBe(`${CANONICAL_HOST}/sitemap.xml`);
  });
});
