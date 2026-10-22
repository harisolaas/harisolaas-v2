import { describe, expect, it } from "vitest";
import { hackeaConfig } from "@/data/hackea";
import { resolveHackeaVsl } from "./hackea-vsl";

const YT = "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1&playsinline=1";

describe("resolveHackeaVsl", () => {
  it("is null without a URL, so the poster does nothing", () => {
    expect(resolveHackeaVsl(undefined)).toBeNull();
    expect(resolveHackeaVsl(null)).toBeNull();
    expect(resolveHackeaVsl("  ")).toBeNull();
  });

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("normalises YouTube link %s to the autoplay embed", (url) => {
    expect(resolveHackeaVsl(url)).toEqual({ kind: "embed", src: YT });
  });

  it.each(["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"])(
    "normalises Vimeo link %s",
    (url) => {
      expect(resolveHackeaVsl(url)).toEqual({
        kind: "embed",
        src: "https://player.vimeo.com/video/123456789?autoplay=1",
      });
    },
  );

  it("plays self-hosted files in a native video", () => {
    expect(resolveHackeaVsl("/hackea/vsl.mp4")).toEqual({ kind: "file", src: "/hackea/vsl.mp4" });
    expect(resolveHackeaVsl("https://cdn.example.com/v.webm?x=1")).toEqual({
      kind: "file",
      src: "https://cdn.example.com/v.webm?x=1",
    });
  });

  it("uses anything else as-is", () => {
    expect(resolveHackeaVsl("https://example.com/player/42")).toEqual({
      kind: "embed",
      src: "https://example.com/player/42",
    });
  });

  it("the configured VSL resolves to a source", () => {
    expect(resolveHackeaVsl(hackeaConfig.vslUrl)).not.toBeNull();
  });
});
