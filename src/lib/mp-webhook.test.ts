import { describe, expect, it } from "vitest";
import { resolveMpFlow } from "./mp-webhook";

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
