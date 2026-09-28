import { parseYouTube, YOUTUBE_IFRAME_ALLOW } from "@/lib/desafio";

/**
 * YouTube embed box. Shorts are vertical (9/16, max 320px), everything else
 * is 16/9 full width. Renders nothing for an empty or unparseable URL.
 */
export default function VideoEmbed({
  url,
  title,
  variant,
}: {
  url: string;
  title: string;
  /** "plain": intro/reflection (radius 28, surface bg); "med": inside the meditation card. */
  variant: "plain" | "med";
}) {
  const video = parseYouTube(url);
  if (!video) return null;
  return (
    <div
      className={`desafio-video desafio-video--${variant}`}
      style={{
        aspectRatio: video.aspectRatio,
        maxWidth: video.isShort ? 320 : "100%",
      }}
    >
      <iframe
        src={video.embedUrl}
        title={title}
        allow={YOUTUBE_IFRAME_ALLOW}
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
