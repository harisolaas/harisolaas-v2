/**
 * Per-collaborator BROTE invitation links.
 *
 * Five people and brands share BROTE from their own Instagram accounts. The
 * three brands hand out a real discount; the two artists on the line-up sell
 * at the public price but every sale they bring has to be *attributable*, so
 * they can be paid a fee per ticket.
 *
 * The slug is the whole identity: it names the landing route, keys the
 * tracked `links` row, and is what the checkout re-validates before pricing.
 * Nothing here is read from the client — a slug arriving in a request body is
 * a lookup key, never a price.
 */

import { broteConfig, currentTicketPrice, formatArs } from "@/data/brote";

export const INVITATION_SLUGS = [
  "pulso",
  "matelab",
  "unarbol",
  "jose",
  "gian",
  "comunidad",
] as const;

export type InvitationSlug = (typeof INVITATION_SLUGS)[number];

export interface BroteInvitation {
  slug: InvitationSlug;
  /**
   * The identity block, set in Instrument Serif at ~84px. For a collaborator
   * it is their name; for the returning-community page it is a phrase, since
   * there is nobody to name.
   */
  name: string;
  /**
   * With the `@`. Optional: `community` has no account to link to, and the
   * chip is simply not rendered — the same way a missing role line closes up
   * rather than leaving a hole.
   */
  handle?: string;
  /**
   * `brand` and `community` discount; `artist` sells at the public price and
   * earns a per-ticket fee. Only `artist` is ever paid out — the others are
   * reported so the sales are visible, not because money is owed.
   */
  kind: "brand" | "artist" | "community";
  /**
   * Their own site, when they have one. The landing links the *name* here and
   * the @handle chip at Instagram, so a brand gets both surfaces; a musician
   * with no site falls back to Instagram for both.
   */
  website?: string;
  /** Off the REGULAR price, not the preventa. 0 for artists. */
  discountPct: number;
  /** Row in `links` — what stamps `participations.link_slug`. */
  linkSlug: string;
}

const INVITATIONS: Record<InvitationSlug, BroteInvitation> = {
  pulso: {
    slug: "pulso",
    name: "Pulso",
    handle: "@pulsoclub.ba",
    kind: "brand",
    discountPct: 35,
    linkSlug: "inv-pulso",
  },
  matelab: {
    slug: "matelab",
    name: "MateLab",
    handle: "@matelab.co",
    website: "https://matelabco.com/",
    kind: "brand",
    discountPct: 35,
    linkSlug: "inv-matelab",
  },
  unarbol: {
    slug: "unarbol",
    name: "Un Árbol",
    handle: "@unarbol_ong",
    website: "https://unarbol.org/",
    kind: "brand",
    discountPct: 35,
    linkSlug: "inv-unarbol",
  },
  jose: {
    slug: "jose",
    // Accented: the registry is now the only source of this name, and it
    // renders on a Spanish landing page. Before the line-up read from here,
    // `es.ts` spelled it "José" and only the invitation page said "Jose".
    name: "José Dezanzo",
    handle: "@josedezanzo",
    kind: "artist",
    discountPct: 0,
    linkSlug: "inv-jose",
  },
  gian: {
    slug: "gian",
    name: "Gian Bejarano",
    handle: "@_gianbejarano",
    kind: "artist",
    discountPct: 0,
    linkSlug: "inv-gian",
  },
  // Everyone who already came — BROTE 1 (brote-2026-03-28) or the planting
  // day (plant-2026-04). Not a collaborator: nobody is inviting anybody and
  // nobody gets paid, so there is no handle and the page overrides the
  // "Te invita" kicker. Same 35% as the brands.
  comunidad: {
    slug: "comunidad",
    name: "Comunidad BROTE",
    kind: "community",
    discountPct: 35,
    linkSlug: "inv-comunidad",
  },
};

/**
 * Exact match only — a slug is a URL segment and a link key, not free text.
 *
 * `Object.hasOwn` rather than a bare index: the slug comes off a request body,
 * and a plain lookup answers `constructor` or `toString` with something
 * truthy from Object.prototype. That never mispriced anything (the inherited
 * value has no `discountPct`, so it falls through to the public price) but it
 * did hand callers a non-invitation that stamped "Invitación undefined" onto
 * the MercadoPago item.
 */
export function getInvitation(
  slug: string | undefined | null,
): BroteInvitation | null {
  if (!slug || !Object.hasOwn(INVITATIONS, slug)) return null;
  return INVITATIONS[slug as InvitationSlug];
}

export interface InvitationPrice {
  /** What MercadoPago bills. The server's number, never the client's. */
  priceRaw: number;
  priceDisplay: string;
  /** Struck-through comparison, omitted when there is nothing to compare to. */
  compareAtDisplay?: string;
  badge: "discount" | "earlybird" | null;
}

/**
 * The price for an invited buyer.
 *
 * Brands: a fixed percentage off the REGULAR price, so the number does not
 * move when the preventa ends — gating it behind the early bird would quietly
 * raise it on 14/8.
 *
 * Artists: whatever the public pays right now, via `currentTicketPrice` — the
 * same helper the landing renders from, so what is shown and what is charged
 * cannot drift.
 */
export function resolveInvitationPrice(
  invitation: BroteInvitation | null,
  now: Date = new Date(),
): InvitationPrice {
  const publicPrice = currentTicketPrice(now);

  if (invitation && invitation.discountPct > 0) {
    const priceRaw = Math.round(
      broteConfig.ticketPriceRaw * (1 - invitation.discountPct / 100),
    );
    return {
      priceRaw,
      priceDisplay: formatArs(priceRaw),
      compareAtDisplay: broteConfig.ticketPrice,
      badge: "discount",
    };
  }

  // Artists and unknown slugs both land on the public price.
  return {
    priceRaw: publicPrice.raw,
    priceDisplay: publicPrice.display,
    ...(publicPrice.isEarlyBird && {
      compareAtDisplay: broteConfig.ticketPrice,
    }),
    badge: publicPrice.isEarlyBird ? "earlybird" : null,
  };
}

/** `https://instagram.com/<handle sin @>`, or null when there is no account. */
export function instagramUrl(invitation: BroteInvitation): string | null {
  if (!invitation.handle) return null;
  return `https://instagram.com/${invitation.handle.replace(/^@/, "")}`;
}

/**
 * Where a collaborator's *name* should link on the landing.
 *
 * Their own domain when they have one — a real site is a stronger outbound
 * signal than a profile, and the @handle chip beside it still carries the
 * Instagram surface, so linking the website costs nothing. Null when there is
 * neither (the returning-community page): callers render plain text.
 */
export function collaboratorNameUrl(
  invitation: BroteInvitation,
): string | null {
  return invitation.website ?? instagramUrl(invitation);
}

/**
 * The brands that back the party, in registry order.
 *
 * Selected on `kind`, not on `discountPct > 0` — those are the same set today
 * and would diverge the moment a brand goes to 0%, or immediately for
 * `comunidad`, which discounts 35% and is not a sponsor at all.
 */
export function brandInvitations(): BroteInvitation[] {
  return INVITATION_SLUGS.map((slug) => INVITATIONS[slug]).filter(
    (invitation) => invitation.kind === "brand",
  );
}
