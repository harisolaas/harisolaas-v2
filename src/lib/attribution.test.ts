import { describe, expect, it } from "vitest";
import {
  buildAttribution,
  readBrowserAttribution,
  readCookie,
} from "./attribution";

function makeReq(init: {
  cookie?: string;
  referer?: string;
}): Request {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.referer) headers.set("referer", init.referer);
  return new Request("https://www.harisolaas.com/api/test", { headers });
}

describe("readCookie", () => {
  it("reads a single cookie value", () => {
    const req = makeReq({ cookie: "haris_link=abc123" });
    expect(readCookie(req, "haris_link")).toBe("abc123");
  });

  it("returns undefined when the cookie is missing", () => {
    const req = makeReq({ cookie: "other=x" });
    expect(readCookie(req, "haris_link")).toBeUndefined();
  });

  it("decodes url-encoded values", () => {
    const req = makeReq({ cookie: "haris_link=ig-story-20260418-a1b" });
    expect(readCookie(req, "haris_link")).toBe("ig-story-20260418-a1b");
  });

  it("returns undefined when no cookie header is present", () => {
    const req = makeReq({});
    expect(readCookie(req, "haris_link")).toBeUndefined();
  });
});

describe("buildAttribution", () => {
  it("returns undefined when there is nothing to record", () => {
    const req = makeReq({});
    expect(buildAttribution({ req })).toBeUndefined();
  });

  it("prefers URL-provided utm fields over cookie", () => {
    const req = makeReq({ cookie: "haris_link=cookie-slug" });
    const att = buildAttribution({
      req,
      body: {
        utm: {
          source: "instagram",
          medium: "story",
          campaign: "plant_launch",
        },
        linkSlug: "body-slug",
      },
    });
    expect(att).toBeDefined();
    expect(att?.linkSlug).toBe("body-slug");
    expect(att?.source).toBe("instagram");
    expect(att?.medium).toBe("story");
    expect(att?.campaign).toBe("plant_launch");
  });

  it("falls back to utm_content when body.linkSlug is absent", () => {
    const req = makeReq({});
    const att = buildAttribution({
      req,
      body: {
        utm: { content: "url-slug" },
      },
    });
    expect(att?.linkSlug).toBe("url-slug");
  });

  it("falls back to cookie when neither body.linkSlug nor utm_content is set", () => {
    const req = makeReq({ cookie: "haris_link=cookie-slug" });
    const att = buildAttribution({ req });
    expect(att?.linkSlug).toBe("cookie-slug");
  });

  it("captures referrer from headers", () => {
    const req = makeReq({ referer: "https://instagram.com/harisolaas" });
    const att = buildAttribution({ req });
    expect(att?.referrer).toBe("https://instagram.com/harisolaas");
  });

  it("ignores empty-string utm values", () => {
    const req = makeReq({});
    const att = buildAttribution({
      req,
      body: { utm: { source: "", medium: "  ", campaign: "real" } },
    });
    expect(att?.source).toBeUndefined();
    expect(att?.medium).toBeUndefined();
    expect(att?.campaign).toBe("real");
  });
});

describe("readBrowserAttribution", () => {
  it("reads all four UTMs off the query string", () => {
    const { utm, linkSlug } = readBrowserAttribution(
      "?utm_source=instagram&utm_medium=story&utm_campaign=brote&utm_content=ig-story-x",
      "",
    );
    expect(utm).toEqual({
      source: "instagram",
      medium: "story",
      campaign: "brote",
      content: "ig-story-x",
    });
    expect(linkSlug).toBe("ig-story-x");
  });

  it("falls back to the haris_link cookie when the URL has no utm_content", () => {
    const { utm, linkSlug } = readBrowserAttribution(
      "",
      "_fbp=abc; haris_link=cookie-slug; other=1",
    );
    expect(utm).toEqual({});
    expect(linkSlug).toBe("cookie-slug");
  });

  it("prefers utm_content over the cookie, matching buildAttribution", () => {
    const { linkSlug } = readBrowserAttribution(
      "?utm_content=from-url",
      "haris_link=from-cookie",
    );
    expect(linkSlug).toBe("from-url");
  });

  it("returns nothing to attribute for a bare URL and no cookies", () => {
    const { utm, linkSlug } = readBrowserAttribution("", "");
    expect(utm).toEqual({});
    expect(linkSlug).toBeUndefined();
  });

  it("lets the cookie win over a present-but-empty utm_content", () => {
    // `?utm_content=` is nothing, not a value. Without normalization the ??
    // below returns "" and a perfectly good cookie slug is thrown away.
    const { utm, linkSlug } = readBrowserAttribution(
      "?utm_source=instagram&utm_content=",
      "haris_link=cookie-slug",
    );
    expect(utm.content).toBeUndefined();
    expect(linkSlug).toBe("cookie-slug");
  });

  it("treats a whitespace-only utm value as absent", () => {
    const { utm, linkSlug } = readBrowserAttribution(
      "?utm_source=%20%20&utm_content=%20",
      "haris_link=cookie-slug",
    );
    expect(utm.source).toBeUndefined();
    expect(linkSlug).toBe("cookie-slug");
  });

  it("decodes a percent-encoded cookie value", () => {
    const { linkSlug } = readBrowserAttribution("", "haris_link=a%2Fb");
    expect(linkSlug).toBe("a/b");
  });

  it("keeps a utm_source with no utm_content — source without a slug is still attribution", () => {
    const { utm, linkSlug } = readBrowserAttribution("?utm_source=instagram", "");
    expect(utm.source).toBe("instagram");
    expect(linkSlug).toBeUndefined();
  });
});
