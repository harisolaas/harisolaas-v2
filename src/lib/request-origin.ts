/**
 * Derive a trusted origin for an incoming request. Used by admin auth
 * routes to build magic-link URLs that point back to whichever deploy
 * (prod, preview, local dev) issued them — without trusting a forged
 * `Host` header to redirect users to an attacker-controlled domain.
 *
 * Strategy:
 * 1. Parse `req.url` for the origin. In Next.js App Router handlers
 *    this reflects the actual URL the runtime received, which is the
 *    safest source (Vercel rewrites the Host header to the real
 *    deployment hostname before the handler sees the request).
 * 2. Allow the origin only if it matches the app's own domains —
 *    the configured prod URL, any `*.vercel.app` preview, or localhost
 *    during `next dev`.
 * 3. Otherwise fall back to `NEXT_PUBLIC_BASE_URL` (prod).
 */
export function getRequestBaseUrl(req: Request): string {
  const envUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

  let candidate: URL | null = null;
  try {
    candidate = new URL(req.url);
  } catch {
    return envUrl;
  }

  if (isTrustedOrigin(candidate, envUrl)) {
    return candidate.origin;
  }
  return envUrl;
}

function isTrustedOrigin(url: URL, envUrl: string): boolean {
  const host = url.hostname;
  // The configured prod host — whatever `NEXT_PUBLIC_BASE_URL` points at.
  try {
    const envHost = new URL(envUrl).hostname;
    if (host === envHost) return true;
  } catch {
    /* malformed env URL — ignore */
  }
  // Any Vercel preview deployment.
  if (host.endsWith(".vercel.app")) return true;
  // Local dev via `next dev`.
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false;
}
