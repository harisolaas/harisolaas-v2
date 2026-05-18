import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BUYER_NAME,
  resolveBuyerInfo,
  type CheckoutMetaLike,
  type MpPaymentLike,
} from "./mp-buyer-info";

function makeReaders(opts: {
  byPref?: Record<string, CheckoutMetaLike>;
  byEmail?: Record<string, CheckoutMetaLike>;
} = {}) {
  const byPref = opts.byPref ?? {};
  const byEmail = opts.byEmail ?? {};
  return {
    readStashByPreferenceId: vi.fn(async (id: string) => byPref[id] ?? null),
    readStashByEmail: vi.fn(async (email: string) => byEmail[email] ?? null),
  };
}

describe("resolveBuyerInfo", () => {
  it("prefers the preference-id stash when it exists", async () => {
    const payment: MpPaymentLike = {
      preference_id: "PREF-1",
      payer: { email: "buyer@example.com", first_name: "Wrong", last_name: "Source" },
      additional_info: { payer: { first_name: "AlsoWrong", last_name: "Source" } },
    };
    const readers = makeReaders({
      byPref: { "PREF-1": { name: "Real Name", email: "stash@example.com", phone: "+541122555110" } },
    });

    const out = await resolveBuyerInfo(payment, readers);

    expect(out.name).toBe("Real Name");
    expect(out.email).toBe("stash@example.com");
    expect(out.phone).toBe("+541122555110");
    expect(out.nameSource).toBe("stash-by-preference");
    expect(readers.readStashByEmail).not.toHaveBeenCalled();
  });

  it("falls back to the email-keyed stash when preference_id is missing", async () => {
    const payment: MpPaymentLike = {
      preference_id: null,
      payer: { email: "Buyer@Example.com" },
      additional_info: { payer: { first_name: null, last_name: null } },
    };
    const readers = makeReaders({
      byEmail: { "buyer@example.com": { name: "Salvador", phone: "+541199998888" } },
    });

    const out = await resolveBuyerInfo(payment, readers);

    expect(out.name).toBe("Salvador");
    expect(out.phone).toBe("+541199998888");
    expect(out.nameSource).toBe("stash-by-email");
    expect(readers.readStashByPreferenceId).not.toHaveBeenCalled();
    expect(readers.readStashByEmail).toHaveBeenCalledWith("buyer@example.com");
    expect(out.email).toBe("Buyer@Example.com");
  });

  it("falls back to additional_info.payer when no stash exists", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "tomas@example.com", first_name: null, last_name: null },
      additional_info: { payer: { first_name: "Tomas", last_name: "Aragón" } },
    };
    const readers = makeReaders();

    const out = await resolveBuyerInfo(payment, readers);

    expect(out.name).toBe("Tomas Aragón");
    expect(out.nameSource).toBe("additional-info-payer");
    expect(out.email).toBe("tomas@example.com");
    expect(out.phone).toBeUndefined();
  });

  it("trims and skips empty halves of additional_info.payer", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "x@y.com" },
      additional_info: { payer: { first_name: "  Tomas  ", last_name: "" } },
    };
    const out = await resolveBuyerInfo(payment, makeReaders());
    expect(out.name).toBe("Tomas");
    expect(out.nameSource).toBe("additional-info-payer");
  });

  it("falls back to payer.first_name + last_name when additional_info is empty", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "cc@example.com", first_name: "Maria", last_name: "García" },
      additional_info: { payer: { first_name: null, last_name: null } },
    };
    const out = await resolveBuyerInfo(payment, makeReaders());
    expect(out.name).toBe("Maria García");
    expect(out.nameSource).toBe("payer");
  });

  it("returns the 'Asistente' fallback when every source is empty", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "anon@example.com", first_name: null, last_name: null },
      additional_info: { payer: { first_name: null, last_name: null } },
    };
    const out = await resolveBuyerInfo(payment, makeReaders());
    expect(out.name).toBe(DEFAULT_BUYER_NAME);
    expect(out.nameSource).toBe("fallback");
    expect(out.email).toBe("anon@example.com");
    expect(out.phone).toBeUndefined();
  });

  it("does not consult the email stash when the preference stash already hit", async () => {
    const payment: MpPaymentLike = {
      preference_id: "PREF-2",
      payer: { email: "buyer@example.com" },
    };
    const readers = makeReaders({
      byPref: { "PREF-2": { name: "Pref" } },
      byEmail: { "buyer@example.com": { name: "Email" } },
    });
    const out = await resolveBuyerInfo(payment, readers);
    expect(out.name).toBe("Pref");
    expect(out.nameSource).toBe("stash-by-preference");
    expect(readers.readStashByEmail).not.toHaveBeenCalled();
  });

  it("normalizes the email key (lowercase + trim) before reading the email stash", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "  Buyer@Example.com  " },
    };
    const readers = makeReaders({
      byEmail: { "buyer@example.com": { name: "Casey" } },
    });
    const out = await resolveBuyerInfo(payment, readers);
    expect(out.name).toBe("Casey");
    expect(readers.readStashByEmail).toHaveBeenCalledWith("buyer@example.com");
  });

  it("treats a stash with whitespace-only name as missing and falls through", async () => {
    const payment: MpPaymentLike = {
      preference_id: "PREF-3",
      payer: { email: "x@example.com" },
      additional_info: { payer: { first_name: "Tomas", last_name: "Aragón" } },
    };
    const readers = makeReaders({
      byPref: { "PREF-3": { name: "   ", phone: "+541122555110" } },
    });
    const out = await resolveBuyerInfo(payment, readers);
    expect(out.name).toBe("Tomas Aragón");
    expect(out.nameSource).toBe("additional-info-payer");
    expect(out.phone).toBe("+541122555110");
  });

  it("consults the email stash when the preference stash has a blank name", async () => {
    const payment: MpPaymentLike = {
      preference_id: "PREF-blank",
      payer: { email: "buyer@example.com" },
    };
    const readers = makeReaders({
      byPref: { "PREF-blank": { name: "   ", phone: "+541122555110" } },
      byEmail: { "buyer@example.com": { name: "Salvador" } },
    });
    const out = await resolveBuyerInfo(payment, readers);
    expect(out.name).toBe("Salvador");
    expect(out.nameSource).toBe("stash-by-email");
    expect(out.phone).toBe("+541122555110");
    expect(readers.readStashByPreferenceId).toHaveBeenCalledWith("PREF-blank");
    expect(readers.readStashByEmail).toHaveBeenCalledWith("buyer@example.com");
  });

  it("does not call the email reader when payer.email is empty", async () => {
    const payment: MpPaymentLike = {
      preference_id: undefined,
      payer: { email: "", first_name: null, last_name: null },
      additional_info: { payer: { first_name: "Anon", last_name: "Buyer" } },
    };
    const readers = makeReaders();
    await resolveBuyerInfo(payment, readers);
    expect(readers.readStashByEmail).not.toHaveBeenCalled();
  });
});
