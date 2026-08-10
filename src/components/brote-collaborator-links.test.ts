import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BroteLanding, { CollaboratorName, InstagramChip } from "./BroteLanding";
import es from "@/dictionaries/es";
import type { BroteCollaboratorMention } from "@/dictionaries/types";
import {
  brandInvitations,
  collaboratorNameUrl,
  getInvitation,
  instagramUrl,
} from "@/lib/brote-invitations";

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

/* ─────────────────────────────────────────────────────────────────────────────
 * The sink.
 *
 * Everything above tests the two primitives in isolation, and
 * `brote-mentions.test.ts` tests the data. Neither reaches the place where the
 * landing actually calls them — so reverting the includes grid to `{item.body}`
 * or the sponsors row to `{brand.name}` drops real links from the page with the
 * whole suite still green. `brandInvitations()` can return the right three
 * brands and the landing render none of them.
 *
 * `renderToStaticMarkup` runs the real landing with no mocks and no jsdom, so
 * the grep-over-built-HTML that proved this by hand now lives in the repo.
 * ---------------------------------------------------------------------------- */

const landingHtml = renderToStaticMarkup(
  createElement(BroteLanding, { dict: es.brote, locale: "es" }),
);

/** React escapes non-ASCII as numeric entities; compare against decoded text. */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const decodedLanding = decodeEntities(landingHtml);

/** Same duck-typed walk as `brote-mentions.test.ts`, over the ES landing. */
function mentionObjects(
  node: unknown,
  acc: BroteCollaboratorMention[] = [],
): BroteCollaboratorMention[] {
  if (node === null || typeof node !== "object") return acc;
  const m = node as Partial<BroteCollaboratorMention>;
  if (
    typeof m.slug === "string" &&
    typeof m.bodyBefore === "string" &&
    typeof m.bodyAfter === "string"
  ) {
    acc.push(m as BroteCollaboratorMention);
    return acc;
  }
  for (const value of Object.values(node)) mentionObjects(value, acc);
  return acc;
}

describe("the rendered BROTE landing", () => {
  it("renders at all (guards every assertion below)", () => {
    expect(landingHtml.length).toBeGreaterThan(10_000);
  });

  it("links every collaborator it mentions, and every backing brand", () => {
    // Derived from the registry and the dictionary rather than hand-listed, so
    // adding a collaborator extends this coverage automatically.
    const slugs = new Set([
      ...mentionObjects(es.brote).map((m) => m.slug),
      ...brandInvitations().map((b) => b.slug),
    ]);
    expect(slugs.size).toBeGreaterThanOrEqual(5);

    for (const slug of slugs) {
      const invitation = getInvitation(slug)!;

      const nameUrl = collaboratorNameUrl(invitation);
      expect(nameUrl, `${slug} has no name URL`).not.toBeNull();
      expect(landingHtml, `${slug}: name not linked on the landing`).toContain(
        `href="${nameUrl}"`,
      );

      // Each of them also carries an @handle chip somewhere on the page — the
      // two musicians in the line-up, the three brands in the sponsors row.
      const ig = instagramUrl(invitation);
      expect(ig, `${slug} has no Instagram URL`).not.toBeNull();
      expect(landingHtml, `${slug}: Instagram chip missing`).toContain(
        `href="${ig}"`,
      );
    }
  });

  it("keeps the copy around each mention on the page", () => {
    // Reverting an item to `{item.body}` after the copy moved into `mention`
    // renders `undefined` — the sentence vanishes silently rather than erroring.
    for (const mention of mentionObjects(es.brote)) {
      for (const fragment of [mention.bodyBefore, mention.bodyAfter]) {
        const text = fragment.trim();
        if (text === "") continue;
        expect(decodedLanding, `missing copy: "${text}"`).toContain(text);
      }
    }
  });

  it("never renders a dead or empty href", () => {
    expect(landingHtml).not.toContain('href="undefined"');
    expect(landingHtml).not.toContain('href="null"');
    // The handle the registry replaced. It shipped live as a dead link.
    expect(landingHtml).not.toContain(
      'href="https://instagram.com/gianbejarano"',
    );
  });
});
