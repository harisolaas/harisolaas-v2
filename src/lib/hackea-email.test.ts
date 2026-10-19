import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHackeaBuyerConfirmationHtml,
  buildHackeaHostNotificationHtml,
  hackeaDateLabel,
  hackeaGreetingWaMeUrl,
  hackeaHostSubject,
} from "./hackea-email";

/**
 * Golden fixtures pin both mails byte for byte. To regenerate after an
 * intended copy/layout change: `UPDATE_GOLDEN=1 npx vitest run
 * src/lib/hackea-email.test.ts`, then review the diff of the .html files.
 */
function golden(name: string, html: string) {
  const path = join(__dirname, "__fixtures__", name);
  if (process.env.UPDATE_GOLDEN === "1") {
    writeFileSync(path, html);
  }
  expect(html).toBe(readFileSync(path, "utf8"));
}

describe("hackea emails", () => {
  it("buyer confirmation matches the golden fixture", () => {
    golden(
      "hackea-buyer-email.golden.html",
      buildHackeaBuyerConfirmationHtml({
        name: "Lucía Fernández",
        participationId: "HTM-ABCD1234",
      }),
    );
  });

  it("host notification matches the golden fixture", () => {
    golden(
      "hackea-host-email.golden.html",
      buildHackeaHostNotificationHtml({
        name: "Lucía Fernández",
        phone: "+5491122334455",
        email: "lucia@example.com",
        participationId: "HTM-ABCD1234",
        amountCents: 2_130_000,
        totalConfirmed: 12,
      }),
    );
  });

  it("buyer mail carries entrada, date, address, maps link and the WhatsApp line, with no ebook delivery promise", () => {
    const html = buildHackeaBuyerConfirmationHtml({
      name: "Lucía",
      participationId: "HTM-ABCD1234",
    });
    expect(html).toContain("HTM-ABCD1234");
    expect(html).toContain("Jueves 29 de octubre");
    expect(html).toContain("19:00");
    expect(html).toContain("Costa Rica 5644");
    expect(html).toContain("https://www.google.com/maps/search/");
    expect(html).toContain("Te escribimos por WhatsApp");
    expect(html).not.toMatch(/ebook/i);
    expect(html).toContain("https://wa.me/5491122555110");
    // House rules: no exclamation marks in the copy.
    expect(html.replace("<!DOCTYPE html>", "")).not.toMatch(/[!¡]/);
  });

  it("escapes buyer-typed names and emails", () => {
    const evil = `<script>alert("x")</script>`;
    const buyer = buildHackeaBuyerConfirmationHtml({
      name: evil,
      participationId: "HTM-ABCD1234",
    });
    const host = buildHackeaHostNotificationHtml({
      name: evil,
      phone: "+5491122334455",
      email: `a"><img src=x>@x.com`,
      participationId: "HTM-ABCD1234",
      amountCents: 2_130_000,
      totalConfirmed: 1,
    });
    for (const html of [buyer, host]) {
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    }
    expect(host).not.toContain(`"><img`);
  });

  it("host mail without email or phone says so instead of linking", () => {
    const html = buildHackeaHostNotificationHtml({
      name: "Tomás",
      phone: null,
      email: null,
      participationId: "HTM-ABCD1234",
      amountCents: 2_130_000,
      totalConfirmed: 1,
    });
    expect(html).toContain("sin email");
    expect(html).toContain("sin WhatsApp");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("mailto:");
  });

  it("wa.me link has international digits and a URL-encoded voseo greeting", () => {
    const url = hackeaGreetingWaMeUrl("11 2233-4455", "Lucía Fernández");
    expect(url.startsWith("https://wa.me/5491122334455?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toBe(
      "Hola Lucía, soy Hari. Gracias por sumarte a Hackeá tu mente. Te escribo para pasarte los detalles del jueves 29 de octubre.",
    );
    expect(url).not.toContain(" ");
  });

  it("date label is derived from the config date", () => {
    expect(hackeaDateLabel("2026-10-29")).toBe("Jueves 29 de octubre");
    expect(hackeaDateLabel("2026-03-28")).toBe("Sábado 28 de marzo");
  });

  it("host subject collapses buyer-typed whitespace (no newlines in a header)", () => {
    expect(hackeaHostSubject("  Lucía \r\n  Fernández\t ")).toBe(
      "Nueva entrada Hackeá tu mente — Lucía Fernández",
    );
  });
});
