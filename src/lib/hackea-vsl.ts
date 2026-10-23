// Hackeá tu mente — the landing's VSL source. `hackeaConfig.vslUrl` takes a
// self-hosted file (played in a native <video>) or a YouTube / Vimeo link
// (normalised to its autoplaying embed). The landing autoplays it muted on
// load; `muteParam` is the query param that embed reads for that.

export type HackeaVslSource =
  | { kind: "file"; src: string }
  | { kind: "embed"; src: string; muteParam?: "mute" | "muted" };

const YOUTUBE_ID = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/;
const VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;

/** null when no URL is set: the landing then shows the poster only. */
export function resolveHackeaVsl(url: string | null | undefined): HackeaVslSource | null {
  const raw = url?.trim();
  if (!raw) return null;

  if (/youtube\.com|youtu\.be|youtube-nocookie\.com/.test(raw)) {
    const id = raw.match(YOUTUBE_ID)?.[1];
    if (id) {
      return {
        kind: "embed",
        src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
        muteParam: "mute",
      };
    }
  }
  const vimeo = raw.match(VIMEO_ID)?.[1];
  if (vimeo) {
    return {
      kind: "embed",
      src: `https://player.vimeo.com/video/${vimeo}?autoplay=1`,
      muteParam: "muted",
    };
  }
  if (raw.startsWith("/") || VIDEO_FILE.test(raw)) return { kind: "file", src: raw };
  return { kind: "embed", src: raw };
}

/**
 * The embed's src, muted or with sound. Unknown embeds have no mute param,
 * so they can't autoplay (browsers block it with sound): null.
 */
export function hackeaVslEmbedSrc(
  source: Extract<HackeaVslSource, { kind: "embed" }>,
  muted: boolean,
): string | null {
  if (!source.muteParam) return muted ? null : source.src;
  return `${source.src}&${source.muteParam}=${muted ? 1 : 0}`;
}
