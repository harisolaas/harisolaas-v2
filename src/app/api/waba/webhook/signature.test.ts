import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyMetaSignatureFromHeader } from "./route";

const SECRET = "test-app-secret";

function sign(body: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyMetaSignatureFromHeader", () => {
  it("accepts a correctly-signed body", () => {
    const body = '{"object":"whatsapp_business_account","entry":[]}';
    expect(verifyMetaSignatureFromHeader(sign(body), body, SECRET)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyMetaSignatureFromHeader(null, "anything", SECRET)).toBe(false);
  });

  it("rejects a header without the sha256= prefix", () => {
    const body = "x";
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    // Same hex, wrong scheme prefix.
    expect(verifyMetaSignatureFromHeader(sig, body, SECRET)).toBe(false);
    expect(verifyMetaSignatureFromHeader(`md5=${sig}`, body, SECRET)).toBe(
      false,
    );
  });

  it("rejects a header with the wrong secret", () => {
    const body = "x";
    expect(
      verifyMetaSignatureFromHeader(sign(body, "different"), body, SECRET),
    ).toBe(false);
  });

  it("rejects a body that's been tampered with after signing", () => {
    const original = '{"a":1}';
    const tampered = '{"a":2}';
    expect(
      verifyMetaSignatureFromHeader(sign(original), tampered, SECRET),
    ).toBe(false);
  });

  it("rejects a header whose hex length is wrong", () => {
    expect(
      verifyMetaSignatureFromHeader("sha256=cafebabe", "body", SECRET),
    ).toBe(false);
  });

  it("rejects a header containing non-hex characters of the right length", () => {
    // 64 chars but not hex — Buffer.from(..., 'hex') silently drops
    // invalid pairs and produces a shorter buffer; timingSafeEqual
    // throws on length mismatch, the catch returns false.
    const sixtyFourNonHex = "Z".repeat(64);
    expect(
      verifyMetaSignatureFromHeader(
        `sha256=${sixtyFourNonHex}`,
        "body",
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects an empty body when the signature is for non-empty content", () => {
    const sig = sign("real body");
    expect(verifyMetaSignatureFromHeader(sig, "", SECRET)).toBe(false);
  });
});
