import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTicketEmailHtml } from "./brote-email";

/**
 * The ticket email is the only thing a buyer receives, and it is the live
 * path right now with the event selling. U2 turns its single ticket into a
 * list; the one thing that must NOT change while doing that is what a
 * one-ticket buyer gets.
 */

const GOLDEN = readFileSync(
  join(__dirname, "__fixtures__/brote-ticket-email-n1.golden.html"),
  "utf8",
);

describe("buildTicketEmailHtml", () => {
  it("T2.4 — a single ticket renders byte-identically to before U2 (pin)", () => {
    // The fixture was generated from `main` BEFORE this unit touched
    // anything. Byte equality, not 'contains the id': the failure this
    // guards against is a layout or copy regression in the mail that
    // hundreds of people have already received.
    const html = buildTicketEmailHtml(
      [{ ticketId: "BROTE2-SNAP0001", treeNumber: 42 }],
      "Ana González",
    );
    expect(html).toBe(GOLDEN);
  });

  it("T2.4b — the single-ticket QR keeps contentId 'qr', not 'qr1'", () => {
    // Naming the attachments qr1..qrN would silently break T2.4: the N=1
    // HTML becomes cid:qr1 and every already-sent email's structure drifts.
    // First stays `qr`, siblings are qr2..qrN.
    const html = buildTicketEmailHtml(
      [{ ticketId: "BROTE2-SNAP0001", treeNumber: 42 }],
      "Ana",
    );
    expect(html).toContain('src="cid:qr"');
    expect(html).not.toContain("cid:qr1");
  });

  it("renders one QR block per ticket, each with its own id and tree number", () => {
    const html = buildTicketEmailHtml(
      [
        { ticketId: "BROTE2-AAA", treeNumber: 41 },
        { ticketId: "BROTE2-BBB", treeNumber: 42 },
      ],
      "Ana",
    );
    expect(html).toContain("BROTE2-AAA");
    expect(html).toContain("BROTE2-BBB");
    expect(html).toContain("#41");
    expect(html).toContain("#42");
    expect(html).toContain('src="cid:qr"');
    expect(html).toContain('src="cid:qr2"');
  });

  // brote-email.ts interpolated without escaping (documented in
  // tasks/lessons.md). The buyer name is user-supplied via MercadoPago and
  // via the /success contact step; U5 adds guest names, a second
  // uncontrolled string per ticket.
  //
  // Both ticket counts are exercised on purpose: the guest name renders
  // through a DIFFERENT branch for one ticket than for several, and testing
  // only the single-ticket path leaves the other unescaped — verified, the
  // mutation that drops escaping from the multi branch survives otherwise.
  it.each([
    ["a single ticket", 1],
    ["several tickets", 3],
  ])("escapes a guest name that would inject markup — %s", (_label, count) => {
    const tickets = Array.from({ length: count }, (_, i) => ({
      ticketId: `BROTE2-${i}`,
      treeNumber: i + 1,
      guestName: i === 0 ? "<script>x</script>" : `Guest ${i}`,
    }));
    const html = buildTicketEmailHtml(tickets, "Ana");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the buyer name too", () => {
    const html = buildTicketEmailHtml(
      [{ ticketId: "BROTE2-AAA", treeNumber: 1 }],
      'Ana "><img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
