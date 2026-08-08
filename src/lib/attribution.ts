import type { AttributionTouch } from "./community";

export const LINK_COOKIE_NAME = "haris_link";

/**
 * Raw UTM fields that landing pages forward from window.location.search
 * into the signup handler's JSON body.
 */
export interface UtmBody {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
}

export interface AttributionInput {
  /** Parsed request body — whatever fields the handler accepts. */
  body?: {
    utm?: UtmBody | null;
    linkSlug?: string | null;
  } | null;
  /** The incoming request — read cookies + referer. */
  req: Request;
}

/**
 * Build an AttributionTouch from URL-provided UTMs (preferred) and a fallback
 * `haris_link` cookie set by /go/[slug]. Returns undefined when there's
 * nothing worth recording (no utm, no cookie, no referer).
 *
 * Precedence: utm_content from URL > cookie. Everything else comes from URL.
 */
export function buildAttribution(
  input: AttributionInput,
): AttributionTouch | undefined {
  const utm = input.body?.utm ?? undefined;
  const bodyLinkSlug = input.body?.linkSlug ?? undefined;
  const cookieSlug = readCookie(input.req, LINK_COOKIE_NAME);

  const source = trimOrUndefined(utm?.source);
  const medium = trimOrUndefined(utm?.medium);
  const campaign = trimOrUndefined(utm?.campaign);
  const content = trimOrUndefined(utm?.content);

  // utm_content carries the link slug; URL wins over cookie.
  const linkSlug = trimOrUndefined(bodyLinkSlug) ?? content ?? cookieSlug;

  const referrer = input.req.headers.get("referer") ?? undefined;

  if (!linkSlug && !source && !medium && !campaign && !referrer) {
    return undefined;
  }

  return {
    linkSlug,
    source,
    medium,
    campaign,
    content,
    referrer,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Browser-side half of `buildAttribution`: what a client form should put in
 * its POST body so the server can attribute the signup.
 *
 * Pure on purpose — takes the query string and cookie header as strings
 * rather than touching `window`/`document`, so it is testable in a repo with
 * no DOM test environment. Callers pass `window.location.search` and
 * `document.cookie`.
 *
 * Precedence matches `buildAttribution`: `utm_content` from the URL wins over
 * the `haris_link` cookie.
 */
export function readBrowserAttribution(
  search: string,
  cookieHeader: string,
): { utm: UtmBody; linkSlug?: string } {
  const params = new URLSearchParams(search);
  const utm: UtmBody = {};
  // Same normalization `buildAttribution` applies server-side: a present-but-
  // empty param (`?utm_content=`) is nothing, not a value. Without this the
  // `??` below would let "" win over a perfectly good cookie and produce an
  // empty slug.
  const source = trimOrUndefined(params.get("utm_source"));
  const medium = trimOrUndefined(params.get("utm_medium"));
  const campaign = trimOrUndefined(params.get("utm_campaign"));
  const content = trimOrUndefined(params.get("utm_content"));
  if (source) utm.source = source;
  if (medium) utm.medium = medium;
  if (campaign) utm.campaign = campaign;
  if (content) utm.content = content;

  return {
    utm,
    linkSlug: content ?? readCookieHeader(cookieHeader, LINK_COOKIE_NAME),
  };
}

/**
 * Cookie lookup over a raw cookie string — a `Cookie:` header server-side,
 * `document.cookie` in the browser. Both spellings are the same grammar, so
 * they share one parser rather than drifting apart.
 */
function readCookieHeader(
  header: string | null,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}

/** Read a cookie value from a Next.js Request without Next's cookies() helper. */
export function readCookie(req: Request, name: string): string | undefined {
  return readCookieHeader(req.headers.get("cookie"), name);
}

function trimOrUndefined(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}
