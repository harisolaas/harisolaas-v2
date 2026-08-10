import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollaboratorName, InstagramChip } from "./BroteLanding";

/**
 * These render the two link primitives for real.
 *
 * Asserting on the helpers alone (`collaboratorNameUrl` / `instagramUrl`)
 * proves the URLs are correct but not that the components use the right one.
 * A chip wired to `collaboratorNameUrl` would point every brand at its
 * website and silently drop the Instagram surface — the whole reason the two
 * links exist side by side — with every other test still green.
 *
 * `renderToStaticMarkup` keeps this in the node environment: no jsdom, no
 * testing-library, no new dependency.
 */
const render = (
  Component: (props: { slug: string }) => React.ReactNode,
  slug: string,
) => renderToStaticMarkup(createElement(Component, { slug }));

describe("CollaboratorName", () => {
  it("links a brand to its own site, not its profile", () => {
    const html = render(CollaboratorName, "matelab");
    expect(html).toContain('href="https://matelabco.com/"');
    expect(html).not.toContain("instagram.com");
    expect(html).toContain("MateLab");
  });

  it("falls back to Instagram for a musician with no site", () => {
    const html = render(CollaboratorName, "jose");
    expect(html).toContain('href="https://instagram.com/josedezanzo"');
  });

  it("opens external links safely", () => {
    const html = render(CollaboratorName, "unarbol");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders plain text when there is nothing to link to", () => {
    // `comunidad` has no handle and no website.
    const html = render(CollaboratorName, "comunidad");
    expect(html).not.toContain("<a");
    expect(html).toContain("Comunidad BROTE");
  });
});

describe("InstagramChip", () => {
  it("always points at Instagram, even when the brand has a website", () => {
    const html = render(InstagramChip, "matelab");
    expect(html).toContain('href="https://instagram.com/matelab.co"');
    expect(html).not.toContain("matelabco.com");
    expect(html).toContain("@matelab.co");
  });

  it("uses the handle the registry holds for Gian", () => {
    // The dictionary used to carry `gianbejarano`; the registry says
    // `_gianbejarano`. The landing shipped the dead one.
    const html = render(InstagramChip, "gian");
    expect(html).toContain("_gianbejarano");
  });

  it("renders nothing for a collaborator with no account", () => {
    expect(render(InstagramChip, "comunidad")).toBe("");
  });
});
