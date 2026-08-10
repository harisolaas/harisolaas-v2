/**
 * What each collaborator is owed for the BROTE tickets they brought.
 *
 * This is deliberately a DIFFERENT number from the one on `/admin/links`.
 * Those two answer different questions and must not share a source:
 *
 *   · "where did people come from" — `participations.link_slug`, driven by
 *     UTMs and the 30-day `haris_link` cookie. Soft, client-asserted, and
 *     that is fine: it is a marketing signal, and last-click precedence
 *     means a real tracked link beats a collaborator page.
 *
 *   · "who do we owe money to" — this. It reads `metadata.invite`, which is
 *     written in exactly one place: the webhook, when MercadoPago confirms
 *     the payment, resolved through the collaborator registry.
 *
 * The separation is what makes this number trustworthy. `link_slug` can be
 * set by anyone who POSTs to a free, unauthenticated signup form — the plant
 * registration accepts a `linkSlug` in its body and nothing validates that
 * the visitor ever saw that link. `metadata.invite` cannot be reached that
 * way: no free endpoint writes it, and its value has to survive a round trip
 * through a real MercadoPago payment.
 *
 * It also sidesteps the cookie problem: a buyer carrying a month-old
 * `haris_link` has their *attribution* credited to that older link, but the
 * collaborator still gets paid, because payout never looks at `link_slug`.
 */

import { formatArs } from "@/data/brote";
import { getInvitation, type InvitationSlug } from "./brote-invitations";

/** One paid participation, as read from the database. */
export interface PayoutRow {
  invite: string | null;
  priceCents: number | null;
  status: string;
  externalPaymentId: string | null;
}

export interface CollaboratorPayout {
  slug: InvitationSlug;
  name: string;
  kind: "brand" | "artist";
  tickets: number;
  revenueCents: number;
  revenueDisplay: string;
  /** Only when a fee per ticket was supplied. */
  feeCents?: number;
  feeDisplay?: string;
}

export interface PayoutSummary {
  collaborators: CollaboratorPayout[];
  totals: {
    tickets: number;
    revenueCents: number;
    revenueDisplay: string;
    feeCents?: number;
    feeDisplay?: string;
  };
  /**
   * Paid rows whose `invite` is not a known collaborator. Surfaced rather
   * than dropped: a non-empty list means either a renamed slug or a ticket
   * that will never be paid to anyone, and silence would hide both.
   */
  unknownInvites: { invite: string; tickets: number }[];
  /**
   * Paid-but-cancelled rows, per collaborator. Listed separately because
   * whether a refunded ticket still earns a fee is a business call, not
   * something this report should decide by quietly including or excluding.
   */
  cancelled: { slug: string; tickets: number; revenueCents: number }[];
}

/** A row counts toward payout when real money is attached to it. */
export function isPaid(row: PayoutRow): boolean {
  return Boolean(row.externalPaymentId) && (row.priceCents ?? 0) > 0;
}

/**
 * Group paid rows by collaborator.
 *
 * `feePerTicketCents` is optional: without it the report is tickets and
 * revenue, and the rate is applied by hand. There is no default — inventing
 * one would put a number in a payout report that nobody agreed to.
 */
export function summarizePayout(
  rows: PayoutRow[],
  feePerTicketCents?: number,
): PayoutSummary {
  const byCollaborator = new Map<
    InvitationSlug,
    { tickets: number; revenueCents: number }
  >();
  const unknown = new Map<string, number>();
  const cancelled = new Map<string, { tickets: number; revenueCents: number }>();

  for (const row of rows) {
    if (!row.invite || !isPaid(row)) continue;

    const invitation = getInvitation(row.invite);
    if (!invitation) {
      unknown.set(row.invite, (unknown.get(row.invite) ?? 0) + 1);
      continue;
    }

    const cents = row.priceCents ?? 0;

    if (row.status === "cancelled") {
      const entry = cancelled.get(invitation.slug) ?? {
        tickets: 0,
        revenueCents: 0,
      };
      entry.tickets += 1;
      entry.revenueCents += cents;
      cancelled.set(invitation.slug, entry);
      continue;
    }

    const entry = byCollaborator.get(invitation.slug) ?? {
      tickets: 0,
      revenueCents: 0,
    };
    entry.tickets += 1;
    entry.revenueCents += cents;
    byCollaborator.set(invitation.slug, entry);
  }

  const collaborators: CollaboratorPayout[] = [];
  for (const [slug, entry] of byCollaborator) {
    const invitation = getInvitation(slug)!;
    collaborators.push({
      slug,
      name: invitation.name,
      kind: invitation.kind,
      tickets: entry.tickets,
      revenueCents: entry.revenueCents,
      revenueDisplay: formatArs(Math.round(entry.revenueCents / 100)),
      ...(feePerTicketCents !== undefined && {
        feeCents: entry.tickets * feePerTicketCents,
        feeDisplay: formatArs(
          Math.round((entry.tickets * feePerTicketCents) / 100),
        ),
      }),
    });
  }

  // Most owed first — the report is read to pay people.
  collaborators.sort((a, b) => b.tickets - a.tickets || b.revenueCents - a.revenueCents);

  const totalTickets = collaborators.reduce((n, c) => n + c.tickets, 0);
  const totalRevenue = collaborators.reduce((n, c) => n + c.revenueCents, 0);

  return {
    collaborators,
    totals: {
      tickets: totalTickets,
      revenueCents: totalRevenue,
      revenueDisplay: formatArs(Math.round(totalRevenue / 100)),
      ...(feePerTicketCents !== undefined && {
        feeCents: totalTickets * feePerTicketCents,
        feeDisplay: formatArs(
          Math.round((totalTickets * feePerTicketCents) / 100),
        ),
      }),
    },
    unknownInvites: [...unknown.entries()].map(([invite, tickets]) => ({
      invite,
      tickets,
    })),
    cancelled: [...cancelled.entries()].map(([slug, e]) => ({
      slug,
      tickets: e.tickets,
      revenueCents: e.revenueCents,
    })),
  };
}
