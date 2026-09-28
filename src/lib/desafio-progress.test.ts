import { describe, it, expect } from "vitest";
import type { DesafioDay } from "@/lib/desafio";
import {
  canOpenDay,
  dayStatus,
  doneMessage,
  findNextDay,
  firstSoonDay,
  isAllDone,
  parseCompletados,
  parseRouteHash,
  resolveRoute,
  routeHash,
  toggleCompletado,
} from "./desafio-progress";

const ALL = Array.from({ length: 15 }, (_, i) => i + 1);

/** 15 days, the first `published` of them published. */
function dias(published: number): DesafioDay[] {
  return ALL.map((dia) =>
    dia <= published
      ? {
          dia,
          publicado: true as const,
          titulo: `Día ${dia}`,
          intro: "",
          introVideo: "",
          meditacion: "M",
          meditacionVideo: "https://youtu.be/sq9Ug1hrqW4",
          duracion: "20 min",
          reflexion: "",
          reflexionVideo: "",
        }
      : { dia, publicado: false as const },
  );
}

describe("parseCompletados", () => {
  it("reads a sorted array", () => {
    expect(parseCompletados("[3,1,2]")).toEqual([1, 2, 3]);
  });

  it("drops junk instead of trusting it", () => {
    expect(parseCompletados(null)).toEqual([]);
    expect(parseCompletados("not json")).toEqual([]);
    expect(parseCompletados('{"a":1}')).toEqual([]);
    expect(parseCompletados('[0,1,1,16,2.5,"3",15]')).toEqual([1, 15]);
  });
});

describe("toggleCompletado", () => {
  it("adds sorted and removes", () => {
    expect(toggleCompletado([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleCompletado([1, 3, 5], 3)).toEqual([1, 5]);
  });
});

describe("findNextDay / isAllDone", () => {
  it("is the lowest published day not done", () => {
    expect(findNextDay(dias(5), [])).toBe(1);
    expect(findNextDay(dias(5), [1, 2, 4])).toBe(3);
  });

  it("is null when every published day is done", () => {
    expect(findNextDay(dias(3), [1, 2, 3])).toBeNull();
  });

  it("allDone needs all 15", () => {
    expect(isAllDone(ALL.slice(0, 14))).toBe(false);
    expect(isAllDone(ALL)).toBe(true);
  });
});

describe("dayStatus", () => {
  const d = dias(5);
  const done = [1, 2, 7]; // 7 marked, then unpublished
  const next = findNextDay(d, done);

  it("follows done → next → open → soon", () => {
    expect(dayStatus(1, d, done, next)).toBe("done");
    expect(dayStatus(7, d, done, next)).toBe("done");
    expect(dayStatus(3, d, done, next)).toBe("next");
    expect(dayStatus(4, d, done, next)).toBe("open");
    expect(dayStatus(6, d, done, next)).toBe("soon");
  });
});

describe("canOpenDay / firstSoonDay", () => {
  it("opens published or done days only", () => {
    expect(canOpenDay(5, dias(5), [])).toBe(true);
    expect(canOpenDay(6, dias(5), [])).toBe(false);
    expect(canOpenDay(6, dias(5), [6])).toBe(true);
    expect(canOpenDay(0, dias(5), [])).toBe(false);
  });

  it("finds the first soon day, skipping done ones", () => {
    expect(firstSoonDay(dias(5), [1, 2, 3, 4, 5])).toBe(6);
    expect(firstSoonDay(dias(5), [6])).toBe(7);
    expect(firstSoonDay(dias(15), [])).toBeNull();
  });
});

describe("doneMessage", () => {
  it("all 15 done wins", () => {
    expect(doneMessage(15, dias(15), ALL)).toBe("all");
    expect(doneMessage(4, dias(15), ALL)).toBe("all");
  });

  it("last day with others missing", () => {
    expect(doneMessage(15, dias(15), [15])).toBe("lastMissing");
  });

  it("next published and not done", () => {
    expect(doneMessage(4, dias(5), [4])).toBe("nextOpen");
  });

  it("next not published", () => {
    expect(doneMessage(5, dias(5), [5])).toBe("nextSoon");
  });

  it("next published and already done", () => {
    expect(doneMessage(4, dias(5), [4, 5])).toBe("nextDone");
  });
});

describe("routing", () => {
  it("parses the design's hashes", () => {
    expect(parseRouteHash("#/dia/5")).toEqual({ screen: "dia", n: 5 });
    expect(parseRouteHash("#/cierre")).toEqual({ screen: "cierre" });
    expect(parseRouteHash("")).toEqual({ screen: "inicio" });
    expect(parseRouteHash("#/dia/16")).toEqual({ screen: "inicio" });
    expect(parseRouteHash("#/dia/abc")).toEqual({ screen: "inicio" });
    expect(parseRouteHash("#/otra")).toEqual({ screen: "inicio" });
  });

  it("round-trips", () => {
    for (const hash of ["#/dia/1", "#/dia/15", "#/cierre", ""]) {
      expect(routeHash(parseRouteHash(hash))).toBe(hash);
    }
  });

  it("falls back to inicio for days that can't be opened and an early cierre", () => {
    expect(resolveRoute({ screen: "dia", n: 9 }, dias(5), [])).toEqual({ screen: "inicio" });
    expect(resolveRoute({ screen: "dia", n: 9 }, dias(5), [9])).toEqual({ screen: "dia", n: 9 });
    expect(resolveRoute({ screen: "cierre" }, dias(15), [1])).toEqual({ screen: "inicio" });
    expect(resolveRoute({ screen: "cierre" }, dias(15), ALL)).toEqual({ screen: "cierre" });
  });
});
