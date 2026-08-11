import { describe, expect, it } from "vitest";
import {
  buildReminderEmailHtml,
  buildTicketEmailHtml,
  type TicketForEmail,
} from "./brote-email";
import { renderBroteVerificationEmail } from "./brote-verification-email";
import { artOfLivingInstagram } from "@/data/brote";
import { collaboratorNameUrl, getInvitation } from "./brote-invitations";
import es from "@/dictionaries/es";

// Annotated, not cast: a cast would let the fixture drop a required field and
// keep compiling if the type gained one, so the template could start reading
// something this fixture never supplies and render `undefined` while the suite
// stayed green.
const tickets: TicketForEmail[] = [
  { ticketId: "BROTE-TESTAAAA", treeNumber: 37 },
];

const reminder = buildReminderEmailHtml(37);
const ticketEmail = buildTicketEmailHtml(tickets, "Persona de Prueba");

/** The anchor `collaboratorLink()` produces for a slug, rebuilt from source. */
function linkFor(slug: string): string {
  const invitation = getInvitation(slug)!;
  return `<a href="${collaboratorNameUrl(invitation)}" style="color:#2D4A3E;text-decoration:underline">${invitation.name}</a>`;
}

describe("collaborator links in the day-of reminder", () => {
  // Each performer is bound to their OWN row, not just present somewhere in
  // the document. Asserting the bare names passes even when the two are
  // swapped between rows — which would tell every buyer that Gian plays
  // guitar at 19:45 and José does the dance intervention, inverted against
  // the landing. That is the failure this unit exists to prevent, so the
  // whole row fragment is what gets pinned.
  it.each([
    ["acoustic set", `Ac&uacute;stico en vivo &mdash; ${linkFor("jose")}`],
    ["Un Árbol moment", `Momento ${linkFor("unarbol")}`],
    ["dance intervention", `Experiencia de baile &mdash; ${linkFor("gian")}`],
  ])("puts the right collaborator on the %s row", (_label, fragment) => {
    expect(reminder).toContain(fragment);
  });

  it("links El Arte de Vivir in the footer", () => {
    // Website on the landing, Instagram in the mail — both surfaces used.
    expect(reminder).toContain(`href="${artOfLivingInstagram}"`);
  });
});

describe("the run of show agrees with the landing", () => {
  // The mail used to say 19:45 and 21:30 while the landing said 20:00 and
  // 21:15 — so on the morning of the event every buyer was told the music
  // starts before the page they bought from says it does. Asserted against
  // the dictionary, not against literals, so the two move together.
  const clock = (blockTime: string) => blockTime.split("·")[0].trim();

  it.each([
    ["doors", es.brote.lineup.welcome.time],
    ["acoustic set", es.brote.lineup.live.time],
    ["closing set", es.brote.lineup.dj.time],
  ])("announces the %s at the time the landing announces", (_label, blockTime) => {
    expect(reminder).toContain(`>${clock(blockTime)}<`);
  });

  it("never announces the times the landing no longer uses", () => {
    // Pinned explicitly: these are the two that shipped wrong, and a partial
    // fix that updated one row and not the other would otherwise pass.
    expect(reminder).not.toContain(">19:45<");
    expect(reminder).not.toContain(">21:30<");
  });
});

describe("collaborator links in the ticket email", () => {
  it("links El Arte de Vivir in the footer", () => {
    expect(ticketEmail).toContain(`href="${artOfLivingInstagram}"`);
  });
});

describe("collaborator links in the verification email", () => {
  it("links El Arte de Vivir in the footer too", () => {
    // The third of the three footers this unit claims to link. Without this,
    // reverting that hunk — or re-pointing it at the website and quietly
    // dropping the "Instagram in the mail" decision — leaves the suite green.
    const { html } = renderBroteVerificationEmail({
      email: "test@example.com",
      code: "123456",
      name: "Persona de Prueba",
      locale: "es",
    });

    expect(html).toContain(`href="${artOfLivingInstagram}"`);
    expect(html).toContain("El Arte de Vivir");
  });
});

describe("both templates render cleanly", () => {
  it.each([
    ["reminder", reminder],
    ["ticket", ticketEmail],
  ])("%s leaves no unresolved interpolation", (_name, html) => {
    // `collaboratorLink()` returns "" for an unknown slug, so a typo'd slug
    // would silently erase the name rather than throw. These pin that the
    // rendered mail has no holes.
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("href=\"\"");
    expect(html).not.toMatch(/\$\{/);
  });
});
