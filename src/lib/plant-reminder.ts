import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import {
  sendBulkEmails,
  type BulkEmailFailure,
  type BulkEmailWarning,
} from "@/lib/bulk-email";
import { notifyAdminOfCampaign } from "@/lib/admin-alert";
import { buildPlantReminderEmailHtml } from "./plant-email";

const PLANT_EVENT_ID = "plant-2026-04";
// One-shot campaign slug for the 2026-04-19 plantación. If this template ever
// gets reused for another plantación, bump the date here AND update the cron
// schedule + date guard in /api/cron/plant-reminder/route.ts.
const CAMPAIGN = "plant-day-of-reminder-2026-04-19";
const WA_SLUG = "email-plant-reminder-20260419";
const WA_DESTINATION =
  "https://wa.me/5491122555110?text=" +
  encodeURIComponent(
    "Hola Hari, me anoté para la plantación de hoy, te consulto...",
  );
const SUBJECT = "Hoy plantamos 🌱 Te esperamos a las 14:30 en la reserva";

export interface PlantReminderResult {
  ok: true;
  mode: "preview" | "send";
  subject: string;
  waSlug: string;
  waUrl: string;
  audienceSize: number;
  audienceSample?: string[];
  sent?: number;
  skipped?: number;
  failed?: BulkEmailFailure[];
  warnings?: BulkEmailWarning[];
  override: boolean;
  adminAlert?: { notified: boolean; reason?: string };
}

/**
 * Day-of reminder for the 2026-04-19 plantación.
 *
 * Upserts a tracked `/go/<slug>` redirect to Hari's WhatsApp so clicks land
 * in `link_clicks`, then (in send mode) emails every confirmed plant
 * registrant via the shared `sendBulkEmails` helper. `audienceOverride`
 * replaces the DB audience with a literal list of emails — used for test
 * sends and for the admin preview endpoint.
 */
export async function runPlantReminderCampaign(opts: {
  mode: "preview" | "send";
  audienceOverride?: string[];
}): Promise<PlantReminderResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

  // Upsert the tracked WhatsApp link so clicks are attributed to this campaign.
  await db
    .insert(schema.links)
    .values({
      slug: WA_SLUG,
      destination: WA_DESTINATION,
      label: "Email · Recordatorio plantación 19 abr · WhatsApp Hari",
      channel: "email-campaign",
      source: "email",
      medium: "campaign",
      campaign: "plantacion_reminder_day_of",
      createdDate: "2026-04-19",
      createdBy: "plant-send-reminder",
      note: "Auto-created by plant reminder campaign.",
    })
    .onConflictDoNothing();

  const waUrl = `${baseUrl}/go/${WA_SLUG}`;

  const rows = await db
    .select({
      rsvpId: schema.participations.id,
      email: schema.people.email,
      name: schema.people.name,
      status: schema.participations.status,
    })
    .from(schema.participations)
    .innerJoin(
      schema.people,
      eq(schema.people.id, schema.participations.personId),
    )
    .where(eq(schema.participations.eventId, PLANT_EVENT_ID));

  const registrants = rows
    .filter((r) => r.status !== "waitlist" && r.email)
    .map((r) => ({
      rsvpId: r.rsvpId,
      email: (r.email ?? "").toLowerCase(),
      name: r.name,
    }));

  // Dedupe by email (if the same person has two registrations, only one mail).
  const byEmail = new Map<string, { rsvpId: string; name: string }>();
  for (const r of registrants) {
    if (!byEmail.has(r.email)) {
      byEmail.set(r.email, { rsvpId: r.rsvpId, name: r.name });
    }
  }

  const override = Boolean(
    opts.audienceOverride && opts.audienceOverride.length > 0,
  );
  let audience: { email: string; rsvpId: string; name: string }[] = Array.from(
    byEmail.entries(),
  ).map(([email, v]) => ({ email, rsvpId: v.rsvpId, name: v.name }));
  if (override) {
    const overrideSet = new Set(
      opts
        .audienceOverride!.map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
    audience = Array.from(overrideSet).map((email) => {
      const existing = byEmail.get(email);
      return {
        email,
        rsvpId: existing?.rsvpId ?? `override:${email}`,
        name: existing?.name ?? "",
      };
    });
  }

  if (opts.mode === "preview") {
    return {
      ok: true,
      mode: "preview",
      subject: SUBJECT,
      waSlug: WA_SLUG,
      waUrl,
      audienceSize: audience.length,
      audienceSample: audience.slice(0, 10).map((a) => a.email),
      override,
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  const resend = new Resend(process.env.RESEND_API_KEY!);
  // Per-rsvp idempotency flag mirroring the Sinergia reminder pattern. If the
  // cron retries or someone curls the URL after it fires, recipients already
  // flagged are skipped rather than re-emailed.
  const redis = await getRedis();

  const result = await sendBulkEmails({
    audience,
    resend,
    getEmail: (r) => r.email,
    build: (r) => ({
      from: `BROTE <${fromEmail}>`,
      to: r.email,
      subject: SUBJECT,
      html: buildPlantReminderEmailHtml(r.name, waUrl),
    }),
    shouldSkip: async (r) => {
      const flagKey = `plant:rsvp:${r.rsvpId}:day-of-reminder`;
      return Boolean(await redis.get(flagKey));
    },
    onSent: async (r) => {
      const flagKey = `plant:rsvp:${r.rsvpId}:day-of-reminder`;
      await redis.set(flagKey, "1");
    },
    logPrefix: "plant-reminder",
  });

  const adminAlert = await notifyAdminOfCampaign({
    campaign: CAMPAIGN,
    audienceSize: audience.length,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    warnings: result.warnings,
    note: override ? "Run used audienceOverride (not the full DB audience)." : undefined,
  });

  return {
    ok: true,
    mode: "send",
    subject: SUBJECT,
    waSlug: WA_SLUG,
    waUrl,
    audienceSize: audience.length,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    warnings: result.warnings,
    override,
    adminAlert,
  };
}
