import { describe, expect, it } from "vitest";
import { desafioConfig } from "./desafio";

// The event-level copy the public page renders from config (not the dict).

describe("desafioConfig", () => {
  it("points the WhatsApp button at a group invite", () => {
    const url = new URL(desafioConfig.whatsapp);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("chat.whatsapp.com");
    expect(url.pathname.length).toBeGreaterThan(1);
  });

  it("has every copy field filled", () => {
    for (const s of [
      desafioConfig.nombre,
      desafioConfig.guia,
      desafioConfig.bienvenida,
      desafioConfig.cierre.titulo,
      desafioConfig.cierre.texto,
    ]) {
      expect(s.trim()).not.toBe("");
    }
  });

  // CLAUDE.md: gender-agnostic Spanish. "juntos" in `nombre` is the product
  // name and an explicit exception; nothing else may use "/a" forms.
  it("avoids /a workarounds and gendered adjectives", () => {
    const text = [desafioConfig.bienvenida, desafioConfig.cierre.titulo, desafioConfig.cierre.texto]
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/\p{L}\/a\b/u);
    for (const w of ["atento", "atenta", "bienvenido", "bienvenida", "todos", "solo", "sola"]) {
      expect(text, w).not.toMatch(new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u"));
    }
  });
});
