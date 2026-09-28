/**
 * Desafío — pure domain logic (no DB, no env). Safe to import from client
 * components: the public page uses the YouTube helpers and the `DesafioDay`
 * type; the admin editor uses the validation caps and `parseYouTube`.
 *
 * Vocabulary: the public/admin shapes use the design's Spanish keys
 * (`titulo`, `intro`, `meditacion`, …, same as the handoff's `contenido.js`).
 * The DB columns keep English names; `ChallengeDayRow` → Spanish happens in
 * exactly one place per direction (`rowToFields` here, `upsertChallengeDay`
 * in desafio-server.ts).
 */
import {
  DESAFIO_EVENT_DATE,
  DESAFIO_LANDING_PATH,
  DESAFIO_TOTAL_DAYS,
  type DesafioConfig,
} from "@/data/desafio";

// ============================================================
// YouTube
// ============================================================

/** The design's regex: watch?v=, youtu.be/, /shorts/, /embed/, /live/. */
export const YOUTUBE_ID_RE = /(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/;

/** `allow` attribute for the embed iframe, verbatim from the design. */
export const YOUTUBE_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

export interface YouTubeVideo {
  id: string;
  /** youtube-nocookie embed URL with rel=0, modestbranding=1, playsinline=1. */
  embedUrl: string;
  /** `/shorts/` links are vertical. */
  isShort: boolean;
  /** CSS aspect-ratio: "9/16" for shorts (max-width 320px), else "16/9". */
  aspectRatio: "9/16" | "16/9";
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/**
 * Parse any YouTube link the design accepts. Returns null for empty input or
 * when no 11-char id is found. Only the extracted id is reused (the embed URL
 * is rebuilt from scratch), so the result is always safe to put in a `src`.
 */
export function parseYouTube(raw: string | null | undefined): YouTubeVideo | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = YOUTUBE_ID_RE.exec(s);
  if (!m) return null;
  const isShort = /shorts\//.test(s);
  return {
    id: m[1],
    embedUrl: youtubeEmbedUrl(m[1]),
    isShort,
    aspectRatio: isShort ? "9/16" : "16/9",
  };
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/**
 * Stricter check for admin input: an https URL on a YouTube host that
 * `parseYouTube` understands. `parseYouTube` alone would accept
 * `https://evil.example/?v=xxxxxxxxxxx` (harmless when embedding, but not
 * something to store).
 */
export function isValidYouTubeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    YOUTUBE_HOSTS.has(url.hostname) &&
    parseYouTube(raw) !== null
  );
}

// ============================================================
// Day content — the design's shape
// ============================================================

/** Every content field of a day, as in the design's `contenido.js`. */
export interface DesafioDayFields {
  titulo: string;
  intro: string;
  /** YouTube URL or "" (hidden). */
  introVideo: string;
  /** Meditation title. */
  meditacion: string;
  /** YouTube URL or "". */
  meditacionVideo: string;
  /** Short label, e.g. "20 min". */
  duracion: string;
  /** "" → hidden. The whole section hides when both reflexion fields are "". */
  reflexion: string;
  /** YouTube URL or "". */
  reflexionVideo: string;
}

export type DesafioPublishedDay = { dia: number; publicado: true } & DesafioDayFields;

/** Unpublished days carry no content at all — nothing leaks to the client. */
export interface DesafioUnpublishedDay {
  dia: number;
  publicado: false;
}

/** Client-safe day. Always narrow on `publicado` before reading content. */
export type DesafioDay = DesafioPublishedDay | DesafioUnpublishedDay;

/** What the public page gets from `loadDesafio()`. `dias` has exactly 15 entries, dia 1..15 in order. */
export interface DesafioData {
  config: DesafioConfig;
  dias: DesafioDay[];
}

/** A `challenge_days` row as selected by the server layer. */
export interface ChallengeDayRow {
  dayNumber: number;
  title: string | null;
  body: string | null;
  introVideoUrl: string | null;
  meditationTitle: string | null;
  mediaUrl: string | null;
  durationLabel: string | null;
  reflection: string | null;
  reflectionVideoUrl: string | null;
  published: boolean;
}

/** Video URLs that don't parse as YouTube are dropped to "" (defense in depth). */
function videoOrEmpty(v: string | null): string {
  const s = (v ?? "").trim();
  return s && isValidYouTubeUrl(s) ? s : "";
}

function rowToFields(row: ChallengeDayRow): DesafioDayFields {
  return {
    titulo: row.title?.trim() ?? "",
    intro: row.body?.trim() ?? "",
    introVideo: videoOrEmpty(row.introVideoUrl),
    meditacion: row.meditationTitle?.trim() ?? "",
    meditacionVideo: videoOrEmpty(row.mediaUrl),
    duracion: row.durationLabel?.trim() ?? "",
    reflexion: row.reflection?.trim() ?? "",
    reflexionVideo: videoOrEmpty(row.reflectionVideoUrl),
  };
}

/** A day is public when it's published and has a title. */
export function isDayPublic(row: Pick<ChallengeDayRow, "published" | "title">): boolean {
  return row.published && Boolean(row.title?.trim());
}

/**
 * DB rows → the 15-day array. Missing rows, unpublished rows and published
 * rows without a title all become `{ dia, publicado: false }` — their
 * content is never copied, so it can't reach the client.
 */
export function buildDesafioDays(rows: ChallengeDayRow[]): DesafioDay[] {
  const byDay = new Map(rows.map((r) => [r.dayNumber, r]));
  return Array.from({ length: DESAFIO_TOTAL_DAYS }, (_, i) => {
    const dia = i + 1;
    const row = byDay.get(dia);
    if (!row || !isDayPublic(row)) return { dia, publicado: false as const };
    return { dia, publicado: true as const, ...rowToFields(row) };
  });
}

// ============================================================
// Admin input
// ============================================================

/** Normalized admin input: empty strings become null (stored as NULL). */
export interface DayInput {
  titulo: string | null;
  intro: string | null;
  introVideo: string | null;
  meditacion: string | null;
  meditacionVideo: string | null;
  duracion: string | null;
  reflexion: string | null;
  reflexionVideo: string | null;
  publicado: boolean;
}

export const DAY_LIMITS = {
  titulo: 120,
  intro: 4000,
  meditacion: 160,
  duracion: 20,
  reflexion: 2000,
  video: 500,
} as const;

const TEXT_FIELDS = [
  ["titulo", "El título", DAY_LIMITS.titulo],
  ["intro", "El texto de intro", DAY_LIMITS.intro],
  ["meditacion", "El título de la meditación", DAY_LIMITS.meditacion],
  ["duracion", "La duración", DAY_LIMITS.duracion],
  ["reflexion", "La reflexión", DAY_LIMITS.reflexion],
] as const;

const VIDEO_FIELDS = [
  ["introVideo", "El video de intro"],
  ["meditacionVideo", "El video de la meditación"],
  ["reflexionVideo", "El video de reflexión"],
] as const;

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
  const out: Record<string, string | null> = {};

  for (const [key, label, max] of TEXT_FIELDS) {
    const v = normalizeText(r[key]);
    if (v === undefined) return { ok: false, error: INVALID };
    if (v && v.length > max) {
      return { ok: false, error: `${label} no puede superar ${max} caracteres` };
    }
    out[key] = v;
  }
  for (const [key, label] of VIDEO_FIELDS) {
    const v = normalizeText(r[key]);
    if (v === undefined) return { ok: false, error: INVALID };
    if (v && (v.length > DAY_LIMITS.video || !isValidYouTubeUrl(v))) {
      return {
        ok: false,
        error: `${label} tiene que ser un link de YouTube que empiece con https://`,
      };
    }
    out[key] = v;
  }

  if (r.publicado !== undefined && typeof r.publicado !== "boolean") {
    return { ok: false, error: INVALID };
  }
  const publicado = r.publicado === true;
  if (publicado && !out.titulo) {
    return { ok: false, error: "Para publicar, el día necesita un título" };
  }
  if (publicado && !out.meditacionVideo) {
    return {
      ok: false,
      error: "Para publicar, el día necesita el video de la meditación",
    };
  }

  return {
    ok: true,
    value: {
      titulo: out.titulo,
      intro: out.intro,
      introVideo: out.introVideo,
      meditacion: out.meditacion,
      meditacionVideo: out.meditacionVideo,
      duracion: out.duracion,
      reflexion: out.reflexion,
      reflexionVideo: out.reflexionVideo,
      publicado,
    },
  };
}

/** Integer 1..15 from a route segment, else null. */
export function parseDayNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= DESAFIO_TOTAL_DAYS ? n : null;
}

// ============================================================
// Admin API shapes (GET /api/admin/desafio, PUT …/days/[day])
// ============================================================

/** One day in the admin panel: every field, published or not ("" when empty). */
export interface DesafioAdminDay extends DesafioDayFields {
  dia: number;
  publicado: boolean;
  /** True when the public page shows it (published + has a title). */
  visible: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export interface DesafioAdminResponse {
  event: { id: string; totalDays: number };
  days: DesafioAdminDay[];
  counts: { published: number };
}

export type ChallengeDayAdminRow = ChallengeDayRow & {
  updatedAt: Date | string | null;
  updatedByEmail: string | null;
};

/** One admin day entry. `row` is undefined when nothing is stored yet. */
export function buildAdminDay(
  dia: number,
  row: ChallengeDayAdminRow | undefined,
): DesafioAdminDay {
  // Admin sees raw stored values (no YouTube filtering), so a bad legacy
  // value is visible and fixable instead of silently blank.
  return {
    dia,
    titulo: row?.title ?? "",
    intro: row?.body ?? "",
    introVideo: row?.introVideoUrl ?? "",
    meditacion: row?.meditationTitle ?? "",
    meditacionVideo: row?.mediaUrl ?? "",
    duracion: row?.durationLabel ?? "",
    reflexion: row?.reflection ?? "",
    reflexionVideo: row?.reflectionVideoUrl ?? "",
    publicado: row?.published ?? false,
    visible: row ? isDayPublic(row) : false,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    updatedByEmail: row?.updatedByEmail ?? null,
  };
}

/** All 15 admin entries, filling gaps with empty days. */
export function buildAdminDays(rows: ChallengeDayAdminRow[]): DesafioAdminDay[] {
  const byDay = new Map(rows.map((r) => [r.dayNumber, r]));
  return Array.from({ length: DESAFIO_TOTAL_DAYS }, (_, i) =>
    buildAdminDay(i + 1, byDay.get(i + 1)),
  );
}

// ============================================================
// events row
// ============================================================

/**
 * The desafío `events` row. Shared by `ensureDesafioEvent` (server) and
 * `scripts/prefill-desafio.ts`, which can't import the `server-only` module.
 * `eventId` is a parameter so this never reads the (test-mocked) constant.
 * Status is always "live": there's no schedule, the page is open.
 */
export function buildDesafioEventRow(eventId: string) {
  return {
    id: eventId,
    type: "desafio",
    series: "desafio",
    name: "Desafío 15 días meditando juntos",
    date: new Date(DESAFIO_EVENT_DATE),
    capacity: null,
    status: "live",
    landingPath: DESAFIO_LANDING_PATH,
  };
}
