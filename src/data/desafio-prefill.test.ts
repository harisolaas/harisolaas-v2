import { describe, expect, it } from "vitest";
import { DESAFIO_TOTAL_DAYS } from "./desafio";
import { DESAFIO_PREFILL } from "./desafio-prefill";
import { buildDesafioDays, parseYouTube, validateDayInput } from "@/lib/desafio";

// Pure: no DB. Guards the content `scripts/prefill-desafio.ts` loads into
// prod and `scripts/seed-preview.ts` uses as fixtures.

describe("desafío prefill", () => {
  it("has exactly one entry per day, 1..15, in order", () => {
    expect(DESAFIO_PREFILL.map((d) => d.dia)).toEqual(
      Array.from({ length: DESAFIO_TOTAL_DAYS }, (_, i) => i + 1),
    );
  });

  it("opens with the full-moon meditation", () => {
    expect(DESAFIO_PREFILL[0].meditacionVideo).toBe(
      "https://www.youtube.com/watch?v=sq9Ug1hrqW4",
    );
  });

  it("uses a different video every day", () => {
    const ids = DESAFIO_PREFILL.map((d) => parseYouTube(d.meditacionVideo)?.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DESAFIO_PREFILL.map((d) => [d.dia, d] as const))(
    "day %i passes the admin validation as a published day, unchanged",
    (_n, d) => {
      const fields = { ...d } as Partial<typeof d>;
      delete fields.dia;
      const res = validateDayInput({ ...fields, publicado: true });
      // Only the empty optional videos normalize (to null); every text field
      // is already trimmed and within its cap.
      expect(res).toEqual({
        ok: true,
        value: { ...fields, introVideo: null, reflexionVideo: null, publicado: true },
      });
      expect(parseYouTube(d.meditacionVideo)?.isShort).toBe(false);
      for (const f of ["titulo", "intro", "meditacion", "reflexion"] as const) {
        expect(d[f].trim(), `${f} must be filled`).not.toBe("");
      }
      expect(d.duracion).toMatch(/^\d{1,2} min$/);
    },
  );

  it("renders all 15 days as published once loaded", () => {
    const rows = DESAFIO_PREFILL.map((d) => ({
      dayNumber: d.dia,
      title: d.titulo,
      body: d.intro,
      introVideoUrl: d.introVideo || null,
      meditationTitle: d.meditacion,
      mediaUrl: d.meditacionVideo,
      durationLabel: d.duracion,
      reflection: d.reflexion,
      reflectionVideoUrl: d.reflexionVideo || null,
      published: true,
    }));
    const days = buildDesafioDays(rows);
    expect(days.every((d) => d.publicado)).toBe(true);
  });

  // CLAUDE.md: Spanish copy is gender agnostic and voseo. Whole words, so
  // "solos" is caught but "consola" isn't.
  const text = DESAFIO_PREFILL.map((d) =>
    [d.titulo, d.intro, d.meditacion, d.reflexion].join("\n"),
  )
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
    expect(text).not.toMatch(/\p{L}\/a\b/u);
  });

  it("uses voseo, not tuteo", () => {
    for (const w of ["tú", "tienes", "quieres", "puedes", "eres", "sientes", "haces", "estás listo"]) {
      expect(hasWord(w), `tuteo: ${w}`).toBe(false);
    }
  });

  // The page shows "Gurudev Sri Sri Ravi Shankar" as its own tag.
  it("doesn't carry YouTube-title noise", () => {
    expect(text).not.toContain("sri sri");
    expect(text).not.toContain("traducid");
    expect(text).not.toContain("en español");
  });

  it("has no date-bound copy (the challenge is self-paced)", () => {
    expect(text).not.toMatch(/\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
  });
});
