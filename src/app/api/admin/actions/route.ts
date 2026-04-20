import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import {
  assertCanWriteEvent,
  assertEventAccess,
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";
import { buildPlantConfirmationEmailHtml } from "@/lib/plant-email";

const PLANT_EVENT_ID = "plant-2026-04";

// Per-branch role/scope gating. Each action block asserts what it needs
// rather than gating once at the top — some actions are event-scoped
// (plant resend, CSV export), others are global ops (fix-campaign-log).
// When adding a new action, explicitly call out the access requirement;
// don't let it inherit a broader default.
export async function POST(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { action } = body as { action: string };

  // ── Plant: resend confirmation email ──
  // Write action bound to the plant event.
  if (action === "plant-resend-email") {
    const denied = assertCanWriteEvent(session, PLANT_EVENT_ID);
    if (denied) return denied;

    const email = (body.email as string || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const rows = await db
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
      .where(eq(schema.participations.eventId, PLANT_EVENT_ID))
      .limit(200);

    const registration = rows.find(
      (r) => (r.email ?? "").toLowerCase() === email,
    );
    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 },
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const result = await resend.emails.send({
      from: `BROTE <${fromEmail}>`,
      to: registration.email!,
      subject: "¡Te anotaste para plantar! 🌱 Detalles del evento",
      html: buildPlantConfirmationEmailHtml(registration.name),
    });

    return NextResponse.json({ ok: true, resendId: result.data?.id });
  }

  // ── Export plant registrations as CSV ──
  // Read access to the plant event is enough — exports don't mutate state.
  if (action === "export-csv") {
    const denied = assertEventAccess(session, PLANT_EVENT_ID);
    if (denied) return denied;

    const rows = await db
      .select({
        id: schema.participations.id,
        email: schema.people.email,
        name: schema.people.name,
        createdAt: schema.participations.createdAt,
        metadata: schema.participations.metadata,
        attribution: schema.participations.attribution,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(eq(schema.participations.eventId, PLANT_EVENT_ID))
      .orderBy(asc(schema.participations.createdAt));

    const header =
      "id,name,email,groupType,carpool,message,utmSource,utmMedium,utmCampaign,createdAt";
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;

    const csvRows: string[] = [header];
    for (const r of rows) {
      const m = (r.metadata as Record<string, unknown>) ?? {};
      const a = (r.attribution as Record<string, unknown> | null) ?? null;
      csvRows.push(
        [
          esc(r.id),
          esc(r.name),
          esc(r.email ?? ""),
          esc((m.groupType as string) ?? ""),
          m.carpool ? "true" : "false",
          esc((m.message as string) ?? ""),
          esc((a?.source as string) ?? ""),
          esc((a?.medium as string) ?? ""),
          esc((a?.campaign as string) ?? ""),
          esc(r.createdAt.toISOString()),
        ].join(","),
      );
    }

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  // ── Campaign log correction (still in Redis per spec) ──
  // Global ops — only for users with full access; and specifically an
  // editor write (not a viewer).
  if (action === "fix-campaign-log") {
    const deniedScope = assertFullAccess(session);
    if (deniedScope) return deniedScope;
    if (session.role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { variant: v, data } = body as {
      variant: number;
      data: { sent: number; audienceSize: number; subject?: string };
    };
    if (!v || !data) {
      return NextResponse.json(
        { error: "variant and data required" },
        { status: 400 },
      );
    }
    const redis = await getRedis();
    await redis.set(
      `plant:campaign:${v}:sent`,
      JSON.stringify({
        sentAt: new Date().toISOString(),
        subject: data.subject || "",
        audienceSize: data.audienceSize,
        sent: data.sent,
        failedCount: 0,
        note: "Manually corrected",
      }),
    );
    return NextResponse.json({ ok: true, variant: v, data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
