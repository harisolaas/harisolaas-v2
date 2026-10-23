"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import type { HackeaDict } from "@/dictionaries/types";
import { hackeaVslEmbedSrc, type HackeaVslSource } from "@/lib/hackea-vsl";
import { Badge, HACKEA_FORM_ANCHOR, buttonClass } from "./ui";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Pixel custom events, so the VSL's plays and CTA read apart from the rest. */
function track(event: "VslPlay" | "VslAutoplay" | "VslUnmute" | "VslCta") {
  window.fbq?.("trackCustom", event);
}

/**
 * poster = nothing playing (no video, autoplay off or refused);
 * muted = autoplaying without sound, with the muted-speaker button;
 * sound = playing with sound.
 */
type Mode = "poster" | "muted" | "sound";

/**
 * VSL above the fold (design handoff "VSL above the fold with autoplay").
 * On load it tries to play with sound; browsers only allow that for sites
 * the visitor already engages with, so the usual outcome is a muted start
 * with a muted-speaker icon (no text). Tapping it — or anywhere on the
 * frame — restarts the cut from 0 with sound. If even muted autoplay is refused
 * (iOS low-power mode), the poster stays and plays with sound on click.
 */
export default function HackeaVsl({
  dict,
  source,
  poster,
  autoplay,
  priceLabel,
  salesOpen,
  closedCta,
  goForm,
}: {
  dict: HackeaDict["vsl"];
  source: HackeaVslSource | null;
  poster: string | null;
  autoplay: boolean;
  priceLabel: string;
  salesOpen: boolean;
  closedCta: string;
  goForm: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  // An embed can't report a refused autoplay, so it starts muted — the one
  // way browsers let it run without a gesture — straight from the server
  // render. A file starts on the poster until play() answers below.
  const embedAutoplays =
    autoplay && source?.kind === "embed" && hackeaVslEmbedSrc(source, true) !== null;
  const [mode, setMode] = useState<Mode>(embedAutoplays ? "muted" : "poster");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (embedAutoplays) track("VslAutoplay");
  }, [embedAutoplays]);

  useEffect(() => {
    if (!autoplay || source?.kind !== "file") return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    // `muted` is set on the element, not as a JSX prop: React doesn't
    // reliably reflect it, and play() reads the live property.
    video.muted = false;
    video
      .play()
      .then(() => {
        if (cancelled) return;
        setMode("sound");
        track("VslAutoplay");
      })
      .catch(() => {
        if (cancelled) return;
        video.muted = true;
        return video.play().then(() => {
          if (cancelled) return;
          setMode("muted");
          track("VslAutoplay");
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source, autoplay]);

  /** From the overlay or the poster — a gesture, so sound is allowed. */
  const playWithSound = (from: "unmute" | "poster") => {
    if (!source) return;
    track(from === "unmute" ? "VslUnmute" : "VslPlay");
    const video = videoRef.current;
    if (source.kind === "file" && video) {
      video.muted = false;
      // The standard VSL pattern: sound comes on with the cut from the top.
      video.currentTime = 0;
      void video.play().catch(() => {});
    }
    setMode("sound");
  };

  const embedSrc =
    source?.kind === "embed" && mode !== "poster"
      ? hackeaVslEmbedSrc(source, mode === "muted")
      : null;

  return (
    <section className="htm-vsl htm-grain">
      <div className="htm-vsl__scan htm-scanlines" aria-hidden="true" />
      <div className="htm-vsl__inner">
        <div className="htm-vsl__player">
          <div className="htm-vsl__glow" aria-hidden="true" />
          <div className="htm-vsl__frame">
            {source?.kind === "file" && (
              <video
                ref={videoRef}
                className="htm-vsl__media"
                src={source.src}
                preload={autoplay ? "auto" : "none"}
                poster={poster ?? undefined}
                playsInline
                controls={mode === "sound"}
                title={dict.videoTitle}
              />
            )}
            {embedSrc && (
              <iframe
                // Remounts on unmute: the embed restarts from 0 with sound.
                key={embedSrc}
                className="htm-vsl__media"
                src={embedSrc}
                title={dict.videoTitle}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
            {mode === "muted" && (
              <button
                type="button"
                onClick={() => playWithSound("unmute")}
                aria-label={dict.unmuteAria}
                className="htm-vsl__unmute"
              >
                <span className="htm-vsl__unmute-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                    <path
                      d="M16.5 9.5l5 5m0-5l-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            )}
            {mode === "poster" && (
              <button
                type="button"
                onClick={() => playWithSound("poster")}
                aria-label={dict.playAria}
                className="htm-vsl__poster"
              >
                {poster && (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 1040px) 100vw, 1040px"
                    className="htm-vsl__still"
                  />
                )}
                <Image
                  src="/hackea/hari-cutout.png"
                  alt=""
                  width={1080}
                  height={1440}
                  sizes="(max-width: 900px) 60vw, 600px"
                  className="htm-vsl__cutout"
                />
                <div className="htm-vsl__scan htm-scanlines" />
                <div className="htm-vsl__scrim" />
                <div className="htm-vsl__cue">
                  <div className="htm-vsl__tile">
                    <div className="htm-vsl__triangle" />
                  </div>
                  <div className="htm-vsl__play">{dict.play}</div>
                  <div className="htm-vsl__byline">{dict.byline}</div>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="htm-row htm-vsl__cta">
          <a
            href={`#${HACKEA_FORM_ANCHOR}`}
            onClick={(e) => {
              track("VslCta");
              goForm(e);
            }}
            className={buttonClass({ size: "lg" })}
          >
            {salesOpen ? dict.cta : closedCta}
          </a>
          {salesOpen && <Badge tone="outline">{dict.scarcity}</Badge>}
        </div>

        {salesOpen && (
          <p className="htm-vsl__includes">{dict.includes.replace("{precio}", priceLabel)}</p>
        )}
      </div>
    </section>
  );
}
