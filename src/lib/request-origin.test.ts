import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequestBaseUrl } from "./request-origin";

function req(url: string): Request {
  return new Request(url);
}

describe("getRequestBaseUrl", () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_BASE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_ENV;
  });

  it("returns the request's own origin for the configured prod host", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.harisolaas.com";
    expect(getRequestBaseUrl(req("https://www.harisolaas.com/api/x"))).toBe(
      "https://www.harisolaas.com",
    );
  });

  it("allows Vercel preview deploys", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.harisolaas.com";
    expect(
      getRequestBaseUrl(
        req("https://harisolaas-human-git-branch-abc.vercel.app/api/x"),
      ),
    ).toBe("https://harisolaas-human-git-branch-abc.vercel.app");
  });

  it("allows localhost for `next dev`", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.harisolaas.com";
    expect(getRequestBaseUrl(req("http://localhost:3000/api/x"))).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects a spoofed host and falls back to the env var", () => {
    // Defense against host-header injection: a request arriving with an
    // unknown hostname (e.g. attacker.example) must not end up in the
    // magic-link email body.
    process.env.NEXT_PUBLIC_BASE_URL = "https://www.harisolaas.com";
    expect(getRequestBaseUrl(req("https://attacker.example/api/x"))).toBe(
      "https://www.harisolaas.com",
    );
  });

  it("falls back to the hardcoded default when env is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(getRequestBaseUrl(req("https://attacker.example/api/x"))).toBe(
      "https://www.harisolaas.com",
    );
    vi.unstubAllEnvs();
  });
});
