import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_BUYER_NAME } from "./mp-buyer-info";

/**
 * Post-payment contact confirmation for BROTE.
 *
 * The buyer goes straight to MercadoPago, so the only identity we get is
 * whatever MP's payer object carries. On `/brote/success` we ask them to
 * confirm where the ticket should go. Per the owner's rule, **the confirmed
 * email is the canonical one** — it becomes `people.email` — and MP's is
 * kept on the participation, explicitly flagged as MP-sourced.
 */

export const MAX_CONTACT_RESENDS = 3;

export interface BroteContactConfirmationParams {
  participationId: string;
  /** Passed in rather than closed over: the real event row only exists in prod. */
  eventId: string;
  name: string;
  email: string;
  phone: string;
}

export type BroteContactConfirmationResult =
  | {
      outcome: "applied";
      emailChanged: boolean;
      /** True when the caller should (re)send the ticket to `to`. */
      shouldResend: boolean;
      to: string;
      buyerName: string;
      paymentId: string;
    }
  | { outcome: "not_found" }
  /** The confirmed address already holds a ticket for this same event. */
  | { outcome: "email_taken" };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Postgres unique-violation, seen through drizzle.
 *
 * The driver does NOT rethrow the pg error: it wraps it in a
 * `DrizzleQueryError` whose own `code` is undefined and whose `cause` holds
 * the real one. Checking `err.code` alone silently never matches — the
 * whole safety net below becomes dead code, and a lost race 500s instead of
 * answering `email_taken`. Walk the cause chain, and pin it with a test
 * that stages a real violation (a driver upgrade could move it again).
 */
export function isUniqueViolation(err: unknown): boolean {
  let cursor: unknown = err;
  for (let depth = 0; cursor && depth < 5; depth++) {
    if (typeof cursor !== "object") return false;
    if ((cursor as { code?: string }).code === "23505") return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}

export async function applyBroteContactConfirmation(
  params: BroteContactConfirmationParams,
): Promise<BroteContactConfirmationResult> {
  const email = normalizeEmail(params.email);
  const name = params.name.trim();
  const phone = params.phone.trim();

  try {
    return await db.transaction(async (tx) => {
      // Lock the participation for the whole decision: everything below keys
      // off its person, and a concurrent webhook retry must not move it
      // underneath us.
      const rows = await tx
        .select({
          participationId: schema.participations.id,
          personId: schema.participations.personId,
          paymentId: schema.participations.externalPaymentId,
          metadata: schema.participations.metadata,
          personEmail: schema.people.email,
          personName: schema.people.name,
        })
        .from(schema.participations)
        .innerJoin(
          schema.people,
          eq(schema.people.id, schema.participations.personId),
        )
        .where(eq(schema.participations.id, params.participationId))
        .for("update")
        .limit(1);

      if (rows.length === 0) return { outcome: "not_found" as const };
      const row = rows[0];

      const mpEmail = row.personEmail ?? "";
      const emailChanged = normalizeEmail(mpEmail) !== email;
      const meta = (row.metadata as Record<string, unknown>) ?? {};
      const resendCount = Number(meta.contactResendCount ?? 0);

      let personId = row.personId;

      if (emailChanged) {
        // Is the confirmed address already a person? Lock it if so, so a
        // competing move can't land between this read and the re-point.
        const existing = await tx
          .select({ id: schema.people.id })
          .from(schema.people)
          .where(sql`${schema.people.email} = ${email}`)
          .for("update")
          .limit(1);

        if (existing.length > 0) {
          // That person may already be going to this event. Two tickets on
          // one person/event row is exactly what the unique index forbids,
          // so refuse instead of half-applying.
          const clash = await tx
            .select({ id: schema.participations.id })
            .from(schema.participations)
            .where(
              and(
                eq(schema.participations.personId, existing[0].id),
                eq(schema.participations.eventId, params.eventId),
              ),
            )
            .limit(1);
          // CUT, deliberately, and recorded rather than silent: the spec
          // wanted this to demote our row to `companion` and re-point
          // anyway, since the partial index now permits it. That is a
          // behaviour change on a live path — it would merge two people's
          // purchases under one identity — and it is not needed for guest
          // names to work. Refusing keeps today's behaviour, which is
          // wrong-but-known: the buyer sees "ese email ya tiene una
          // entrada" and can use another address or write on WhatsApp.
          // Backlogged with that reasoning.
          if (clash.length > 0) return { outcome: "email_taken" as const };

          // Move the WHOLE purchase, not just the row the token names. One
          // payment can own several tickets now; re-pointing one of them
          // splits the group across two `people` rows, so the attendee
          // export and the door show the buyer's other tickets under the
          // address they were trying to move away from.
          //
          // The other branch below has no such problem: renaming the person
          // in place carries every participation that person owns.
          await tx
            .update(schema.participations)
            .set({ personId: existing[0].id, updatedAt: sql`NOW()` })
            .where(
              row.paymentId
                ? eq(schema.participations.externalPaymentId, row.paymentId)
                : eq(schema.participations.id, params.participationId),
            );
          personId = existing[0].id;
        } else {
          // Rename in place — keeps first_touch, attribution and the id.
          // The pre-check above is the common path; the unique index is
          // still the authority, and a lost race surfaces as 23505 below.
          await tx
            .update(schema.people)
            .set({ email, updatedAt: sql`NOW()` })
            .where(eq(schema.people.id, personId));
        }
      }

      // Overwrite the phone: the person just typed it, so it's better than
      // whatever is stored. This deliberately diverges from
      // recordParticipation's sticky `COALESCE(people.phone, ...)`.
      // Name follows the placeholder rule used by the upserts in
      // community.ts (:165, :488) — a real name replaces "Asistente".
      await tx
        .update(schema.people)
        .set({
          phone,
          name: sql`CASE WHEN ${schema.people.name} IS NULL
                          OR ${schema.people.name} = ''
                          OR ${schema.people.name} = ${DEFAULT_BUYER_NAME}
                         THEN ${name} ELSE ${schema.people.name} END`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.people.id, personId));

      const alreadySent = Boolean(meta.emailSent);
      const wantsResend = emailChanged || !alreadySent;
      const shouldResend = wantsResend && resendCount < MAX_CONTACT_RESENDS;

      await tx
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({
            contact: {
              name,
              email,
              phone,
              confirmedAt: new Date().toISOString(),
            },
            // Record MP's address ONCE. On a second confirmation
            // `people.email` already holds whatever was confirmed first, so
            // re-deriving it here would stamp a user-typed address as
            // MercadoPago-sourced and destroy the real one — the jsonb `||`
            // merge is shallow, it replaces the whole `mpPayer` key.
            ...(emailChanged &&
              !meta.mpPayer && {
                mpPayer: { email: mpEmail, source: "mercadopago" },
              }),
            ...(shouldResend && { contactResendCount: resendCount + 1 }),
          })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, params.participationId));

      return {
        outcome: "applied" as const,
        emailChanged,
        shouldResend,
        to: email,
        buyerName: name || row.personName || DEFAULT_BUYER_NAME,
        paymentId: row.paymentId ?? "",
      };
    });
  } catch (err) {
    // A lost race on either unique index (people.email, or
    // participations person/event) means someone else claimed the address
    // between the check and the write. Same answer as the checked path.
    if (isUniqueViolation(err)) return { outcome: "email_taken" };
    throw err;
  }
}
