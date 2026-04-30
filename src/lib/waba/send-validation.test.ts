import { describe, expect, it } from "vitest";
import { extractVariableNames } from "./hash";
import { validateVariables } from "./send";
import { SINERGIA_WEEKLY_REMINDER } from "./templates";
import { WabaClientError } from "./types";

describe("extractVariableNames (drives validateVariables)", () => {
  it("matches the real sinergia template's expected vars", () => {
    expect(extractVariableNames(SINERGIA_WEEKLY_REMINDER)).toEqual([
      "name",
      "time",
    ]);
  });
});

describe("validateVariables", () => {
  it("throws WabaClientError when a required key is missing", () => {
    expect(() =>
      validateVariables(SINERGIA_WEEKLY_REMINDER, { name: "Ana" }),
    ).toThrow(WabaClientError);
    expect(() =>
      validateVariables(SINERGIA_WEEKLY_REMINDER, { name: "Ana" }),
    ).toThrow(/time/);
  });

  it("throws WabaClientError when a required key is an empty string", () => {
    expect(() =>
      validateVariables(SINERGIA_WEEKLY_REMINDER, {
        name: "Ana",
        time: "",
      }),
    ).toThrow(/non-empty/);
  });

  it("tolerates extra keys the template doesn't reference", () => {
    expect(() =>
      validateVariables(SINERGIA_WEEKLY_REMINDER, {
        name: "Ana",
        time: "19:30",
        extra: "ignored",
      }),
    ).not.toThrow();
  });

  it("validates a multi-component template by aggregating placeholders", () => {
    expect(() =>
      validateVariables(
        {
          name: "test_tpl",
          category: "utility",
          language: "es",
          components: [
            { type: "HEADER", format: "TEXT", text: "{{title}}" },
            { type: "BODY", text: "Hola {{name}}, {{title}} hoy a las {{time}}." },
          ],
        },
        { title: "Sinergia", name: "Ana", time: "19:30" },
      ),
    ).not.toThrow();
  });
});
