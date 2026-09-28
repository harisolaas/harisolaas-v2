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

const START = "2026-09-28";
const BEFORE = new Date("2026-09-20T12:00:00Z");
const LIVE = new Date("2026-09-30T12:00:00Z");

describe("desafío confirmation email", () => {
  const original = desafioConfig.whatsappGroupUrl;
  afterEach(() => {
    desafioConfig.whatsappGroupUrl = original;
  });

  it("links to the locale's landing and shows the formatted start date", () => {
    const es = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: START, now: BEFORE });
    expect(es).toContain("/es/desafio");
    expect(es).toContain("lunes 28 de septiembre");
    expect(es).toContain("El desafío arranca el");
    expect(es).toContain("Hola, Luz.");

    const en = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "en", startDate: START, now: BEFORE });
    expect(en).toContain("/en/desafio");
    expect(en).toContain("Monday, September 28");
    expect(en).toContain("starts on");
  });

  it("says the challenge already started when signing up mid-challenge", () => {
    const es = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: START, now: LIVE });
    expect(es).toContain("El desafío empezó el lunes 28 de septiembre");
    expect(es).not.toContain("arranca el");

    const en = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "en", startDate: START, now: LIVE });
    expect(en).toContain("started on Monday, September 28");
    expect(en).not.toContain("starts on");
  });

  it("escapes the name", () => {
    const html = buildDesafioConfirmationEmailHtml({ name: "<img src=x>", locale: "es", startDate: START, now: BEFORE });
    expect(html).not.toContain("<img src=x>");
  });

  it("inserts the name literally, without String.replace $-patterns", () => {
    // "$`" / "$&" are special in a string replacement: without a replacer
    // function, "$`" would splice "Hola, " back in and "$&" would echo "{name}".
    const html = buildDesafioConfirmationEmailHtml({ name: "A$`B$&C", locale: "es", startDate: START, now: BEFORE });
    expect(html).toContain("Hola, A$`B$&amp;C.");
  });

  it("only renders the WhatsApp group button when a URL is configured", () => {
    desafioConfig.whatsappGroupUrl = "";
    expect(
      buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: START, now: BEFORE }),
    ).not.toContain("Sumarme al grupo de WhatsApp");

    desafioConfig.whatsappGroupUrl = "https://chat.whatsapp.com/abc";
    const html = buildDesafioConfirmationEmailHtml({ name: "Luz", locale: "es", startDate: START, now: BEFORE });
    expect(html).toContain("Sumarme al grupo de WhatsApp");
    expect(html).toContain("https://chat.whatsapp.com/abc");
  });

  it("has non-empty subjects that differ by locale", () => {
    expect(desafioConfirmationSubject("es")).toBeTruthy();
    expect(desafioConfirmationSubject("en")).toBeTruthy();
    expect(desafioConfirmationSubject("es")).not.toBe(desafioConfirmationSubject("en"));
  });
});
