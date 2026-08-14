import { describe, expect, it } from "vitest";
import { broteConfig, currentTicketPrice } from "@/data/brote";
import { getInvitation, resolveInvitationPrice } from "./brote-invitations";
import {
  firstName,
  renderComunidadEmail,
  segmentOf,
  waveCtaUrl,
  waveLinkSlug,
  type ComunidadRecipient,
  type ComunidadWave,
} from "./brote-comunidad-email";

const WAVES: ComunidadWave[] = [1, 2, 3];

/** Last day of the preventa — the day wave 1 is scheduled to go out. */
const DEADLINE_DAY = new Date("2026-08-13T13:00:00-03:00");
/** After the preventa closed — where waves 2 and 3 land. */
const AFTER_DEADLINE = new Date("2026-08-17T19:30:00-03:00");

const SEGMENTS: Record<string, ComunidadRecipient> = {
  brote1: { name: "Ana", cameToBrote1: true, cameToPlant: false },
  plant: { name: "Ana", cameToBrote1: false, cameToPlant: true },
  both: { name: "Ana", cameToBrote1: true, cameToPlant: true },
};

const comunidadPrice = (now: Date) =>
  resolveInvitationPrice(getInvitation("comunidad"), now).priceDisplay;

describe("comunidad email — segment routing", () => {
  it("maps every flag combination to exactly one segment", () => {
    expect(segmentOf({ cameToBrote1: true, cameToPlant: false })).toBe("brote1");
    expect(segmentOf({ cameToBrote1: false, cameToPlant: true })).toBe("plant");
    expect(segmentOf({ cameToBrote1: true, cameToPlant: true })).toBe("both");
    // Only reachable via a hand-typed audienceOverride address. It must still
    // produce a sendable mail rather than an empty paragraph.
    expect(segmentOf({ cameToBrote1: false, cameToPlant: false })).toBe(
      "brote1",
    );
  });

  it("gives wave 1 a different opening paragraph per segment", () => {
    const openings = Object.values(SEGMENTS).map(
      (r) => renderComunidadEmail(1, r, DEADLINE_DAY).html,
    );
    expect(openings[0]).toContain("El 28 de marzo estuviste. Bailaste");
    expect(openings[1]).toContain("El 19 de abril te fuiste hasta la reserva");
    expect(openings[2]).toContain("Estuviste en las dos");
  });

  it("gives wave 2 the closing line that matches what they saw", () => {
    expect(renderComunidadEmail(2, SEGMENTS.brote1, AFTER_DEADLINE).html).toContain(
      "Ya sabés cómo termina esto.",
    );
    expect(renderComunidadEmail(2, SEGMENTS.plant, AFTER_DEADLINE).html).toContain(
      "La fiesta te la contaron",
    );
  });
});

describe("comunidad email — prices come from config, never typed", () => {
  it.each(WAVES)("wave %i quotes the live invitation price", (wave) => {
    const { html } = renderComunidadEmail(wave, SEGMENTS.both, AFTER_DEADLINE);
    expect(html).toContain(comunidadPrice(AFTER_DEADLINE));
  });

  it("wave 1 shows the regular price struck through, from config", () => {
    const { html } = renderComunidadEmail(1, SEGMENTS.both, DEADLINE_DAY);
    expect(html).toContain(broteConfig.ticketPrice);
    expect(html).toContain("line-through");
  });

  it("wave 1 renders the discount from the registry, not a literal", () => {
    const { html } = renderComunidadEmail(1, SEGMENTS.both, DEADLINE_DAY);
    expect(html).toContain(`-${getInvitation("comunidad")!.discountPct}%`);
  });

  it("wave 2 quotes what the public pays right now", () => {
    const { html } = renderComunidadEmail(2, SEGMENTS.both, AFTER_DEADLINE);
    expect(html).toContain(currentTicketPrice(AFTER_DEADLINE).display);
  });

  /**
   * The guard that actually matters: a literal price in the template survives
   * a config change silently and the mail starts quoting a number the
   * checkout will not charge. Asserting "the number appears" cannot catch
   * that — only asserting the source can.
   */
  it("has no hardcoded peso amount anywhere in the rendered mail", () => {
    const allowed = new Set([
      comunidadPrice(DEADLINE_DAY),
      broteConfig.ticketPrice,
      broteConfig.earlyBirdPrice,
      currentTicketPrice(DEADLINE_DAY).display,
    ]);
    for (const wave of WAVES) {
      const { html } = renderComunidadEmail(wave, SEGMENTS.both, DEADLINE_DAY);
      // Argentine formatting: dots group thousands, so the pattern has to stop
      // before a sentence-ending period rather than swallowing it.
      const amounts = html.match(/\$\d{1,3}(?:\.\d{3})*/g) ?? [];
      for (const amount of amounts) {
        expect(allowed, `wave ${wave} quotes an unexpected ${amount}`).toContain(
          amount,
        );
      }
    }
  });
});

describe("comunidad email — the price-rise line stays true on any send day", () => {
  it("says 'mañana' only on the deadline day itself", () => {
    const { html } = renderComunidadEmail(1, SEGMENTS.both, DEADLINE_DAY);
    expect(html).toContain("Mañana, 14 de agosto, la entrada pasa a");
  });

  it("names the date instead when the send goes out early", () => {
    const early = new Date("2026-08-10T10:00:00-03:00");
    const { html } = renderComunidadEmail(1, SEGMENTS.both, early);
    expect(html).toContain("El 14 de agosto la entrada pasa a");
    expect(html).not.toContain("Mañana, 14 de agosto");
  });

  it("switches to the past tense once the preventa has closed", () => {
    const { html } = renderComunidadEmail(1, SEGMENTS.both, AFTER_DEADLINE);
    expect(html).toContain("Desde el 14 de agosto la entrada está");
    expect(html).not.toContain("pasa a");
  });
});

describe("comunidad email — name handling", () => {
  it.each([
    ["", ""],
    ["   ", ""],
    ["Asistente", ""],
    ["asistente", ""],
    ["no-reply@example.com", ""],
    ["Ana María Pérez", "Ana"],
    ["  Juan  ", "Juan"],
  ])("firstName(%j) → %j", (input, expected) => {
    expect(firstName(input)).toBe(expected);
  });

  it("greets by first name when there is one", () => {
    const { html } = renderComunidadEmail(
      1,
      { name: "Ana María", cameToBrote1: true, cameToPlant: false },
      DEADLINE_DAY,
    );
    expect(html).toContain("para vos, Ana.");
  });

  it("drops the greeting rather than saying 'Hola, Asistente'", () => {
    const { html } = renderComunidadEmail(
      1,
      { name: "Asistente", cameToBrote1: true, cameToPlant: false },
      DEADLINE_DAY,
    );
    expect(html).toContain("Tenemos un regalo<br>para vos.");
    expect(html).not.toContain("Asistente");
  });

  it("escapes the name — it arrives from MercadoPago, not from us", () => {
    const { html } = renderComunidadEmail(
      1,
      {
        name: '<script>alert("x")</script>',
        cameToBrote1: true,
        cameToPlant: false,
      },
      DEADLINE_DAY,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("comunidad email — links and structure", () => {
  it.each(WAVES)("wave %i sends every click through its own /go/ slug", (wave) => {
    const { html } = renderComunidadEmail(wave, SEGMENTS.both, AFTER_DEADLINE);
    expect(waveLinkSlug(wave)).toBe(`email-comunidad-w${wave}`);
    expect(html).toContain(waveCtaUrl(wave));
    // Not "the production URL is absent" — that assertion passes for the
    // wrong reason whenever NEXT_PUBLIC_BASE_URL differs. What must never
    // appear is a link straight to the invitation path, whatever the host:
    // it would land the sale on `inv-comunidad` and the wave would report
    // zero conversions.
    expect(html).not.toMatch(/href="[^"]*\/brote\/invitacion\//);
  });

  it.each(WAVES)("wave %i has a subject and a preheader", (wave) => {
    const { subject, html } = renderComunidadEmail(
      wave,
      SEGMENTS.both,
      AFTER_DEADLINE,
    );
    expect(subject.trim().length).toBeGreaterThan(0);
    // Not a mobile-truncation guard any more: wave 1 deliberately runs long
    // (Hari's line, his call), and the first ~40 characters still read as a
    // whole promise. What this bound protects is the mail itself — past ~78
    // some clients fold or clip the header outright.
    expect(subject.length).toBeLessThanOrEqual(78);
    expect(html).toMatch(/mso-hide:all">[^<]+</);
  });

  it.each(WAVES)("wave %i offers a way out — this is marketing", (wave) => {
    const { html } = renderComunidadEmail(wave, SEGMENTS.both, AFTER_DEADLINE);
    expect(html).toContain("respondé BAJA");
  });

  it("builds wave 2's subject from the registry, not from a typed name", () => {
    const { subject } = renderComunidadEmail(2, SEGMENTS.both, AFTER_DEADLINE);
    // The subject is the half of the mail most people read; if the line-up
    // changes, it has to move with it.
    expect(subject).toContain(getInvitation("jose")!.name.split(" ")[0]);
  });

  it("takes the running order from the landing, so it cannot drift", () => {
    const { html } = renderComunidadEmail(2, SEGMENTS.both, AFTER_DEADLINE);
    // Rendered as "20:00 — En vivo": the dictionary's separator is swapped,
    // the clock is not.
    expect(html).toContain("20:00");
    expect(html).toContain("21:15");
    expect(html).toContain("José Dezanzo");
    expect(html).toContain("Gian Bejarano");
  });

  it("names the venue and date from config", () => {
    const { html } = renderComunidadEmail(3, SEGMENTS.both, AFTER_DEADLINE);
    expect(html).toContain(broteConfig.locationAddress);
    expect(html).toContain(broteConfig.eventDateDisplay);
  });
});

describe("comunidad email — house copy rules", () => {
  /**
   * The repo's Spanish is gender-agnostic and voseo. The landing dictionary
   * still carries one "solo/a" (in `lineup.welcome.body1`) — wave 2 rewrites
   * that block rather than inheriting it, and this test is what keeps the
   * rewrite from being quietly reverted to the dictionary version.
   */
  const BANNED = [
    "solo/a",
    "sola/o",
    "bienvenido",
    "bienvenida",
    "anotado/a",
    "todos ",
  ];

  it.each(WAVES)("wave %i uses no gendered forms", (wave) => {
    const { html, subject } = renderComunidadEmail(
      wave,
      SEGMENTS.both,
      AFTER_DEADLINE,
    );
    const text = `${subject} ${html}`.toLowerCase();
    for (const banned of BANNED) {
      expect(text, `wave ${wave} contains "${banned}"`).not.toContain(banned);
    }
  });

  it.each(WAVES)("wave %i uses voseo, not tuteo", (wave) => {
    const { html } = renderComunidadEmail(wave, SEGMENTS.both, AFTER_DEADLINE);
    const text = html.toLowerCase();
    for (const tuteo of [" tienes ", " quieres ", " puedes ", " tú "]) {
      expect(text, `wave ${wave} contains "${tuteo}"`).not.toContain(tuteo);
    }
  });
});
