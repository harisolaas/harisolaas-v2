import { describe, expect, it } from "vitest";
import type { NowItem } from "@/dictionaries/types";
import {
  buildDesafioEventRow,
  buildPublicDays,
  parseDayNumber,
  resolveDesafioNowItem,
  parseDesafioMedia,
  validateDayInput,
  type ChallengeDayRow,
} from "./desafio";

const START = "2026-10-12";
const EMBED = "https://www.youtube-nocookie.com/embed/inpok4MKVLM";

describe("parseDesafioMedia", () => {
  it.each([
    "https://www.youtube.com/watch?v=inpok4MKVLM",
    "https://youtube.com/watch?v=inpok4MKVLM&t=30s",
    "https://m.youtube.com/watch?v=inpok4MKVLM",
    "https://youtu.be/inpok4MKVLM",
    "https://www.youtube.com/shorts/inpok4MKVLM",
    "https://www.youtube.com/embed/inpok4MKVLM",
  ])("recognizes YouTube: %s", (url) => {
    expect(parseDesafioMedia(url)).toEqual({ kind: "youtube", url, embedUrl: EMBED });
  });

  it("treats a YouTube URL without a valid id as a link", () => {
    expect(parseDesafioMedia("https://www.youtube.com/watch?v=short")?.kind).toBe("link");
    expect(parseDesafioMedia("https://www.youtube.com/@canal")?.kind).toBe("link");
  });

  it("detects audio by extension, case-insensitively", () => {
    expect(parseDesafioMedia("https://cdn.example.com/dia-1.MP3")).toEqual({
      kind: "audio",
      url: "https://cdn.example.com/dia-1.MP3",
    });
    expect(parseDesafioMedia("https://x.example/a.m4a?dl=1")?.kind).toBe("audio");
  });

  it("falls back to link for other https pages", () => {
    expect(parseDesafioMedia("  https://www.harisolaas.com/es/sinergia  ")).toEqual({
      kind: "link",
      url: "https://www.harisolaas.com/es/sinergia",
    });
  });

  it.each(["javascript:alert(1)", "ftp://x", "not a url", "", null, undefined])(
    "rejects %s",
    (raw) => {
      expect(parseDesafioMedia(raw)).toBeNull();
    },
  );
});

function row(dayNumber: number, over: Partial<ChallengeDayRow> = {}): ChallengeDayRow {
  return {
    dayNumber,
    title: `Día ${dayNumber}`,
    body: "Cuerpo",
    mediaUrl: "https://youtu.be/inpok4MKVLM",
    published: true,
    ...over,
  };
}

describe("buildPublicDays", () => {
  // 2026-10-14 12:00 ART → days 1..3 unlocked, day 3 is today.
  const NOW = new Date("2026-10-14T15:00:00Z");

  it("always returns totalDays entries", () => {
    const days = buildPublicDays([], NOW, "es", START);
    expect(days).toHaveLength(15);
    expect(days.map((d) => d.dayNumber)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it("never leaks content for a locked day, even when published", () => {
    const days = buildPublicDays([row(10)], NOW, "es", START);
    const d10 = days[9];
    expect(d10.state).toBe("locked");
    expect(d10).not.toHaveProperty("title");
    expect(d10).not.toHaveProperty("body");
    expect(d10).not.toHaveProperty("media");
    expect(JSON.stringify(days)).not.toContain("Día 10");
  });

  it("renders unlocked-but-unready days as empty", () => {
    const days = buildPublicDays(
      [row(1, { published: false }), row(3, { title: "   " })],
      NOW,
      "es",
      START,
    );
    expect(days[0].state).toBe("empty"); // unpublished
    expect(days[1].state).toBe("empty"); // no row
    expect(days[2].state).toBe("empty"); // published, blank title
    expect(days[0]).not.toHaveProperty("title");
  });

  it("opens unlocked published days with parsed media", () => {
    const days = buildPublicDays([row(2)], NOW, "en", START);
    expect(days[1]).toMatchObject({
      state: "open",
      title: "Día 2",
      body: "Cuerpo",
      date: "2026-10-13",
      dateLabel: "Tuesday, October 13",
      media: { kind: "youtube", embedUrl: EMBED },
    });
  });

  it("flags only the Argentina-today day", () => {
    const days = buildPublicDays([], NOW, "es", START);
    expect(days.filter((d) => d.isToday).map((d) => d.dayNumber)).toEqual([3]);
    // 01:00 UTC on the 15th is still the 14th in Argentina.
    const late = buildPublicDays([], new Date("2026-10-15T01:00:00Z"), "es", START);
    expect(late.filter((d) => d.isToday).map((d) => d.dayNumber)).toEqual([3]);
  });
});

describe("validateDayInput", () => {
  it("trims and nulls empty strings; published defaults to false", () => {
    expect(
      validateDayInput({ title: "  Hola ", body: "", mediaUrl: "   " }),
    ).toEqual({
      ok: true,
      value: { title: "Hola", body: null, mediaUrl: null, published: false },
    });
  });

  it("accepts a full valid day", () => {
    const r = validateDayInput({
      title: "Día 1",
      body: "Texto",
      mediaUrl: "https://youtu.be/inpok4MKVLM",
      published: true,
    });
    expect(r.ok).toBe(true);
  });

  it.each<[unknown, string]>([
    [null, "Datos inválidos"],
    ["hola", "Datos inválidos"],
    [[], "Datos inválidos"],
    [{ title: 5 }, "Datos inválidos"],
    [{ title: "x", published: "yes" }, "Datos inválidos"],
    [{ title: "x".repeat(121) }, "El título no puede superar 120 caracteres"],
    [{ body: "x".repeat(4001) }, "El texto no puede superar 4000 caracteres"],
    [
      { mediaUrl: "javascript:alert(1)" },
      "El link tiene que ser una URL válida que empiece con https://",
    ],
    [
      { mediaUrl: "http://example.com/dia1.mp3" },
      "El link tiene que ser una URL válida que empiece con https://",
    ],
    [
      { mediaUrl: `https://example.com/${"a".repeat(500)}` },
      "El link tiene que ser una URL válida que empiece con https://",
    ],
    [{ published: true }, "Para publicar, el día necesita un título"],
    [{ title: "  ", published: true }, "Para publicar, el día necesita un título"],
  ])("rejects %j", (raw, error) => {
    expect(validateDayInput(raw)).toEqual({ ok: false, error });
  });

  it("allows exactly 120 / 4000 chars", () => {
    expect(
      validateDayInput({ title: "x".repeat(120), body: "y".repeat(4000) }).ok,
    ).toBe(true);
  });
});

describe("parseDayNumber", () => {
  it("accepts 1..15", () => {
    expect(parseDayNumber("1")).toBe(1);
    expect(parseDayNumber("15")).toBe(15);
  });
  it.each(["0", "16", "1.5", "abc", "", "-1", " 3"])("rejects %j", (raw) => {
    expect(parseDayNumber(raw)).toBeNull();
  });
});

describe("resolveDesafioNowItem", () => {
  const card: NowItem = {
    categoryKey: "teaching",
    categoryLabel: "Enseñanza",
    title: "Desafío",
    description: "Arranca el {date}.",
    status: "Inscripciones abiertas",
    cta: { label: "Sumarme", href: "/es/desafio" },
    desafioPhases: {
      live: { description: "Empezó el {date}.", status: "En curso" },
      after: { description: "Terminó.", status: "Terminó", ctaLabel: "Ver el recorrido" },
    },
  };

  it("keeps the top-level copy before the start", () => {
    const r = resolveDesafioNowItem(card, "before");
    expect(r.description).toBe("Arranca el {date}.");
    expect(r.status).toBe("Inscripciones abiertas");
    expect(r.cta?.label).toBe("Sumarme");
    expect(r).not.toHaveProperty("desafioPhases");
  });

  it("switches to the live copy and keeps the CTA label", () => {
    const r = resolveDesafioNowItem(card, "live");
    expect(r.description).toBe("Empezó el {date}.");
    expect(r.status).toBe("En curso");
    expect(r.cta).toEqual({ label: "Sumarme", href: "/es/desafio" });
    expect(r).not.toHaveProperty("desafioPhases");
  });

  it("switches to the after copy and CTA label", () => {
    const r = resolveDesafioNowItem(card, "after");
    expect(r.status).toBe("Terminó");
    expect(r.cta).toEqual({ label: "Ver el recorrido", href: "/es/desafio" });
  });

  it("passes other cards through untouched", () => {
    const { desafioPhases: _omit, ...plain } = card;
    void _omit;
    expect(resolveDesafioNowItem(plain, "live")).toEqual(plain);
  });
});

describe("buildDesafioEventRow", () => {
  it("derives date and status from the start date and now", () => {
    const start = "2026-09-28";
    const row = buildDesafioEventRow("evt", new Date("2026-09-28T15:00:00Z"), start);
    expect(row.id).toBe("evt");
    expect(row.date.toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(row.status).toBe("live");
    expect(buildDesafioEventRow("evt", new Date("2026-09-20T12:00:00Z"), start).status).toBe("upcoming");
    expect(buildDesafioEventRow("evt", new Date("2026-10-13T03:00:00Z"), start).status).toBe("past");
  });
});
