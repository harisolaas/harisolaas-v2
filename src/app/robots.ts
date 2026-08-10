import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    // www — the apex 307-redirects, and a redirecting sitemap URL is one more
    // hop between a crawler and the only page that needs indexing this month.
    //
    // Deliberately no `Disallow` for /brote/gate or /brote/flyer: a disallowed
    // path is never fetched, so its `noindex` is never read, and it can still
    // be indexed URL-only from inbound links — and the gate *is* linked, from
    // every buyer's ticket email. Those two carry `noindex` layouts instead.
    sitemap: "https://www.harisolaas.com/sitemap.xml",
  };
}
