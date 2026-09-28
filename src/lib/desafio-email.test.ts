import { afterEach, describe, expect, it } from "vitest";
import { desafioConfig } from "@/data/desafio";
import {
  buildDesafioConfirmationEmailHtml,
  buildDesafioHostNotificationHtml,
  desafioConfirmationSubject,
} from "./desafio-email";

const host = (over: Partial<Parameters<typeof buildDesafioHostNotificationHtml>[0]> = {}) =>
  buildDesafioHostNotificationHtml({
    name: "Luz Benítez",
    email: "luz@example.com",
    phone: "11 2255 5110",
    locale: "es",
    totalRegistered: 7,
    ...over,
  });

describe("desafío host notification", () => {
  it("renders the phone as a tappable wa.me link", () => {
    const html = host();
    expect(html).toContain('href="https://wa.me/5491122555110"');
    expect(html).toContain("11 2255 5110");
    expect(html).toContain("mailto:luz@example.com");
    expect(html).toContain("Inscripciones");
    expect(html).toContain(">7<");
  });

  it("escapes user-supplied values", () => {
    const html = host({
      name: "<script>alert(1)</script>",
      email: 'x"@example.com',
      phone: "11 2255 5110<b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('x"@example.com');
    expect(html).not.toContain("<b>");
  });
});

describe("desafío confirmation email", () => {
  const original = desafioConfig.whatsappGroupUrl;
  afterEach(() => {
    desafioConfig.whatsappGroupUrl = original;
  });

  it("links to the locale's landing and shows the formatted start date", () => {
    const es = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: "2026-10-12" });
    expect(es).toContain("/es/desafio");
    expect(es).toContain("lunes 12 de octubre");
    expect(es).toContain("Hola, Luz.");

    const en = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "en", startDate: "2026-10-12" });
    expect(en).toContain("/en/desafio");
    expect(en).toContain("Monday, October 12");
  });

  it("escapes the name", () => {
    const html = buildDesafioConfirmationEmailHtml({ name: "<img src=x>", locale: "es", startDate: "2026-10-12" });
    expect(html).not.toContain("<img src=x>");
  });

  it("only renders the WhatsApp group button when a URL is configured", () => {
    desafioConfig.whatsappGroupUrl = "";
    expect(
      buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: "2026-10-12" }),
    ).not.toContain("Sumarme al grupo de WhatsApp");

    desafioConfig.whatsappGroupUrl = "https://chat.whatsapp.com/abc";
    const html = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: "2026-10-12" });
    expect(html).toContain("Sumarme al grupo de WhatsApp");
    expect(html).toContain("https://chat.whatsapp.com/abc");
  });

  it("has non-empty subjects that differ by locale", () => {
    expect(desafioConfirmationSubject("es")).toBeTruthy();
    expect(desafioConfirmationSubject("en")).toBeTruthy();
    expect(desafioConfirmationSubject("es")).not.toBe(desafioConfirmationSubject("en"));
  });
});
