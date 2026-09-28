import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  argentinaToday,
  challengeEndsAt,
  dayDate,
  desafioConfig,
  desafioPhase,
  desafioStartDate,
  formatDayDate,
  isDayUnlocked,
  isRegistrationOpen,
  unlockedDayCount,
} from "./desafio";

const START = "2026-10-12";

describe("desafio date math", () => {
  it("maps day numbers to calendar dates", () => {
    expect(dayDate(1, START)).toBe("2026-10-12");
    expect(dayDate(15, START)).toBe("2026-10-26");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-10-25", 10)).toBe("2026-11-04");
  });

  it("unlocks day 1 at 00:00 Argentina time, not a second earlier", () => {
    expect(isDayUnlocked(1, new Date("2026-10-12T02:59:59Z"), START)).toBe(false);
    expect(isDayUnlocked(1, new Date("2026-10-12T03:00:00Z"), START)).toBe(true);
  });

  it("unlocks day 15 at 00:00 Argentina time on its date", () => {
    expect(isDayUnlocked(15, new Date("2026-10-26T02:59:59Z"), START)).toBe(false);
    expect(isDayUnlocked(15, new Date("2026-10-26T03:00:00Z"), START)).toBe(true);
  });

  it("counts unlocked days, capped at totalDays", () => {
    expect(unlockedDayCount(new Date("2026-10-01T12:00:00Z"), START)).toBe(0);
    expect(unlockedDayCount(new Date("2026-10-14T12:00:00Z"), START)).toBe(3);
    expect(unlockedDayCount(new Date("2026-12-01T12:00:00Z"), START)).toBe(
      desafioConfig.totalDays,
    );
  });

  it("derives the phase", () => {
    expect(desafioPhase(new Date("2026-10-12T02:59:59Z"), START)).toBe("before");
    expect(desafioPhase(new Date("2026-10-12T03:00:00Z"), START)).toBe("live");
    expect(desafioPhase(new Date("2026-10-27T02:59:58Z"), START)).toBe("live");
    expect(desafioPhase(new Date("2026-10-27T03:00:00Z"), START)).toBe("after");
    expect(challengeEndsAt(START).toISOString()).toBe("2026-10-27T02:59:59.000Z");
  });

  it("closes registration exactly when the phase turns to after", () => {
    expect(isRegistrationOpen(new Date("2026-10-01T00:00:00Z"), START)).toBe(true);
    expect(isRegistrationOpen(new Date("2026-10-27T02:59:58Z"), START)).toBe(true);
    expect(isRegistrationOpen(new Date("2026-10-27T03:00:00Z"), START)).toBe(false);
  });

  it("formats dates per locale", () => {
    expect(formatDayDate("2026-10-12", "es")).toBe("lunes 12 de octubre");
    expect(formatDayDate("2026-10-12", "en")).toBe("Monday, October 12");
    expect(formatDayDate("2026-10-14", "es")).toBe("miércoles 14 de octubre");
  });

  it("computes the Argentina calendar date", () => {
    expect(argentinaToday(new Date("2026-10-13T02:30:00Z"))).toBe("2026-10-12");
    expect(argentinaToday(new Date("2026-10-13T03:00:00Z"))).toBe("2026-10-13");
  });
});

describe("desafioStartDate override", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the configured start", () => {
    vi.stubEnv("DESAFIO_START_DATE_OVERRIDE", "");
    expect(desafioStartDate()).toBe(desafioConfig.startDate);
  });

  it("honors the override outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DESAFIO_START_DATE_OVERRIDE", "2026-09-25");
    expect(desafioStartDate()).toBe("2026-09-25");
  });

  it("ignores the override in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DESAFIO_START_DATE_OVERRIDE", "2026-09-25");
    expect(desafioStartDate()).toBe(desafioConfig.startDate);
  });

  it("ignores a malformed override", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DESAFIO_START_DATE_OVERRIDE", "12/10/2026");
    expect(desafioStartDate()).toBe(desafioConfig.startDate);
  });
});
