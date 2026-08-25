/**
 * The "Comunidad BROTE" win-back campaign — three waves to everyone who came
 * to BROTE 1 or the planting day and has not bought for BROTE 2.
 *
 * Shaped after `plant-reminder.ts`: upsert the tracked `/go/` link, build the
 * audience, then hand the send to `sendBulkEmails` so a Resend `{data:null,
 * error}` response can never be counted as a delivery (see the 2026-04-19
 * incident in `docs/ops/mass-email-sends.md`).
 *
 * The audience query runs fresh on every wave, so anyone who buys between
 * sends drops out of the next one without anybody maintaining a list.
 */

import { Resend } from "resend";
import { db, schema } from "@/db";
import { getRedis } from "@/lib/redis";
import {
  sendBulkEmails,
  type BulkEmailFailure,
  type BulkEmailWarning,
} from "@/lib/bulk-email";
import { notifyAdminOfCampaign } from "@/lib/admin-alert";
import {
  countComunidadAudienceMissingEmail,
  loadComunidadAudience,
} from "@/lib/brote-comunidad-audience";
import {
  renderComunidadEmail,
  waveCtaUrl,
  waveLinkSlug,
  type ComunidadWave,
} from "@/lib/brote-comunidad-email";

const INVITATION_PATH = "/es/brote/invitacion/comunidad";

/** Stable per-wave slug so the admin inbox and the runbook stay greppable. */
function campaignSlug(wave: ComunidadWave): string {
  return `brote-comunidad-w${wave}-2026-08`;
}

/** Per-person, per-wave: wave 2 is not blocked by wave 1's flag. */
function flagKey(personKey: string, wave: ComunidadWave): string {
  return `brote:comunidad:${personKey}:w${wave}`;
}

const WAVE_LABEL: Record<ComunidadWave, string> = {
  1: "Email · Comunidad BROTE · Ola 1 (el regalo)",
  2: "Email · Comunidad BROTE · Ola 2 (line up)",
  3: "Email · Comunidad BROTE · Ola 3 (mañana)",
};

interface Recipient {
  /** `personId` as a string, or `override:<email>` for a hand-typed address. */
  personKey: string;
  email: string;
  name: string | null;
  cameToBrote1: boolean;
  cameToPlant: boolean;
}

export interface ComunidadCampaignResult {
  ok: true;
  wave: ComunidadWave;
  mode: "preview" | "send";
  campaign: string;
  subject: string;
  linkSlug: string;
  ctaUrl: string;
  audienceSize: number;
  segments: { brote1: number; plant: number; both: number };
  audienceSample?: string[];
  sent?: number;
  skipped?: number;
  failed?: BulkEmailFailure[];
  warnings?: BulkEmailWarning[];
  override: boolean;
  adminAlert?: { notified: boolean; reason?: string };
}

export async function runComunidadCampaign(opts: {
  wave: ComunidadWave;
  mode: "preview" | "send";
  audienceOverride?: string[];
}): Promise<ComunidadCampaignResult> {
  const { wave } = opts;
  const slug = waveLinkSlug(wave);

  // One clock for the whole wave.
  //
  // The body is time-dependent — the price-rise line, the preheader and the
  // public price all branch on `now` — and a send throttled at 1s/recipient
  // takes minutes. Left to each render's default, a wave that crosses
  // midnight (or the preventa deadline) would deliver two different mails
  // under one subject, and the people at the end of the alphabet would get
  // the other one.
  const renderNow = new Date();

  // Tracked short link, upserted here rather than in a seed script so the
  // campaign cannot run against a `/go/` slug that has no row — the redirect
  // would 404 and the whole wave would be unclickable.
  await db
    .insert(schema.links)
    .values({
      slug,
      destination: INVITATION_PATH,
      label: WAVE_LABEL[wave],
      channel: "email-campaign",
      source: "email",
      medium: "campaign",
      campaign: "brote-comunidad",
      // Buenos Aires, not UTC: a wave sent at 21:00 ART would otherwise be
      // filed under tomorrow in the admin's by-date view.
      createdDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date()),
      createdBy: "brote-comunidad-campaign",
      note: "Auto-created by the Comunidad BROTE win-back campaign.",
    })
    .onConflictDoNothing();

  const rows = await loadComunidadAudience();
  const byEmail = new Map(rows.filter((r) => r.email).map((r) => [r.email, r]));

  const override = Boolean(
    opts.audienceOverride && opts.audienceOverride.length > 0,
  );

  let audience: Recipient[];
  if (override) {
    const emails = new Set(
      opts.audienceOverride!.map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
    audience = Array.from(emails).map((email) => {
      const known = byEmail.get(email);
      return {
        // An address that IS in the real audience keeps its person key, so a
        // test send to your own inbox also marks you as done for the real run
        // — which is what you want, and never touches anybody else's flag.
        personKey: known ? String(known.personId) : `override:${email}`,
        email,
        name: known?.name ?? null,
        cameToBrote1: known?.cameToBrote1 ?? false,
        cameToPlant: known?.cameToPlant ?? false,
      };
    });
  } else {
    audience = Array.from(byEmail.values()).map((r) => ({
      personKey: String(r.personId),
      email: r.email,
      name: r.name,
      cameToBrote1: r.cameToBrote1,
      cameToPlant: r.cameToPlant,
    }));
  }

  const segments = {
    brote1: audience.filter((r) => r.cameToBrote1 && !r.cameToPlant).length,
    plant: audience.filter((r) => !r.cameToBrote1 && r.cameToPlant).length,
    both: audience.filter((r) => r.cameToBrote1 && r.cameToPlant).length,
  };

  // The subject does not vary per recipient, so one render answers for the
  // whole wave — and the preview reports the real string, not a copy of it.
  const { subject } = renderComunidadEmail(
    wave,
    { name: null, cameToBrote1: true, cameToPlant: false },
    renderNow,
  );

  const base = {
    ok: true as const,
    wave,
    campaign: campaignSlug(wave),
    subject,
    linkSlug: slug,
    ctaUrl: waveCtaUrl(wave),
    audienceSize: audience.length,
    segments,
    override,
  };

  if (opts.mode === "preview") {
    return {
      ...base,
      mode: "preview",
      audienceSample: audience.slice(0, 10).map((a) => a.email),
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "brote@harisolaas.com";
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const redis = await getRedis();

  const result = await sendBulkEmails({
    audience,
    resend,
    getEmail: (r) => r.email,
    build: (r) => {
      const { subject: s, html } = renderComunidadEmail(
        wave,
        {
          name: r.name,
          cameToBrote1: r.cameToBrote1,
          cameToPlant: r.cameToPlant,
        },
        renderNow,
      );
      return {
        from: `BROTE <${fromEmail}>`,
        to: r.email,
        subject: s,
        html,
        // This is marketing, not a receipt. There is no unsubscribe endpoint
        // in the repo, so the header points at the same reply address the
        // footer names — one honest channel rather than a dead link.
        headers: {
          "List-Unsubscribe": `<mailto:${fromEmail}?subject=BAJA>`,
        },
      };
    },
    shouldSkip: async (r) => Boolean(await redis.get(flagKey(r.personKey, wave))),
    onSent: async (r) => {
      await redis.set(flagKey(r.personKey, wave), "1");
    },
    // 1000ms, not the 600ms default: the 2026-04-19 incident was Resend 429s,
    // and a wave sent eight days before the party has no room for a blind
    // retry round.
    throttleMs: 1000,
    logPrefix: `brote-comunidad-w${wave}`,
  });

  const adminAlert = await notifyAdminOfCampaign({
    campaign: campaignSlug(wave),
    audienceSize: audience.length,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    warnings: result.warnings,
    // Only meaningful for a full run: with an override the audience was
    // chosen by hand, so "who has no email on file" says nothing about it.
    missingEmails: override ? 0 : await countComunidadAudienceMissingEmail(),
    note: override
      ? "Run used audienceOverride (not the full DB audience)."
      : undefined,
  });

  return {
    ...base,
    mode: "send",
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    warnings: result.warnings,
    adminAlert,
  };
}
