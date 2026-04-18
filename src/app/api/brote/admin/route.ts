import { NextResponse } from "next/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { Resend } from "resend";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import { recordParticipation } from "@/lib/community";
import { plantConfig } from "@/data/brote";
import type { BroteTicket } from "@/lib/brote-types";
import {
  buildReminderEmailHtml,
  buildTicketEmailHtml,
  qrDataUrlToBuffer,
} from "@/lib/brote-email";
import {
  buildPlantConfirmationEmailHtml,
  buildPlantInvite1Html,
  buildPlantInvite2Html,
} from "@/lib/plant-email";
import { sendMetaEvent } from "@/lib/meta-capi";

const BROTE_EVENT_ID = "brote-2026-03-28";
const PLANT_EVENT_ID = "plant-2026-04";

function auth(req: Request): boolean {
  const secret = req.headers.get("authorization");
  return secret === `Bearer ${process.env.BROTE_ADMIN_SECRET}`;
}

async function loadTicket(ticketId: string): Promise<BroteTicket | null> {
  const rows = await db
    .select({
      id: schema.participations.id,
      paymentId: schema.participations.externalPaymentId,
      status: schema.participations.status,
      createdAt: schema.participations.createdAt,
      usedAt: schema.participations.usedAt,
      metadata: schema.participations.metadata,
      email: schema.people.email,
      name: schema.people.name,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.id, ticketId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  const meta = (r.metadata as Record<string, unknown>) ?? {};
  return {
    id: r.id,
    type: "ticket",
    paymentId: r.paymentId ?? "",
    buyerEmail: r.email ?? "",
    buyerName: r.name,
    status: r.status === "used" ? "used" : "valid",
    createdAt: r.createdAt.toISOString(),
    usedAt: r.usedAt?.toISOString(),
    emailSent: Boolean(meta.emailSent),
    coffeeRedeemed: Boolean(meta.coffeeRedeemed),
    coffeeRedeemedAt: meta.coffeeRedeemedAt as string | undefined,
  };
}

async function countBroteTickets(): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
  return Number(res[0]?.n ?? 0);
}

async function countPlantConfirmed(): Promise<number> {
  const res = await db
    .select({ n: count() })
    .from(schema.participations)
    .where(
      and(
        eq(schema.participations.eventId, PLANT_EVENT_ID),
        eq(schema.participations.status, "confirmed"),
      ),
    );
  return Number(res[0]?.n ?? 0);
}

// ------------------------------------------------------------
// GET — status or ticket lookup
// ------------------------------------------------------------
export async function GET(req: Request) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ticketId = url.searchParams.get("ticket");

  try {
    if (ticketId) {
      const ticket = await loadTicket(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      return NextResponse.json({ ticket });
    }

    // System status.
    const counter = await countBroteTickets();

    // Tickets missing email-sent flag.
    const missingEmailRows = await db
      .select({
        id: schema.participations.id,
        metadata: schema.participations.metadata,
      })
      .from(schema.participations)
      .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
    const ticketsWithoutEmail = missingEmailRows
      .filter((r) => {
        const m = (r.metadata as Record<string, unknown>) ?? {};
        return !m.emailSent;
      })
      .map((r) => r.id);

    // Payments — count distinct external_payment_id on brote.
    const paymentsRes = await db.execute<{ n: number }>(sql`
      SELECT COUNT(DISTINCT external_payment_id)::int AS n
      FROM participations
      WHERE event_id = ${BROTE_EVENT_ID} AND external_payment_id IS NOT NULL
    `);
    const payments = Number(paymentsRes.rows?.[0]?.n ?? 0);

    const plantCounter = await countPlantConfirmed();

    const plantRows = await db
      .select({
        id: schema.participations.id,
        email: schema.people.email,
        name: schema.people.name,
        createdAt: schema.participations.createdAt,
        metadata: schema.participations.metadata,
        attribution: schema.participations.attribution,
        status: schema.participations.status,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.eventId, PLANT_EVENT_ID))
      .orderBy(schema.participations.createdAt);

    const plantRegistrations = plantRows
      .filter((r) => r.status !== "waitlist")
      .map((r) => {
        const m = (r.metadata as Record<string, unknown>) ?? {};
        const a = (r.attribution as Record<string, unknown> | null) ?? null;
        return {
          id: r.id,
          email: r.email,
          name: r.name,
          groupType: m.groupType,
          carpool: Boolean(m.carpool),
          message: m.message as string | undefined,
          status: r.status === "waitlist" ? "waitlist" : "registered",
          createdAt: r.createdAt.toISOString(),
          utm: a
            ? {
                source: a.source as string | undefined,
                medium: a.medium as string | undefined,
                campaign: a.campaign as string | undefined,
              }
            : undefined,
        };
      });

    const plantWaitlist = plantRows
      .filter((r) => r.status === "waitlist")
      .map((r) => ({
        email: r.email,
        createdAt: r.createdAt.toISOString(),
      }));

    return NextResponse.json({
      status: "ok",
      counter,
      tickets: counter,
      payments,
      ticketsWithoutEmail,
      plant: {
        counter: plantCounter,
        registrations: plantRegistrations,
        waitlist: plantWaitlist,
      },
      env: {
        hasRedisUrl: !!process.env.REDIS_URL,
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasMpToken: !!process.env.MP_ACCESS_TOKEN,
        hasMpWebhookSecret: !!process.env.MP_WEBHOOK_SECRET,
        hasResendFrom: !!process.env.RESEND_FROM_EMAIL,
        hasMetaPixelId: !!process.env.META_PIXEL_ID,
        hasMetaCapiToken: !!process.env.META_CAPI_TOKEN,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    });
  } catch (err) {
    console.error("Admin GET error:", err);
    return NextResponse.json(
      { error: "Server error", message: String(err) },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// POST — actions
// ------------------------------------------------------------
export async function POST(req: Request) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      action: string;
      ticketId?: string;
      paymentId?: string;
      testEventCode?: string;
      toEmail?: string;
      giftName?: string;
      variant?: 1 | 2;
      mode?: "preview" | "send";
      audienceOverride?: string[];
      registrationId?: string;
      newEmail?: string;
      emails?: string[];
    };
    const {
      action,
      ticketId,
      paymentId,
      testEventCode,
      toEmail,
      giftName,
      variant,
      mode,
      audienceOverride,
      registrationId,
      newEmail,
      emails,
    } = body;

    // ── resend-email (BROTE ticket) ──
    if (action === "resend-email" && ticketId) {
      const ticket = await loadTicket(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      const sendTo = toEmail ?? ticket.buyerEmail;
      if (!sendTo) {
        return NextResponse.json({ error: "No email on ticket" }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
      const treeNumber = await countBroteTickets();
      const qrUrl = `${baseUrl}/es/brote/gate?ticket=${ticket.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#2D4A3E", light: "#FAF6F1" },
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: `BROTE <${fromEmail}>`,
        to: sendTo,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml({ ...ticket, buyerEmail: sendTo }, treeNumber),
        attachments: [
          {
            filename: "qr.png",
            content: qrDataUrlToBuffer(qrDataUrl),
            contentType: "image/png",
            contentId: "qr",
          },
        ],
      });

      // Mark email sent.
      await db
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({ emailSent: true })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, ticket.id));

      return NextResponse.json({
        ok: true,
        to: sendTo,
        resendId: result.data?.id,
      });
    }

    // ── plant-invite-campaign ──
    if (action === "plant-invite-campaign") {
      const v = variant;
      const m = mode || "preview";
      if (v !== 1 && v !== 2) {
        return NextResponse.json({ error: "variant must be 1 or 2" }, { status: 400 });
      }

      let audience: string[];
      let buyerEmailsSize = 0;
      let plantEmailsSize = 0;

      if (Array.isArray(audienceOverride) && audienceOverride.length > 0) {
        audience = audienceOverride.map((e) => e.trim().toLowerCase()).filter(Boolean);
      } else {
        // Set of BROTE buyer emails minus those already plant-registered.
        const audienceRes = await db.execute<{ email: string }>(sql`
          SELECT LOWER(p.email) AS email
          FROM people p
          JOIN participations brote
            ON brote.person_id = p.id AND brote.event_id = ${BROTE_EVENT_ID}
          WHERE p.email IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM participations plant
              WHERE plant.person_id = p.id AND plant.event_id = ${PLANT_EVENT_ID}
            )
          GROUP BY p.id
        `);
        audience = audienceRes.rows.map((r) => r.email);

        const broteEmailsRes = await db.execute<{ n: number }>(sql`
          SELECT COUNT(DISTINCT p.email)::int AS n
          FROM people p
          JOIN participations ON participations.person_id = p.id
          WHERE participations.event_id = ${BROTE_EVENT_ID} AND p.email IS NOT NULL
        `);
        buyerEmailsSize = Number(broteEmailsRes.rows[0]?.n ?? 0);

        const plantEmailsRes = await db.execute<{ n: number }>(sql`
          SELECT COUNT(DISTINCT p.email)::int AS n
          FROM people p
          JOIN participations ON participations.person_id = p.id
          WHERE participations.event_id = ${PLANT_EVENT_ID} AND p.email IS NOT NULL
        `);
        plantEmailsSize = Number(plantEmailsRes.rows[0]?.n ?? 0);
      }

      if (m === "preview") {
        return NextResponse.json({
          ok: true,
          variant: v,
          totalBuyers: buyerEmailsSize,
          alreadyRegistered: plantEmailsSize,
          audienceSize: audience.length,
          audienceSample: audience.slice(0, 10),
          override: Boolean(audienceOverride && audienceOverride.length > 0),
        });
      }

      const plantCounter = await countPlantConfirmed();
      const remaining = Math.max(0, plantConfig.capacity - plantCounter);
      const subject =
        v === 1
          ? "BROTE — Si le tenés miedo a la pala 🪏, no abrás este mail"
          : `BROTE — Quedan ${remaining} lugares para el 19 de abril`;
      const html = v === 1 ? buildPlantInvite1Html() : buildPlantInvite2Html(remaining);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);

      const results: { email: string; ok: boolean; error?: string }[] = [];
      for (const email of audience) {
        try {
          await resend.emails.send({
            from: `BROTE <${fromEmail}>`,
            to: email,
            subject,
            html,
          });
          results.push({ email, ok: true });
        } catch (err) {
          results.push({ email, ok: false, error: String(err) });
        }
      }
      const sent = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      if (!audienceOverride || audienceOverride.length === 0) {
        const redis = await getRedis();
        await redis.set(
          `plant:campaign:${v}:sent`,
          JSON.stringify({
            sentAt: new Date().toISOString(),
            subject,
            audienceSize: audience.length,
            sent,
            failedCount: failed.length,
          }),
        );
      }

      return NextResponse.json({
        ok: true,
        variant: v,
        subject,
        audienceSize: audience.length,
        sent,
        failed,
        remaining,
      });
    }

    // ── plant-fix-email ──
    if (action === "plant-fix-email") {
      if (!registrationId || !newEmail) {
        return NextResponse.json(
          { error: "registrationId and newEmail required" },
          { status: 400 },
        );
      }
      const newEmailNormalized = newEmail.trim();

      const rows = await db
        .select({
          personId: schema.participations.personId,
          oldEmail: schema.people.email,
          name: schema.people.name,
        })
        .from(schema.participations)
        .innerJoin(
          schema.people,
          eq(schema.people.id, schema.participations.personId),
        )
        .where(eq(schema.participations.id, registrationId))
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Registration not found" },
          { status: 404 },
        );
      }
      const reg = rows[0];
      const oldEmail = reg.oldEmail ?? "";

      if ((oldEmail ?? "").toLowerCase() === newEmailNormalized.toLowerCase()) {
        return NextResponse.json({ ok: true, noChange: true });
      }

      if (mode === "preview") {
        return NextResponse.json({
          ok: true,
          preview: true,
          registrationId,
          oldEmail,
          newEmail: newEmailNormalized,
        });
      }

      // Update the person's email (citext guarantees uniqueness across case).
      await db
        .update(schema.people)
        .set({ email: newEmailNormalized, updatedAt: sql`NOW()` })
        .where(eq(schema.people.id, reg.personId));

      // Send confirmation email to the new address.
      let emailSent = false;
      let emailError: string | undefined;
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
        const resend = new Resend(process.env.RESEND_API_KEY!);
        await resend.emails.send({
          from: `BROTE <${fromEmail}>`,
          to: newEmailNormalized,
          subject: "¡Te anotaste para plantar! 🌱 Detalles del evento",
          html: buildPlantConfirmationEmailHtml(reg.name),
        });
        emailSent = true;
      } catch (err) {
        emailError = String(err);
      }

      return NextResponse.json({
        ok: true,
        registrationId,
        oldEmail,
        newEmail: newEmailNormalized,
        emailSent,
        emailError,
      });
    }

    // ── plant-resend-email ──
    if (action === "plant-resend-email") {
      const regId = req.headers.get("x-registration-id") || undefined;
      const lookupEmail = toEmail?.trim();

      let rows: {
        id: string;
        name: string;
        email: string | null;
      }[] = [];

      if (regId) {
        rows = await db
          .select({
            id: schema.participations.id,
            name: schema.people.name,
            email: schema.people.email,
          })
          .from(schema.participations)
          .innerJoin(
            schema.people,
            eq(schema.people.id, schema.participations.personId),
          )
          .where(eq(schema.participations.id, regId))
          .limit(1);
      } else if (lookupEmail) {
        rows = await db
          .select({
            id: schema.participations.id,
            name: schema.people.name,
            email: schema.people.email,
          })
          .from(schema.participations)
          .innerJoin(
            schema.people,
            eq(schema.people.id, schema.participations.personId),
          )
          .where(
            and(
              eq(schema.participations.eventId, PLANT_EVENT_ID),
              eq(schema.people.email, lookupEmail),
            ),
          )
          .limit(1);
      }

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Plant registration not found" },
          { status: 404 },
        );
      }
      const registration = rows[0];
      if (!registration.email) {
        return NextResponse.json(
          { error: "Registration has no email" },
          { status: 400 },
        );
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: `BROTE <${fromEmail}>`,
        to: registration.email,
        subject: "¡Te anotaste para plantar! 🌱 Detalles del evento",
        html: buildPlantConfirmationEmailHtml(registration.name),
      });

      return NextResponse.json({
        ok: true,
        to: registration.email,
        registrationId: registration.id,
        resendId: result.data?.id,
      });
    }

    // ── test-meta (no DB dependency) ──
    if (action === "test-meta") {
      if (!testEventCode) {
        return NextResponse.json(
          { error: "testEventCode is required — get it from Meta Events Manager > Test Events" },
          { status: 400 },
        );
      }

      const result = await sendMetaEvent(
        {
          event_name: "Purchase",
          event_id: `test-purchase-${Date.now()}`,
          event_source_url: "https://www.harisolaas.com/es/brote",
          user_data: {
            client_ip_address:
              req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
            client_user_agent: req.headers.get("user-agent") || "test-agent",
          },
          custom_data: { currency: "ARS", value: 1 },
        },
        { testEventCode },
      );

      return NextResponse.json({
        ok: result.ok,
        meta_response: result.response,
        error: result.error,
        hint: result.ok
          ? "Check Meta Events Manager > Test Events tab for the event"
          : "Check that META_PIXEL_ID and META_CAPI_TOKEN env vars are set",
      });
    }

    // ── gift-ticket ──
    if (action === "gift-ticket") {
      if (!toEmail) {
        return NextResponse.json({ error: "toEmail required" }, { status: 400 });
      }

      const newTicketId = `BROTE-${nanoid(8).toUpperCase()}`;
      const giftedName = giftName || "Invitado/a";
      await recordParticipation({
        email: toEmail,
        name: giftedName,
        eventId: BROTE_EVENT_ID,
        participationId: newTicketId,
        role: "attendee",
        status: "confirmed",
        externalPaymentId: `GIFT-${newTicketId}`,
      });

      const treeNumber = await countBroteTickets();

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
      const qrUrl = `${baseUrl}/es/brote/gate?ticket=${newTicketId}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#2D4A3E", light: "#FAF6F1" },
      });

      const ticketForTemplate: BroteTicket = {
        id: newTicketId,
        type: "ticket",
        paymentId: `GIFT-${newTicketId}`,
        buyerEmail: toEmail,
        buyerName: giftedName,
        status: "valid",
        createdAt: new Date().toISOString(),
      };

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: `BROTE <${fromEmail}>`,
        to: toEmail,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml(ticketForTemplate, treeNumber),
        attachments: [
          {
            filename: "qr.png",
            content: qrDataUrlToBuffer(qrDataUrl),
            contentType: "image/png",
            contentId: "qr",
          },
        ],
      });

      // Mark email sent on the participation.
      await db
        .update(schema.participations)
        .set({
          metadata: sql`${schema.participations.metadata} || ${JSON.stringify({ emailSent: true })}::jsonb`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.participations.id, newTicketId));

      return NextResponse.json({
        ok: true,
        ticketId: newTicketId,
        treeNumber,
        to: toEmail,
        resendId: result.data?.id,
      });
    }

    // ── send-reminder ──
    if (action === "send-reminder") {
      const counter = await countBroteTickets();
      const treesRemaining = Math.max(0, 100 - counter);

      const rows = await db
        .select({ email: schema.people.email })
        .from(schema.participations)
        .innerJoin(
          schema.people,
          eq(schema.people.id, schema.participations.personId),
        )
        .where(eq(schema.participations.eventId, BROTE_EVENT_ID));
      const emailsSet = new Set(
        rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e),
      );

      if (emailsSet.size === 0) {
        return NextResponse.json({ error: "No attendees found" }, { status: 400 });
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const html = buildReminderEmailHtml(treesRemaining);

      const results: { email: string; ok: boolean; error?: string }[] = [];
      for (const email of emailsSet) {
        try {
          await resend.emails.send({
            from: `BROTE <${fromEmail}>`,
            to: email,
            subject: "¡Hoy es BROTE! 🌱 Te esperamos a las 14h",
            html,
          });
          results.push({ email, ok: true });
        } catch (err) {
          results.push({ email, ok: false, error: String(err) });
        }
      }
      const sent = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      return NextResponse.json({
        ok: true,
        treesRemaining,
        totalEmails: emailsSet.size,
        sent,
        failed,
      });
    }

    // ── lookup-payment ──
    if (action === "lookup-payment" && paymentId) {
      const rows = await db
        .select({
          id: schema.participations.id,
        })
        .from(schema.participations)
        .where(eq(schema.participations.externalPaymentId, paymentId))
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }
      const ticket = await loadTicket(rows[0].id);
      return NextResponse.json({ ticketId: rows[0].id, ticket });
    }

    // ── fix-campaign-log (Redis) ──
    if (action === "fix-campaign-log" && variant && mode) {
      const data = { sent: Number(mode), audienceSize: Number(mode) };
      const redis = await getRedis();
      await redis.set(
        `plant:campaign:${variant}:sent`,
        JSON.stringify({
          sentAt: new Date().toISOString(),
          subject: toEmail || "",
          audienceSize: data.audienceSize,
          sent: data.sent,
          failedCount: 0,
          note: "Manually corrected via admin",
        }),
      );
      return NextResponse.json({ ok: true, variant, data });
    }

    // ── plant-delete-registrations ──
    if (action === "plant-delete-registrations") {
      if (!Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json(
          { error: "emails array required" },
          { status: 400 },
        );
      }
      const targetEmails = emails.map((e) => e.trim()).filter(Boolean);
      const m = mode || "preview";

      const rows = await db
        .select({
          id: schema.participations.id,
          email: schema.people.email,
          name: schema.people.name,
          createdAt: schema.participations.createdAt,
        })
        .from(schema.participations)
        .innerJoin(
          schema.people,
          eq(schema.people.id, schema.participations.personId),
        )
        .where(
          and(
            eq(schema.participations.eventId, PLANT_EVENT_ID),
            inArray(schema.people.email, targetEmails),
          ),
        );

      if (m === "preview") {
        return NextResponse.json({
          ok: true,
          preview: true,
          found: rows.map((r) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            createdAt: r.createdAt.toISOString(),
          })),
          counterDecrement: rows.length,
        });
      }

      const counterBefore = await countPlantConfirmed();
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        await db
          .delete(schema.participations)
          .where(inArray(schema.participations.id, ids));
      }
      const counterAfter = await countPlantConfirmed();

      return NextResponse.json({
        ok: true,
        deleted: ids,
        counterBefore,
        counterAfter,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Admin POST error:", err);
    return NextResponse.json(
      { error: "Server error", message: String(err) },
      { status: 500 },
    );
  }
}
