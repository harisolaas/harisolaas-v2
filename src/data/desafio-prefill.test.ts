import { describe, expect, it } from "vitest";
import { desafioConfig } from "./desafio";
import { DESAFIO_PREFILL } from "./desafio-prefill";
import {
  DAY_BODY_MAX,
  DAY_TITLE_MAX,
  parseDesafioMedia,
  validateDayInput,
} from "@/lib/desafio";

// Pure: no DB. Guards the content `scripts/prefill-desafio.ts` loads into
// prod and `scripts/seed-preview.ts` uses as fixtures.

describe("desafío prefill", () => {
  it("has exactly one entry per day, 1..totalDays, in order", () => {
    expect(DESAFIO_PREFILL.map((d) => d.dayNumber)).toEqual(
      Array.from({ length: desafioConfig.totalDays }, (_, i) => i + 1),
    );
  });

  it("opens with the full-moon meditation", () => {
    expect(DESAFIO_PREFILL[0].mediaUrl).toBe(
      "https://www.youtube.com/watch?v=sq9Ug1hrqW4",
    );
  });

  it("uses a different video every day", () => {
    const urls = DESAFIO_PREFILL.map((d) => d.mediaUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it.each(DESAFIO_PREFILL.map((d) => [d.dayNumber, d] as const))(
    "day %i embeds as YouTube and passes the admin validation",
    (_n, d) => {
      const media = parseDesafioMedia(d.mediaUrl);
      expect(media?.kind).toBe("youtube");
      expect(media && "embedUrl" in media && media.embedUrl).toMatch(
        /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/,
      );

      const res = validateDayInput({ ...d, published: true });
      expect(res).toEqual({
        ok: true,
        value: { title: d.title, body: d.body, mediaUrl: d.mediaUrl, published: true },
      });
      expect(d.title.length).toBeLessThanOrEqual(DAY_TITLE_MAX);
      expect(d.body.length).toBeLessThanOrEqual(DAY_BODY_MAX);
      expect(d.title.trim()).toBe(d.title);
      expect(d.body.trim()).not.toBe("");
    },
  );

  // CLAUDE.md: Spanish copy is gender agnostic and voseo. Whole words, so
  // "solos" is caught but "consola" isn't.
  const text = DESAFIO_PREFILL.map((d) => `${d.title}\n${d.body}`)
    .join("\n")
    .toLowerCase();
  const hasWord = (w: string) =>
    new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u").test(text);

  it("avoids gendered forms", () => {
    for (const w of [
      "solo", "sola", "solos", "solas", "sólo",
      "todo el mundo", "todos", "todas",
      "bienvenido", "bienvenida", "bienvenidos", "bienvenidas",
      "juntos", "juntas",
      "anotado", "anotada", "anotados", "anotadas",
      "listo", "lista", "cansado", "cansada",
      "tranquilo", "tranquila", "relajado", "relajada",
      "sentado", "sentada", "acostado", "acostada",
      "atento", "atenta", "cómodo", "invitado", "invitada",
    ]) {
      expect(hasWord(w), `gendered: ${w}`).toBe(false);
    }
  });

  it("uses voseo, not tuteo", () => {
    for (const w of ["tú", "tienes", "quieres", "puedes", "eres", "sientes", "haces", "estás listo"]) {
      expect(hasWord(w), `tuteo: ${w}`).toBe(false);
    }
  });

  it("doesn't carry YouTube-title noise", () => {
    expect(text).not.toContain("sri sri");
    expect(text).not.toContain("traducido");
  });
});
