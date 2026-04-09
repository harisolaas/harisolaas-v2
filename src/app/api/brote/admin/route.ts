import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import QRCode from "qrcode";
import { Resend } from "resend";
import type { BroteTicket } from "@/lib/brote-types";
import { buildTicketEmailHtml, buildReminderEmailHtml, qrDataUrlToBuffer } from "@/lib/brote-email";
import {
  buildPlantConfirmationEmailHtml,
  buildPlantInvite1Html,
  buildPlantInvite2Html,
} from "@/lib/plant-email";
import { plantConfig } from "@/data/brote";
import type { PlantRegistration } from "@/lib/plant-types";
import { sendMetaEvent } from "@/lib/meta-capi";

function auth(req: Request): boolean {
  const secret = req.headers.get("authorization");
  return secret === `Bearer ${process.env.BROTE_ADMIN_SECRET}`;
}

// GET /api/brote/admin — system status
// GET /api/brote/admin?ticket=BROTE-XXXX — lookup ticket
export async function GET(req: Request) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ticketId = url.searchParams.get("ticket");

  try {
    const redis = await getRedis();

    // Ticket lookup
    if (ticketId) {
      const raw = await redis.get(`brote:ticket:${ticketId}`);
      if (!raw) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }
      return NextResponse.json({ ticket: JSON.parse(raw) });
    }

    // System status
    const counter = Number(await redis.get("brote:counter") ?? 0);
    const ticketKeys = await redis.keys("brote:ticket:*");
    const paymentKeys = await redis.keys("brote:payment:*");

    // Check for tickets missing email
    const ticketsWithoutEmail: string[] = [];
    for (const key of ticketKeys) {
      const raw = await redis.get(key);
      if (raw) {
        const t: BroteTicket = JSON.parse(raw);
        if (!t.emailSent) ticketsWithoutEmail.push(t.id);
      }
    }

    // Plant registrations
    const plantCounter = Number(await redis.get("plant:counter") ?? 0);
    const plantRegistrationsRaw: string[] = await redis.sMembers("plant:registrations");
    const plantRegistrations = plantRegistrationsRaw
      .map((raw: string) => {
        try { return JSON.parse(raw); } catch { return null; }
      })
      .filter(Boolean);
    const plantWaitlistRaw: string[] = await redis.sMembers("plant:waitlist");
    const plantWaitlist = plantWaitlistRaw
      .map((raw: string) => {
        try { return JSON.parse(raw); } catch { return null; }
      })
      .filter(Boolean);

    return NextResponse.json({
      status: "ok",
      counter,
      tickets: ticketKeys.length,
      payments: paymentKeys.length,
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

// POST /api/brote/admin — actions: resend-email, lookup-payment
export async function POST(req: Request) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, ticketId, paymentId, testEventCode, toEmail, giftName, variant, mode, audienceOverride } = (await req.json()) as {
      action: string;
      ticketId?: string;
      paymentId?: string;
      testEventCode?: string;
      toEmail?: string;
      giftName?: string;
      variant?: 1 | 2;
      mode?: "preview" | "send";
      audienceOverride?: string[];
    };

    const redis = await getRedis();

    if (action === "resend-email" && ticketId) {
      const raw = await redis.get(`brote:ticket:${ticketId}`);
      if (!raw) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      const ticket: BroteTicket = JSON.parse(raw);
      if (toEmail) {
        ticket.buyerEmail = toEmail;
      }
      if (!ticket.buyerEmail) {
        return NextResponse.json({ error: "No email on ticket" }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
      const treeNumber = Number(await redis.get("brote:counter") ?? 1);
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
        to: ticket.buyerEmail,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml(ticket, treeNumber),
        attachments: [{
          filename: "qr.png",
          content: qrDataUrlToBuffer(qrDataUrl),
          contentType: "image/png",
          contentId: "qr",
        }],
      });

      ticket.emailSent = true;
      await redis.set(`brote:ticket:${ticket.id}`, JSON.stringify(ticket));

      return NextResponse.json({
        ok: true,
        to: ticket.buyerEmail,
        resendId: result.data?.id,
      });
    }

    // ── Plant invite campaign: send Email 1 or Email 2 to BROTE party buyers ──
    // Body: { action: "plant-invite-campaign", variant: 1 | 2, mode: "preview" | "send" }
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
        // Override mode — bypass exclusion logic, send to specified addresses only
        audience = audienceOverride.map((e) => e.trim().toLowerCase()).filter(Boolean);
      } else {
        // Build the audience: BROTE attendees minus anyone already plant-registered
        const attendeesRaw: string[] = await redis.sMembers("brote:attendees");
        const buyerEmails = new Set<string>();
        for (const raw of attendeesRaw) {
          try {
            const a = JSON.parse(raw);
            if (a.email) buyerEmails.add(String(a.email).toLowerCase());
          } catch { /* skip */ }
        }

        const plantKeys: string[] = await redis.keys("plant:registration:*");
        const plantEmails = new Set<string>();
        for (const k of plantKeys) {
          const raw = await redis.get(k);
          if (!raw) continue;
          try {
            const r = JSON.parse(raw);
            if (r.email) plantEmails.add(String(r.email).toLowerCase());
          } catch { /* skip */ }
        }

        audience = Array.from(buyerEmails).filter((e) => !plantEmails.has(e));
        buyerEmailsSize = buyerEmails.size;
        plantEmailsSize = plantEmails.size;
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

      // m === "send"
      const plantCounter = Number(await redis.get("plant:counter") ?? 0);
      const remaining = Math.max(0, plantConfig.capacity - plantCounter);

      const subject =
        v === 1
          ? "Si le tenés miedo a la pala 🪏, no abrás este mail"
          : `Quedan ${remaining} lugares para el 19 de abril`;

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

      // Mark this campaign as sent (audit trail)
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

    // ── Plant: resend confirmation email by registration ID or email ──
    if (action === "plant-resend-email") {
      let registration: PlantRegistration | null = null;

      // Lookup by registrationId if provided, else by email via plant:registrations set
      const regId = (await req.headers.get("x-registration-id")) || undefined;
      const lookupEmail = toEmail?.toLowerCase();

      if (regId) {
        const raw = await redis.get(`plant:registration:${regId}`);
        if (raw) registration = JSON.parse(raw);
      } else if (lookupEmail) {
        const allKeys = await redis.keys("plant:registration:*");
        for (const k of allKeys) {
          const raw = await redis.get(k);
          if (!raw) continue;
          const r: PlantRegistration = JSON.parse(raw);
          if (r.email.toLowerCase() === lookupEmail) {
            registration = r;
            break;
          }
        }
      }

      if (!registration) {
        return NextResponse.json({ error: "Plant registration not found" }, { status: 404 });
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
            client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
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

    if (action === "gift-ticket") {
      if (!toEmail) {
        return NextResponse.json({ error: "toEmail required" }, { status: 400 });
      }

      const { nanoid } = await import("nanoid");
      const ticketId = `BROTE-${nanoid(8).toUpperCase()}`;
      const ticket: BroteTicket = {
        id: ticketId,
        type: "ticket",
        paymentId: "GIFT",
        buyerEmail: toEmail,
        buyerName: giftName || "Invitado/a",
        status: "valid",
        createdAt: new Date().toISOString(),
      };

      await redis.set(`brote:ticket:${ticketId}`, JSON.stringify(ticket));
      await redis.set(`brote:payment:GIFT-${ticketId}`, ticketId);
      const treeNumber = await redis.incr("brote:counter");
      await redis.sAdd("brote:attendees", JSON.stringify({
        email: toEmail,
        name: ticket.buyerName,
        ticketId,
        createdAt: ticket.createdAt,
      }));

      // Send email
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";
      const qrUrl = `${baseUrl}/es/brote/gate?ticket=${ticketId}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#2D4A3E", light: "#FAF6F1" },
      });

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const result = await resend.emails.send({
        from: `BROTE <${fromEmail}>`,
        to: toEmail,
        subject: `Tu entrada para BROTE 🌱 Árbol #${treeNumber}`,
        html: buildTicketEmailHtml(ticket, treeNumber),
        attachments: [{
          filename: "qr.png",
          content: qrDataUrlToBuffer(qrDataUrl),
          contentType: "image/png",
          contentId: "qr",
        }],
      });

      ticket.emailSent = true;
      await redis.set(`brote:ticket:${ticketId}`, JSON.stringify(ticket));

      return NextResponse.json({
        ok: true,
        ticketId,
        treeNumber,
        to: toEmail,
        resendId: result.data?.id,
      });
    }

    if (action === "send-reminder") {
      const counter = Number(await redis.get("brote:counter") ?? 0);
      const treesRemaining = Math.max(0, 100 - counter);

      // Get unique emails from attendees
      const attendeesRaw = await redis.sMembers("brote:attendees");
      const emails = new Set<string>();
      for (const raw of attendeesRaw) {
        try {
          const a = JSON.parse(raw);
          if (a.email) emails.add(a.email.toLowerCase());
        } catch { /* skip */ }
      }

      if (emails.size === 0) {
        return NextResponse.json({ error: "No attendees found" }, { status: 400 });
      }

      const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const html = buildReminderEmailHtml(treesRemaining);

      const results: { email: string; ok: boolean; error?: string }[] = [];
      for (const email of emails) {
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
        totalEmails: emails.size,
        sent,
        failed,
      });
    }

    if (action === "lookup-payment" && paymentId) {
      const ticketIdForPayment = await redis.get(`brote:payment:${paymentId}`);
      if (!ticketIdForPayment) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }
      const raw = await redis.get(`brote:ticket:${ticketIdForPayment}`);
      return NextResponse.json({
        ticketId: ticketIdForPayment,
        ticket: raw ? JSON.parse(raw) : null,
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
