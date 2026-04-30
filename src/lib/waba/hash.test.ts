import { describe, expect, it } from "vitest";
import { extractVariableNames, hashTemplateDefinition } from "./hash";
import type { WabaTemplateDefinition } from "./types";

const base: WabaTemplateDefinition = {
  name: "test_tpl",
  category: "utility",
  language: "es_AR",
  components: [
    {
      type: "BODY",
      text: "Hola {{name}}, hoy a las {{time}}.",
      example: {
        body_text_named_params: [
          { param_name: "name", example: "Ana" },
          { param_name: "time", example: "19:30" },
        ],
      },
    },
  ],
};

describe("extractVariableNames", () => {
  it("returns named placeholders in declaration order with no dupes", () => {
    expect(extractVariableNames(base)).toEqual(["name", "time"]);
  });

  it("merges variables across HEADER + BODY", () => {
    const def: WabaTemplateDefinition = {
      ...base,
      components: [
        { type: "HEADER", format: "TEXT", text: "{{title}}" },
        { type: "BODY", text: "Hola {{name}}, {{title}} hoy." },
      ],
    };
    // First-seen wins; duplicates collapse.
    expect(extractVariableNames(def)).toEqual(["title", "name"]);
  });

  it("ignores FOOTER text (footers cannot have variables on Meta)", () => {
    const def: WabaTemplateDefinition = {
      ...base,
      components: [
        ...base.components,
        { type: "FOOTER", text: "harisolaas.com" },
      ],
    };
    expect(extractVariableNames(def)).toEqual(["name", "time"]);
  });
});

describe("hashTemplateDefinition", () => {
  it("returns the same hash regardless of property order", () => {
    const def1: WabaTemplateDefinition = {
      name: "x",
      category: "utility",
      language: "es",
      components: [{ type: "BODY", text: "hi {{n}}" }],
    };
    const def2: WabaTemplateDefinition = {
      // properties intentionally in a different order; result must match
      language: "es",
      name: "x",
      components: [{ text: "hi {{n}}", type: "BODY" }],
      category: "utility",
    } as WabaTemplateDefinition;
    expect(hashTemplateDefinition(def1)).toBe(hashTemplateDefinition(def2));
  });

  it("changes when body text changes", () => {
    const def1: WabaTemplateDefinition = {
      name: "x",
      category: "utility",
      language: "es",
      components: [{ type: "BODY", text: "hi {{n}}" }],
    };
    const def2: WabaTemplateDefinition = {
      ...def1,
      components: [{ type: "BODY", text: "hello {{n}}" }],
    };
    expect(hashTemplateDefinition(def1)).not.toBe(hashTemplateDefinition(def2));
  });

  it("changes when category changes (since Meta may auto-promote)", () => {
    const def1: WabaTemplateDefinition = {
      name: "x",
      category: "utility",
      language: "es",
      components: [{ type: "BODY", text: "hi" }],
    };
    const def2: WabaTemplateDefinition = { ...def1, category: "marketing" };
    expect(hashTemplateDefinition(def1)).not.toBe(hashTemplateDefinition(def2));
  });
});
