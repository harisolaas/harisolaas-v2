import type { CSSProperties } from "react";
import Icon from "./Icon";

const DOT_COLORS = [
  "var(--color-accent)",
  "var(--color-accent-2)",
  "var(--color-accent-300)",
];

/** 9 dots flying out radially, from the design's `celebration()`. */
const DOTS = Array.from({ length: 9 }, (_, i) => {
  const angle = (i / 9) * Math.PI * 2 + 0.3;
  const radius = 58 + (i % 3) * 8;
  const size = 9 - (i % 3) * 2;
  return {
    size,
    color: DOT_COLORS[i % 3],
    // Rounded so server and client serialize the same string.
    dx: `${Math.round(Math.cos(angle) * radius * 100) / 100}px`,
    dy: `${Math.round(Math.sin(angle) * radius * 100) / 100}px`,
    delay: `${Math.round((0.15 + (i % 3) * 0.08) * 100) / 100}s`,
  };
});

/**
 * The check mark of the "Qué lindo." panel. `animate` plays the burst
 * (pop + 3 ripples + 9 dots); revisiting a done day shows it static.
 */
export default function Celebration({ animate }: { animate: boolean }) {
  return (
    <div className={`desafio-cel${animate ? " desafio-cel--animate" : ""}`} aria-hidden="true">
      {animate &&
        [0, 1, 2].map((i) => (
          <span
            key={`r${i}`}
            className="desafio-cel-ring"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      {animate &&
        DOTS.map((d, i) => (
          <span
            key={`p${i}`}
            className="desafio-cel-dot"
            style={
              {
                width: d.size,
                height: d.size,
                background: d.color,
                "--dx": d.dx,
                "--dy": d.dy,
                animationDelay: d.delay,
              } as CSSProperties
            }
          />
        ))}
      <span className="desafio-cel-check">
        <Icon name="check" size={34} />
      </span>
    </div>
  );
}
