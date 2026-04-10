import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { Resend } from "resend";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { buildPlantConfirmationEmailHtml } from "@/lib/plant-email";
import type { PlantRegistration } from "@/lib/plant-types";

export async function POST(req: Request) {
  const session = await requireAdminSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { action } = body as { action: string };
  const redis = await getRedis();

  // ── Plant: resend confirmation email ──
  if (action === "plant-resend-email") {
    const email = (body.email as string || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const keys: string[] = await redis.keys("plant:registration:*");
    let registration: PlantRegistration | null = null;
    for (const k of keys) {
      const raw = await redis.get(k);
      if (!raw) continue;
      const r: PlantRegistration = JSON.parse(raw);
      if (r.email.toLowerCase() === email) {
        registration = r;
        break;
      }
    }

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const result = await resend.emails.send({
      from: `BROTE <${fromEmail}>`,
      to: registration.email,
      subject: "¡Te anotaste para plantar! 🌱 Detalles del evento",
      html: buildPlantConfirmationEmailHtml(registration.name),
    });

    return NextResponse.json({ ok: true, resendId: result.data?.id });
  }

  // ── Export registrations as CSV ──
  if (action === "export-csv") {
    const keys: string[] = await redis.keys("plant:registration:*");
    const rows: string[] = [
      "id,name,email,groupType,carpool,message,utmSource,utmMedium,utmCampaign,createdAt",
    ];
    for (const k of keys) {
      const raw = await redis.get(k);
      if (!raw) continue;
      try {
        const r = JSON.parse(raw);
        const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
        rows.push(
          [
            esc(r.id),
            esc(r.name),
            esc(r.email),
            esc(r.groupType),
            r.carpool ? "true" : "false",
            esc(r.message || ""),
            esc(r.utm?.source || ""),
            esc(r.utm?.medium || ""),
            esc(r.utm?.campaign || ""),
            esc(r.createdAt),
          ].join(","),
        );
      } catch { /* skip */ }
    }

    return new NextResponse(rows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
