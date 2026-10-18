// Primitives of the hacke-tu-mente design system (handoff `_ds` bundle +
// reference_components), as thin wrappers over the classes in hackea.css.
// No hooks: usable from server and client components alike.
import type { ReactNode } from "react";

/**
 * Purchase section id — the CTAs' scroll target and the failure page's
 * retry link. Lives here, not in the "use client" landing, so server pages
 * get the string rather than a client reference.
 */
export const HACKEA_FORM_ANCHOR = "entrada";

/** Same number the Sinergia landings use for questions. */
export const HACKEA_WHATSAPP_HREF = "https://wa.me/5491122555110";

export function GlitchText({
  as: Tag = "div",
  fill = "chrome",
  glitch = "md",
  animated = false,
  children,
}: {
  as?: "div" | "h1" | "h2" | "span";
  fill?: "chrome" | "violet";
  glitch?: "md" | "lg";
  animated?: boolean;
  children: ReactNode;
}) {
  const cls = [
    "htm-glitch",
    `htm-glitch--${fill}`,
    `htm-glitch--${glitch}`,
    animated ? "htm-glitch--animated" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <Tag className={cls}>{children}</Tag>;
}

export function Eyebrow({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <p className="htm-eyebrow">
      <b>{lead}</b>
      {children}
    </p>
  );
}

export function Badge({
  tone = "violet",
  children,
}: {
  tone?: "violet" | "outline";
  children: ReactNode;
}) {
  return <span className={`htm-badge htm-badge--${tone}`}>{children}</span>;
}

export function buttonClass({
  variant = "primary",
  size = "lg",
  fullWidth = false,
}: {
  variant?: "primary" | "secondary";
  size?: "sm" | "lg";
  fullWidth?: boolean;
}) {
  return `htm-btn htm-btn--${variant} htm-btn--${size}${fullWidth ? " htm-btn--full" : ""}`;
}
