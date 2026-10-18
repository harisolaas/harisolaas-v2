import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { verifyMpSignature } from "./mp-server";

const SECRET = "test-mp-secret";

function signedRequest(
  dataId: string,
  opts: { secret?: string; requestId?: string; ts?: string } = {},
): Request {
  const requestId = opts.requestId ?? "req-123";
  const ts = opts.ts ?? "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", opts.secret ?? SECRET)
    .update(manifest)
    .digest("hex");
  return new Request("https://example.com/api/hackea/webhook", {
    method: "POST",
    headers: {
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": requestId,
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyMpSignature", () => {
  it("accepts a valid signature", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    expect(verifyMpSignature(signedRequest("98765"), "98765")).toBe(true);
  });

  it("rejects a signature made with another secret", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    const req = signedRequest("98765", { secret: "other" });
    expect(verifyMpSignature(req, "98765")).toBe(false);
  });

  it("rejects when the signed id is not the claimed one", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    expect(verifyMpSignature(signedRequest("98765"), "11111")).toBe(false);
  });

  it("rejects when the signature headers are missing", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    const req = new Request("https://example.com", { method: "POST" });
    expect(verifyMpSignature(req, "98765")).toBe(false);
  });

  it("rejects when the secret is unset outside development", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyMpSignature(signedRequest("98765"), "98765")).toBe(false);
  });

  it("lets requests through in development when the secret is unset", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyMpSignature(signedRequest("98765"), "98765")).toBe(true);
  });
});
