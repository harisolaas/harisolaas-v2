import { describe, expect, it } from "vitest";
import en from "@/dictionaries/en";
import es from "@/dictionaries/es";
import { INVITATION_SLUGS, getInvitation } from "./brote-invitations";

/**
 * The `Dictionary` type gives shape parity between es and en, but it cannot
 * see an empty string — and a missing `roleLine` is invisible by design: the
 * page just omits the element. So the failure mode is a live page for a real
 * collaborator with nothing where their line should be, and nobody notices
 * until they see their own link.
 *
 * `dictionaries.test.ts` does NOT cover this: it hardcodes the `mentoria`
 * and `now` sections.
 */

const dicts = [
  { locale: "es", dict: es },
  { locale: "en", dict: en },
] as const;

describe.each(dicts)("$locale — invitation copy", ({ dict }) => {
  it("has a non-empty roleLine and closingLine for every collaborator", () => {
    for (const slug of INVITATION_SLUGS) {
      const entry = dict.broteInvitacion.collaborators[slug];
      expect(entry, `missing entry for ${slug}`).toBeDefined();
      expect(entry.roleLine.trim(), `${slug}.roleLine`).not.toBe("");
      expect(entry.closingLine.trim(), `${slug}.closingLine`).not.toBe("");
    }
  });

  it("has no collaborator entries that aren't real collaborators", () => {
    // A stale key here is a line of copy nobody will ever see, and a rename
    // that silently stops rendering.
    for (const key of Object.keys(dict.broteInvitacion.collaborators)) {
      expect(getInvitation(key), `unknown collaborator "${key}"`).not.toBeNull();
    }
  });

  it("keeps the fixed blocks filled", () => {
    const d = dict.broteInvitacion;
    expect(d.about.paragraphs).toHaveLength(2);
    expect(d.about.facts).toHaveLength(3);
    expect(d.includes.items).toHaveLength(4);
    for (const item of d.includes.items) {
      expect(item.title.trim()).not.toBe("");
      expect(item.description.trim()).not.toBe("");
    }
  });
});

describe("es — Argentine conventions", () => {
  const strings = JSON.stringify(es.broteInvitacion);

  it("uses voseo, not tuteo", () => {
    // The site speaks like an Argentine friend. These are the tuteo forms
    // most likely to slip in from a neutral-Spanish draft.
    for (const tuteo of ["tú ", "tienes", "quieres", "puedes", "vienes"]) {
      expect(strings.toLowerCase(), `tuteo: ${tuteo}`).not.toContain(tuteo);
    }
  });

  it("avoids gendered forms", () => {
    for (const gendered of ["bienvenido", "bienvenida", "anotado", "invitados"]) {
      expect(strings.toLowerCase(), `gendered: ${gendered}`).not.toContain(
        gendered,
      );
    }
  });

  it("does not carry the first edition's date into the copy", () => {
    // The design handoff was written for the 28 March edition; its closing
    // lines said "nos vemos el 28". This event is 20 August.
    expect(strings).not.toContain("28 MAR");
    expect(strings.toLowerCase()).not.toContain("el 28");
    expect(strings.toLowerCase()).not.toContain("marzo");
  });
});
