import { describe, it, expect } from "vitest";
import { hackeaConfig } from "@/data/hackea";
import { hackeaDisplay, isHackeaSalesOpen } from "./hackea-display";

describe("hackeaDisplay", () => {
  it("renders the design's strings from the live config", () => {
    expect(hackeaDisplay()).toEqual({
      stamp: "29.OCT",
      stampTime: "19H00",
      longDate: "Jueves 29 de octubre",
      dayNum: "29",
      time: "19:00 h",
      placeFull: "Costa Rica 5644 · Palermo, Buenos Aires",
      placeShort: "Costa Rica 5644 · Palermo",
    });
  });

  it("follows the config when the date or venue changes", () => {
    const d = hackeaDisplay({
      date: "2027-03-05",
      startTime: "20:30",
      exactAddress: "Av. Corrientes 1234, Almagro, Buenos Aires",
      neighborhood: "Almagro, Buenos Aires",
    });
    expect(d.stamp).toBe("5.MAR");
    expect(d.stampTime).toBe("20H30");
    expect(d.longDate).toBe("Viernes 5 de marzo");
    expect(d.dayNum).toBe("5");
    expect(d.placeShort).toBe("Av. Corrientes 1234 · Almagro");
  });
});

describe("isHackeaSalesOpen", () => {
  const start = Date.parse(hackeaConfig.startIso);

  it("is open before the talk starts and at the start instant", () => {
    expect(isHackeaSalesOpen(new Date(start - 60_000))).toBe(true);
    expect(isHackeaSalesOpen(new Date(start))).toBe(true);
  });

  it("closes once the talk has started", () => {
    expect(isHackeaSalesOpen(new Date(start + 1))).toBe(false);
    expect(isHackeaSalesOpen(new Date(start + 86_400_000))).toBe(false);
  });

  it("reads startIso as Argentina time, not server-local", () => {
    const config = { startIso: "2027-03-05T20:30:00-03:00" };
    expect(isHackeaSalesOpen(new Date("2027-03-05T23:29:59Z"), config)).toBe(true);
    expect(isHackeaSalesOpen(new Date("2027-03-05T23:30:01Z"), config)).toBe(false);
  });
});
