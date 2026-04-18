import { customAlphabet } from "nanoid";

// ============================================================
// Channels & UTM mapping
// ============================================================

export const CHANNEL_KEYS = [
  "ig-story",
  "ig-post",
  "ig-reel",
  "ig-ad",
  "ig-dm",
  "ig-bio",
  "email-campaign",
  "email-personal",
  "wa-group",
  "wa-broadcast",
  "wa-personal",
  "direct",
  "press",
  "partner",
  "other",
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export interface ChannelMeta {
  key: ChannelKey;
  display: string;
  source: string;
  medium: string;
  slugPrefix: string;
  group: "instagram" | "email" | "whatsapp" | "otro";
}

export const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  "ig-story": { key: "ig-story", display: "IG Story", source: "instagram", medium: "story", slugPrefix: "ig-story", group: "instagram" },
  "ig-post": { key: "ig-post", display: "IG Post", source: "instagram", medium: "post", slugPrefix: "ig-post", group: "instagram" },
  "ig-reel": { key: "ig-reel", display: "IG Reel", source: "instagram", medium: "reel", slugPrefix: "ig-reel", group: "instagram" },
  "ig-ad": { key: "ig-ad", display: "IG Ad", source: "instagram", medium: "ad", slugPrefix: "ig-ad", group: "instagram" },
  "ig-dm": { key: "ig-dm", display: "IG DM", source: "instagram", medium: "dm", slugPrefix: "ig-dm", group: "instagram" },
  "ig-bio": { key: "ig-bio", display: "IG Bio", source: "instagram", medium: "bio", slugPrefix: "ig-bio", group: "instagram" },
  "email-campaign": { key: "email-campaign", display: "Email campaña", source: "email", medium: "campaign", slugPrefix: "email", group: "email" },
  "email-personal": { key: "email-personal", display: "Email personal", source: "email", medium: "personal", slugPrefix: "email-dm", group: "email" },
  "wa-group": { key: "wa-group", display: "WhatsApp grupo", source: "whatsapp", medium: "group", slugPrefix: "wa-group", group: "whatsapp" },
  "wa-broadcast": { key: "wa-broadcast", display: "WhatsApp broadcast", source: "whatsapp", medium: "broadcast", slugPrefix: "wa-bc", group: "whatsapp" },
  "wa-personal": { key: "wa-personal", display: "WhatsApp personal", source: "whatsapp", medium: "personal", slugPrefix: "wa-dm", group: "whatsapp" },
  direct: { key: "direct", display: "Directo", source: "direct", medium: "direct", slugPrefix: "direct", group: "otro" },
  press: { key: "press", display: "Prensa", source: "press", medium: "article", slugPrefix: "press", group: "otro" },
  partner: { key: "partner", display: "Partner", source: "partner", medium: "referral", slugPrefix: "partner", group: "otro" },
  other: { key: "other", display: "Otro", source: "other", medium: "other", slugPrefix: "other", group: "otro" },
};

export function isChannelKey(value: unknown): value is ChannelKey {
  return typeof value === "string" && CHANNEL_KEYS.includes(value as ChannelKey);
}

// ============================================================
// Known destinations (for the creation form dropdown)
// ============================================================

export const KNOWN_DESTINATIONS: { path: string; display: string }[] = [
  { path: "/es", display: "Home (/es)" },
  { path: "/es/brote", display: "Plantación / BROTE (/es/brote)" },
  { path: "/es/sinergia", display: "Sinergia (/es/sinergia)" },
];

// ============================================================
// Slug generation
// ============================================================

// nanoid(3) with a lowercase-alphanumeric alphabet for readable slugs.
const nano3 = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 3);

/** YYYYMMDD from a YYYY-MM-DD date string. */
function compactDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export function generateSlug(channel: ChannelKey, isoDate: string): string {
  const meta = CHANNELS[channel];
  return `${meta.slugPrefix}-${compactDate(isoDate)}-${nano3()}`;
}

// ============================================================
// Campaign derivation + label formatting
// ============================================================

/** Derive a default utm_campaign from the destination path. "/es/plantacion" → "plantacion". */
export function deriveCampaignFromDestination(destination: string): string {
  try {
    const url = destination.startsWith("http")
      ? new URL(destination)
      : new URL(destination, "https://www.harisolaas.com");
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last === "es" || last === "en") return "home";
    return last;
  } catch {
    return "home";
  }
}

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "IG Story · 17 abr 2026" from a channel + YYYY-MM-DD. */
export function formatAutoLabel(channel: ChannelKey, isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = String(d);
  const month = MONTHS_ES[(m ?? 1) - 1] ?? "ene";
  return `${CHANNELS[channel].display} · ${day} ${month} ${y}`;
}

// ============================================================
// Destination URL builder (used by /go/[slug])
// ============================================================

const BASE_URL = "https://www.harisolaas.com";

export function buildDestinationUrl(
  destination: string,
  params: {
    source: string;
    medium: string;
    campaign: string;
    slug: string;
  },
): string {
  const url = destination.startsWith("http")
    ? new URL(destination)
    : new URL(destination, BASE_URL);

  // Preserve any existing query on destination; our UTMs take precedence.
  url.searchParams.set("utm_source", params.source);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);
  url.searchParams.set("utm_content", params.slug);
  return url.toString();
}

// ============================================================
// Bot detection
// ============================================================

const BOT_UA_RX =
  /bot|crawler|spider|crawling|facebookexternalhit|embedly|slackbot|whatsapp|telegram|discordbot|linkedinbot|twitterbot|preview|curl|wget|python-requests|okhttp|postman/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true; // no UA → treat as bot
  return BOT_UA_RX.test(ua);
}
