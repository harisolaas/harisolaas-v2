"use client";

import { useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import type { HackeaDict } from "@/dictionaries/types";
import type { HackeaVslSource } from "@/lib/hackea-vsl";
import { Badge, HACKEA_FORM_ANCHOR, buttonClass } from "./ui";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Pixel custom events, so the VSL's play and CTA read apart from the rest. */
function track(event: "VslPlay" | "VslCta") {
  window.fbq?.("trackCustom", event);
}

/**
 * Design handoff `design_handoff_vsl_section`: poster button → video. Nothing
 * loads until the click — a file sits behind the poster with
 * preload="none" and is played from the click itself (so iOS lets it start
 * with sound); an embed is only mounted then.
 */
export default function HackeaVsl({
  dict,
  source,
  poster,
  dayNum,
  priceLabel,
  salesOpen,
  closedCta,
  goForm,
}: {
  dict: HackeaDict["vsl"];
  source: HackeaVslSource | null;
  poster: string | null;
  dayNum: string;
  priceLabel: string;
  salesOpen: boolean;
  closedCta: string;
  goForm: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = () => {
    if (!source) return;
    track("VslPlay");
    if (source.kind === "file") void videoRef.current?.play().catch(() => {});
    setPlaying(true);
  };

  return (
    <section className="htm-vsl">
      <div className="htm-vsl__inner">
        <div className="htm-vsl__head">
          <Badge>{dict.badge}</Badge>
          <h2 className="htm-vsl__title">
            {dict.titleLead} <span className="htm-text-violet">{dict.titleAccent}</span>
          </h2>
          <p className="htm-vsl__body">{dict.body.replace("{dia}", dayNum)}</p>
        </div>

        <div className="htm-vsl__player">
          <div className="htm-vsl__glow" aria-hidden="true" />
          <div className="htm-vsl__frame">
            {source?.kind === "file" && (
              <video
                ref={videoRef}
                className="htm-vsl__media"
                src={source.src}
                preload="none"
                poster={poster ?? undefined}
                playsInline
                controls={playing}
                title={dict.videoTitle}
              />
            )}
            {source?.kind === "embed" && playing && (
              <iframe
                className="htm-vsl__media"
                src={source.src}
                title={dict.videoTitle}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
            {!playing && (
              <button
                type="button"
                onClick={play}
                aria-label={dict.playAria}
                className="htm-vsl__poster"
              >
                {poster && (
                  <Image
                    src={poster}
                    alt=""
                    fill
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
