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

/** Read a cookie value from a Next.js Request without Next's cookies() helper. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}

function trimOrUndefined(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}
