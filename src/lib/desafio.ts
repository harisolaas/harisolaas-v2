/**
 * Desafío — pure domain logic (no DB). Safe to import from client
 * components: the admin editor uses `parseDesafioMedia` to preview the
 * detected media kind while typing.
 */
import {
  argentinaToday,
  dayDate,
  desafioConfig,
  desafioPhase,
  desafioStartDate,
  formatDayDate,
  isDayUnlocked,
  type DesafioLocale,
  type DesafioPhase,
} from "@/data/desafio";
import type { NowItem } from "@/dictionaries/types";

// ============================================================
// Media
// ============================================================

export type DesafioMedia =
  | { kind: "youtube"; url: string; embedUrl: string }
  | { kind: "audio"; url: string }
  | { kind: "link"; url: string };

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);
const YOUTUBE_ID_RE = /^[\w-]{11}$/;
const AUDIO_EXT_RE = /\.(mp3|m4a|ogg|wav|aac)$/i;

function youtubeId(url: URL): string | null {
  let candidate: string | null = null;
  if (url.hostname === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") candidate = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed") {
      candidate = parts[1] ?? null;
    }
  } else {
    return null;
  }
  return candidate && YOUTUBE_ID_RE.test(candidate) ? candidate : null;
}

/**
 * Classify a media URL. Returns null for anything that isn't a parseable
 * http(s) URL — that rejects `javascript:`, `data:`, `ftp:` and garbage,
 * so whatever comes back is safe to put in an href/src.
 */
export function parseDesafioMedia(
  raw: string | null | undefined,
): DesafioMedia | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const id = youtubeId(url);
  if (id) {
    return {
      kind: "youtube",
      url: trimmed,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }
  if (AUDIO_EXT_RE.test(url.pathname)) return { kind: "audio", url: trimmed };
  return { kind: "link", url: trimmed };
}

// ============================================================
// Public days (what the landing renders)
// ============================================================

export interface ChallengeDayRow {
  dayNumber: number;
  title: string | null;
  body: string | null;
  mediaUrl: string | null;
  published: boolean;
}

export type DesafioDayState = "locked" | "empty" | "open";

export interface DesafioPublicDay {
  dayNumber: number;
  date: string;
  dateLabel: string;
  state: DesafioDayState;
  isToday: boolean;
  // ONLY present when state === "open"
  title?: string;
  body?: string;
  media?: DesafioMedia | null;
}

/**
 * Always returns `totalDays` entries. Security invariant: locked days
 * never carry title/body/media, even when the row is published — the
 * date gate is enforced here, server-side, before anything is serialized
 * to the client.
 */
export function buildPublicDays(
  rows: ChallengeDayRow[],
  now: Date,
  locale: DesafioLocale,
  start: string = desafioStartDate(),
): DesafioPublicDay[] {
  const byDay = new Map(rows.map((r) => [r.dayNumber, r]));
  const today = argentinaToday(now);
  const days: DesafioPublicDay[] = [];

  for (let n = 1; n <= desafioConfig.totalDays; n++) {
    const date = dayDate(n, start);
    const base = {
      dayNumber: n,
      date,
      dateLabel: formatDayDate(date, locale),
      isToday: date === today,
    };
    if (!isDayUnlocked(n, now, start)) {
      days.push({ ...base, state: "locked" });
      continue;
    }
    const row = byDay.get(n);
    const title = row?.title?.trim();
    if (!row || !row.published || !title) {
      days.push({ ...base, state: "empty" });
      continue;
    }
    days.push({
      ...base,
      state: "open",
      title,
      body: row.body ?? "",
      media: parseDesafioMedia(row.mediaUrl),
    });
  }
  return days;
}

// ============================================================
// Admin input
// ============================================================

export interface DayInput {
  title: string | null;
  body: string | null;
  mediaUrl: string | null;
  published: boolean;
}

export const DAY_TITLE_MAX = 120;
export const DAY_BODY_MAX = 4000;
export const DAY_MEDIA_URL_MAX = 500;

const INVALID = "Datos inválidos";

function normalizeText(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined; // signals invalid
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Full-replace semantics: a missing field becomes null / false. Error
 * strings are Spanish and shown verbatim by the admin UI.
 */
export function validateDayInput(
  raw: unknown,
): { ok: true; value: DayInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: INVALID };
  }
  const r = raw as Record<string, unknown>;

  const title = normalizeText(r.title);
  const body = normalizeText(r.body);
  const mediaUrl = normalizeText(r.mediaUrl);
  if (title === undefined || body === undefined || mediaUrl === undefined) {
    return { ok: false, error: INVALID };
  }
  if (r.published !== undefined && typeof r.published !== "boolean") {
    return { ok: false, error: INVALID };
  }
  const published = r.published === true;

  if (title && title.length > DAY_TITLE_MAX) {
    return { ok: false, error: "El título no puede superar 120 caracteres" };
  }
  if (body && body.length > DAY_BODY_MAX) {
    return { ok: false, error: "El texto no puede superar 4000 caracteres" };
  }
  // Stricter than parseDesafioMedia (which tolerates http: for rendering):
  // an http audio file on the https page is mixed content, so new input must
  // be https — which is exactly what the error message promises.
  if (
    mediaUrl &&
    (mediaUrl.length > DAY_MEDIA_URL_MAX ||
      !/^https:\/\//i.test(mediaUrl) ||
      !parseDesafioMedia(mediaUrl))
  ) {
    return {
      ok: false,
      error: "El link tiene que ser una URL válida que empiece con https://",
    };
  }
  if (published && !title) {
    return { ok: false, error: "Para publicar, el día necesita un título" };
  }

  return { ok: true, value: { title, body, mediaUrl, published } };
}

/** Integer 1..totalDays from a route segment, else null. */
export function parseDayNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= desafioConfig.totalDays ? n : null;
}

// ============================================================
// Admin API shapes (GET /api/admin/desafio, PUT …/days/[day])
// ============================================================
// Pure types + builder so the admin client component can import them
// without touching the server-only DB layer.

export interface DesafioAdminDay {
  dayNumber: number;
  date: string;
  dateLabel: string;
  unlocked: boolean;
  title: string | null;
  body: string | null;
  mediaUrl: string | null;
  mediaKind: DesafioMedia["kind"] | null;
  published: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export interface DesafioAdminRegistrant {
  participationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  waMe: string | null;
  createdAt: string;
  status: string;
}

export interface DesafioAdminResponse {
  event: {
    id: string;
    startDate: string;
    totalDays: number;
    phase: "before" | "live" | "after";
    unlockedDays: number;
  };
  days: DesafioAdminDay[];
  registrants: DesafioAdminRegistrant[];
  counts: { registered: number; daysReady: number };
}

export type ChallengeDayAdminRow = ChallengeDayRow & {
  updatedAt: Date | string | null;
  updatedByEmail: string | null;
};

/** One admin day entry. `row` is undefined when nothing is stored yet. */
export function buildAdminDay(
  dayNumber: number,
  row: ChallengeDayAdminRow | undefined,
  now: Date,
  start: string = desafioStartDate(),
): DesafioAdminDay {
  const date = dayDate(dayNumber, start);
  const updatedAt = row?.updatedAt
    ? new Date(row.updatedAt).toISOString()
    : null;
  return {
    dayNumber,
    date,
    dateLabel: formatDayDate(date, "es"),
    unlocked: isDayUnlocked(dayNumber, now, start),
    title: row?.title ?? null,
    body: row?.body ?? null,
    mediaUrl: row?.mediaUrl ?? null,
    mediaKind: parseDesafioMedia(row?.mediaUrl)?.kind ?? null,
    published: row?.published ?? false,
    updatedAt,
    updatedByEmail: row?.updatedByEmail ?? null,
  };
}

/** All `totalDays` admin entries, filling gaps with empty days. */
export function buildAdminDays(
  rows: ChallengeDayAdminRow[],
  now: Date,
  start: string = desafioStartDate(),
): DesafioAdminDay[] {
  const byDay = new Map(rows.map((r) => [r.dayNumber, r]));
  return Array.from({ length: desafioConfig.totalDays }, (_, i) =>
    buildAdminDay(i + 1, byDay.get(i + 1), now, start),
  );
}

/** A day counts as ready when it would render as "open" once unlocked. */
export function isDayReady(row: Pick<ChallengeDayRow, "published" | "title">): boolean {
  return row.published && Boolean(row.title?.trim());
}

// ============================================================
// Home "Ahora" card
// ============================================================

/**
 * Pick the desafío card's copy for `phase`: the item's top-level fields are
 * the "before" copy; `desafioPhases` overrides description/status (and the
 * CTA label, when given) once the challenge is live or over. Items without
 * `desafioPhases` pass through untouched. The phase map is dropped so it
 * never reaches the client component.
 */
export function resolveDesafioNowItem(item: NowItem, phase: DesafioPhase): NowItem {
  const { desafioPhases, ...base } = item;
  if (!desafioPhases || phase === "before") return base;
  const copy = desafioPhases[phase];
  return {
    ...base,
    description: copy.description,
    status: copy.status,
    ...(base.cta && copy.ctaLabel
      ? { cta: { ...base.cta, label: copy.ctaLabel } }
      : {}),
  };
}

// ============================================================
// events row
// ============================================================

const PHASE_TO_EVENT_STATUS = {
  before: "upcoming",
  live: "live",
  after: "past",
} as const;

/**
 * The desafío `events` row. Shared by `ensureDesafioEvent` (server) and
 * `scripts/prefill-desafio.ts`, which can't import the `server-only` module.
 * `eventId` is a parameter so this never reads the (test-mocked) constant.
 */
export function buildDesafioEventRow(
  eventId: string,
  now: Date,
  start: string = desafioStartDate(),
) {
  return {
    id: eventId,
    type: "desafio",
    series: "desafio",
    name: "Desafío 15 días meditando — sep/oct 2026",
    date: new Date(`${start}T00:00:00-03:00`),
    capacity: null,
    status: PHASE_TO_EVENT_STATUS[desafioPhase(now, start)],
    landingPath: desafioConfig.landingPath,
  };
}
