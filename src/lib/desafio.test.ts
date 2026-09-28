import { describe, expect, it } from "vitest";
import {
  buildAdminDays,
  buildDesafioDays,
  buildDesafioEventRow,
  isValidYouTubeUrl,
  parseDayNumber,
  parseYouTube,
  validateDayInput,
  youtubeEmbedUrl,
  type ChallengeDayRow,
} from "./desafio";

const ID = "sq9Ug1hrqW4";
const EMBED = `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&playsinline=1`;

describe("parseYouTube", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=10`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
  ])("extracts the id from %s as a 16/9 nocookie embed", (url) => {
    expect(parseYouTube(url)).toEqual({
      id: ID,
      embedUrl: EMBED,
      isShort: false,
      aspectRatio: "16/9",
    });
  });

  it("marks /shorts/ as vertical 9/16", () => {
    expect(parseYouTube(`https://youtube.com/shorts/${ID}`)).toMatchObject({
      id: ID,
      isShort: true,
      aspectRatio: "9/16",
    });
  });

  it.each(["", "   ", null, undefined, "https://vimeo.com/123", "https://youtu.be/short"])(
    "returns null for %s",
    (v) => {
      expect(parseYouTube(v)).toBeNull();
    },
  );

  it("rebuilds the embed URL from the id only", () => {
    expect(youtubeEmbedUrl("abc")).toBe(
      "https://www.youtube-nocookie.com/embed/abc?rel=0&modestbranding=1&playsinline=1",
    );
  });
});

describe("isValidYouTubeUrl (admin input)", () => {
  it("accepts https YouTube links", () => {
    expect(isValidYouTubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isValidYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(true);
  });

  it.each([
    `http://youtu.be/${ID}`,
    `https://evil.example/?v=${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`,
    "https://www.youtube.com/",
    "not a url",
  ])("rejects %s", (v) => {
    expect(isValidYouTubeUrl(v)).toBe(false);
  });
});

const row = (n: number, over: Partial<ChallengeDayRow> = {}): ChallengeDayRow => ({
  dayNumber: n,
  title: `Título ${n}`,
  body: "Intro",
  introVideoUrl: null,
  meditationTitle: "Meditación",
  mediaUrl: `https://youtu.be/${ID}`,
  durationLabel: "18 min",
  reflection: null,
  reflectionVideoUrl: null,
  published: true,
  ...over,
});

describe("buildDesafioDays", () => {
  it("always returns 15 days in order, missing rows unpublished", () => {
    const days = buildDesafioDays([row(2)]);
    expect(days.map((d) => d.dia)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
    expect(days[0]).toEqual({ dia: 1, publicado: false });
    expect(days[1].publicado).toBe(true);
  });

  it("maps a published row to the design's shape, nulls as empty strings", () => {
    expect(buildDesafioDays([row(1)])[0]).toEqual({
      dia: 1,
      publicado: true,
      titulo: "Título 1",
      intro: "Intro",
      introVideo: "",
      meditacion: "Meditación",
      meditacionVideo: `https://youtu.be/${ID}`,
      duracion: "18 min",
      reflexion: "",
      reflexionVideo: "",
    });
  });

  // Security invariant: unpublished content never reaches the client.
  it("strips every content field from unpublished days", () => {
    const [d] = buildDesafioDays([
      row(1, { published: false, title: "Borrador secreto", body: "secreto" }),
    ]);
    expect(d).toEqual({ dia: 1, publicado: false });
    expect(JSON.stringify(d)).not.toContain("secreto");
  });

  it("treats a published row without a title as unpublished", () => {
    expect(buildDesafioDays([row(1, { title: "  " })])[0]).toEqual({
      dia: 1,
      publicado: false,
    });
  });

  it("drops stored video URLs that aren't YouTube", () => {
    const [d] = buildDesafioDays([
      row(1, {
        mediaUrl: "https://example.com/a.mp3",
        introVideoUrl: "javascript:alert(1)",
      }),
    ]);
    expect(d).toMatchObject({ meditacionVideo: "", introVideo: "" });
  });
});

describe("validateDayInput", () => {
  const valid = {
    titulo: "Llegar",
    intro: "Hoy no hay que lograr nada.",
    introVideo: "",
    meditacion: "Meditación de la luna llena",
    meditacionVideo: `https://www.youtube.com/watch?v=${ID}`,
    duracion: "18 min",
    reflexion: "¿Cómo te sentís?",
    reflexionVideo: `https://youtube.com/shorts/${ID}`,
    publicado: true,
  };

  it("accepts a full day and normalizes empty strings to null", () => {
    expect(validateDayInput(valid)).toEqual({
      ok: true,
      value: { ...valid, introVideo: null },
    });
  });

  it("trims text and treats missing fields as null / unpublished", () => {
    expect(validateDayInput({ titulo: "  Hola  " })).toEqual({
      ok: true,
      value: {
        titulo: "Hola",
        intro: null,
        introVideo: null,
        meditacion: null,
        meditacionVideo: null,
        duracion: null,
        reflexion: null,
        reflexionVideo: null,
        publicado: false,
      },
    });
  });

  it.each([null, [], "x", 3])("rejects a non-object body (%s)", (body) => {
    expect(validateDayInput(body)).toEqual({ ok: false, error: "Datos inválidos" });
  });

  it("rejects non-string fields and a non-boolean publicado", () => {
    expect(validateDayInput({ ...valid, intro: 3 }).ok).toBe(false);
    expect(validateDayInput({ ...valid, publicado: "true" }).ok).toBe(false);
  });

  it.each([
    ["titulo", 121],
    ["intro", 4001],
    ["meditacion", 161],
    ["duracion", 21],
    ["reflexion", 2001],
  ])("caps %s at its limit", (field, len) => {
    const res = validateDayInput({ ...valid, [field]: "x".repeat(len) });
    expect(res.ok).toBe(false);
    expect(validateDayInput({ ...valid, [field]: "x".repeat(len - 1) }).ok).toBe(true);
  });

  it.each(["introVideo", "meditacionVideo", "reflexionVideo"])(
    "requires an https YouTube link in %s",
    (field) => {
      for (const bad of [
        "https://example.com/a.mp3",
        `http://youtu.be/${ID}`,
        "javascript:alert(1)",
        `https://youtu.be/${ID}?x=${"a".repeat(500)}`,
      ]) {
        const res = validateDayInput({ ...valid, [field]: bad });
        expect(res.ok, `${field}=${bad.slice(0, 40)}`).toBe(false);
      }
    },
  );

  it("needs a title and a meditation video to publish, not to save a draft", () => {
    expect(validateDayInput({ ...valid, titulo: "" })).toEqual({
      ok: false,
      error: "Para publicar, el día necesita un título",
    });
    expect(validateDayInput({ ...valid, meditacionVideo: "" })).toEqual({
      ok: false,
      error: "Para publicar, el día necesita el video de la meditación",
    });
    expect(
      validateDayInput({ ...valid, titulo: "", meditacionVideo: "", publicado: false }).ok,
    ).toBe(true);
  });
});

describe("parseDayNumber", () => {
  it("accepts 1..15 only", () => {
    expect(parseDayNumber("1")).toBe(1);
    expect(parseDayNumber("15")).toBe(15);
    for (const bad of ["0", "16", "x", "1.5", "-1", ""]) {
      expect(parseDayNumber(bad)).toBeNull();
    }
  });
});

describe("buildAdminDays", () => {
  it("returns 15 entries with raw values, visibility and empty gaps", () => {
    const days = buildAdminDays([
      { ...row(3, { published: false }), updatedAt: new Date(0), updatedByEmail: "a@b.c" },
    ]);
    expect(days).toHaveLength(15);
    expect(days[0]).toMatchObject({ dia: 1, titulo: "", publicado: false, visible: false, updatedAt: null });
    expect(days[2]).toMatchObject({
      dia: 3,
      titulo: "Título 3",
      publicado: false,
      visible: false,
      updatedAt: "1970-01-01T00:00:00.000Z",
      updatedByEmail: "a@b.c",
    });
  });
});

describe("buildDesafioEventRow", () => {
  it("uses the given id and never depends on the date", () => {
    expect(buildDesafioEventRow("x")).toMatchObject({
      id: "x",
      type: "desafio",
      status: "live",
      landingPath: "/es/desafio",
    });
  });
});
