import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseWebhookEnvelope,
  resolveMpFlow,
  verifyMpSignature,
} from "./mp-webhook";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/mp/webhook", {
    method: "POST",
    headers,
  });
}

function signedHeaders(args: {
  secret: string;
  body: string;
  ts: string;
  requestId: string;
}): Record<string, string> {
  const parsed = JSON.parse(args.body);
  const dataId = String(parsed.data?.id ?? "");
  const manifest = `id:${dataId};request-id:${args.requestId};ts:${args.ts};`;
  const v1 = createHmac("sha256", args.secret)
    .update(manifest)
    .digest("hex");
  return {
    "x-signature": `ts=${args.ts},v1=${v1}`,
    "x-request-id": args.requestId,
  };
}

describe("resolveMpFlow", () => {
  it("routes by metadata.flow when present", () => {
    expect(resolveMpFlow({ metadata: { flow: "sinergia" } })).toBe("sinergia");
    expect(resolveMpFlow({ metadata: { flow: "brote" } })).toBe("brote");
  });

  it("metadata.flow takes precedence over legacy markers", () => {
    expect(
      resolveMpFlow({
        metadata: { flow: "sinergia", type: "ticket" },
        external_reference: "BROTE-XXXX",
      }),
    ).toBe("sinergia");
  });

  it("falls back to legacy metadata.type for sinergia preferences", () => {
    expect(
      resolveMpFlow({ metadata: { type: "sinergia-donation" } }),
    ).toBe("sinergia");
  });

  it("falls back to legacy metadata.type for brote preferences", () => {
    expect(resolveMpFlow({ metadata: { type: "ticket" } })).toBe("brote");
  });

  it("falls back to external_reference prefix for sinergia", () => {
    expect(
      resolveMpFlow({ metadata: {}, external_reference: "SIN-ABC123" }),
    ).toBe("sinergia");
  });

  it("falls back to external_reference prefix for brote", () => {
    expect(
      resolveMpFlow({ metadata: {}, external_reference: "BROTE-ABC123" }),
    ).toBe("brote");
  });

  it("returns null when no signal recognized", () => {
    expect(resolveMpFlow({ metadata: {} })).toBeNull();
    expect(
      resolveMpFlow({ metadata: { flow: "unknown" } }),
    ).toBeNull();
    expect(
      resolveMpFlow({ metadata: {}, external_reference: "OTHER-123" }),
    ).toBeNull();
  });

  it("handles missing metadata and external_reference gracefully", () => {
    expect(resolveMpFlow({})).toBeNull();
    expect(resolveMpFlow({ metadata: null })).toBeNull();
    expect(resolveMpFlow({ external_reference: null })).toBeNull();
  });
});

describe("parseWebhookEnvelope", () => {
  it("returns the type and stringified data id", () => {
    expect(
      parseWebhookEnvelope(
        JSON.stringify({ type: "payment", data: { id: 12345 } }),
      ),
    ).toEqual({ type: "payment", dataId: "12345" });
  });

  it("returns empty dataId when data.id is absent", () => {
    expect(
      parseWebhookEnvelope(JSON.stringify({ type: "payment" })),
    ).toEqual({ type: "payment", dataId: "" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseWebhookEnvelope("not json")).toBeNull();
  });

  it("returns null when type is missing", () => {
    expect(parseWebhookEnvelope(JSON.stringify({ data: { id: 1 } }))).toBeNull();
  });
});

describe("verifyMpSignature", () => {
  const SECRET = "test-secret";
  const BODY = JSON.stringify({ type: "payment", data: { id: 999 } });
  const TS = "1700000000";
  const REQUEST_ID = "req-abc";

  const originalSecret = process.env.MP_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.MP_WEBHOOK_SECRET;
    } else {
      process.env.MP_WEBHOOK_SECRET = originalSecret;
    }
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("accepts a request with a valid signature", () => {
    const headers = signedHeaders({
      secret: SECRET,
      body: BODY,
      ts: TS,
      requestId: REQUEST_ID,
    });
    expect(verifyMpSignature(makeRequest(headers), BODY)).toBe(true);
  });

  it("rejects when the signature was generated with a different secret", () => {
    const headers = signedHeaders({
      secret: "other-secret",
      body: BODY,
      ts: TS,
      requestId: REQUEST_ID,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(verifyMpSignature(makeRequest(headers), BODY)).toBe(false);
  });

  it("rejects when the signature length differs from the expected hash", () => {
    const headers = {
      "x-signature": `ts=${TS},v1=deadbeef`,
      "x-request-id": REQUEST_ID,
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(verifyMpSignature(makeRequest(headers), BODY)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      verifyMpSignature(makeRequest({ "x-request-id": REQUEST_ID }), BODY),
    ).toBe(false);
  });

  it("rejects when the request id header is missing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      verifyMpSignature(makeRequest({ "x-signature": `ts=${TS},v1=abc` }), BODY),
    ).toBe(false);
  });

  it("rejects when ts or v1 segments are absent", () => {
    expect(
      verifyMpSignature(
        makeRequest({
          "x-signature": "v1=abc",
          "x-request-id": REQUEST_ID,
        }),
        BODY,
      ),
    ).toBe(false);
    expect(
      verifyMpSignature(
        makeRequest({
          "x-signature": `ts=${TS}`,
          "x-request-id": REQUEST_ID,
        }),
        BODY,
      ),
    ).toBe(false);
  });

  it("does not crash on malformed segments missing the equals sign", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The "garbage" segment has no `=`. Old code would call .trim()
    // on undefined and throw, taking the request down with a 500.
    expect(
      verifyMpSignature(
        makeRequest({
          "x-signature": `garbage,ts=${TS},v1=abc`,
          "x-request-id": REQUEST_ID,
        }),
        BODY,
      ),
    ).toBe(false);
  });

  it("rejects when body is invalid JSON", () => {
    const headers = {
      "x-signature": `ts=${TS},v1=abc`,
      "x-request-id": REQUEST_ID,
    };
    expect(verifyMpSignature(makeRequest(headers), "not json")).toBe(false);
  });

  it("allows missing secret in development for local testing", () => {
    delete process.env.MP_WEBHOOK_SECRET;
    process.env.NODE_ENV = "development";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(verifyMpSignature(makeRequest({}), BODY)).toBe(true);
  });

  it("rejects missing secret in non-development environments", () => {
    delete process.env.MP_WEBHOOK_SECRET;
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(verifyMpSignature(makeRequest({}), BODY)).toBe(false);
  });
});
