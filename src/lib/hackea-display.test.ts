import { describe, it, expect } from "vitest";
import { hackeaDisplay } from "./hackea-display";

describe("hackeaDisplay", () => {
  it("renders the design's strings from the live config", () => {
    expect(hackeaDisplay()).toEqual({
      stamp: "29.OCT",
      stampTime: "19H00",
      longDate: "Jueves 29 de octubre",
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
    expect(d.placeShort).toBe("Av. Corrientes 1234 · Almagro");
  });
});
