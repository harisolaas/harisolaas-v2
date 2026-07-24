"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import Script from "next/script";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { broteConfig } from "@/data/brote";
import type { BroteDict } from "@/dictionaries/types";
import {
  initPostHog,
  trackSectionView,
  trackCtaClick,
  trackLocaleSwitch,
} from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/* ─── vintage eco-editorial palette — 2 colors + tints, no gradients/shadows ─── */
const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const FOREST_60 = "#78855E"; // secondary text, eyebrows
const FOREST_30 = "#BBC2A9"; // soft dotted rules
const FOREST_10 = "#E0E1D2"; // hover fills
const BODY = "#5C6B45"; // body copy
const FOREST_HOVER = "#2E3D1C"; // button hover

/* Type roles (fonts loaded + scoped in brote/page.tsx) */
const archivoExp: CSSProperties = {
  fontFamily: "var(--font-brote-archivo), sans-serif",
  fontStretch: "125%",
  fontWeight: 900,
};
const serif: CSSProperties = {
  fontFamily: "var(--font-brote-serif), serif",
  fontWeight: 400,
};
const mono: CSSProperties = { fontFamily: "var(--font-brote-mono), monospace" };

const CONTAINER = "mx-auto w-full max-w-[1160px] px-[clamp(20px,4vw,48px)]";

/* ─── scroll-reveal wrapper (also fires the section-view analytics) ─── */
function Section({
  id,
  children,
  className = "",
  style,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (isInView) trackSectionView(`brote_${id}`);
  }, [isInView, id]);

  return (
    <motion.section
      id={id}
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={className}
      style={style}
    >
      {children}
    </motion.section>
  );
}

/* ─── info-bar icons (stroke 1.6, 22px) ─── */
function CalendarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={FOREST}
      strokeWidth={1.6}
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={FOREST}
      strokeWidth={1.6}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={FOREST}
      strokeWidth={1.6}
      aria-hidden
    >
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

interface InfoCell {
  icon?: ReactNode;
  label: string;
  value?: string;
  href?: string;
}

/* ─── reusable info bar — 1.5px rules draw in, 3 cells always ─── */
function InfoBar({
  cells,
  compact = false,
}: {
  cells: InfoCell[];
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const rule = () => (
    <motion.div
      style={{ height: 1.5, background: FOREST, transformOrigin: "left" }}
      initial={reduce ? false : { scaleX: 0 }}
      animate={inView ? { scaleX: 1 } : {}}
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  );

  return (
    <div ref={ref}>
      {rule()}
      <div className="grid grid-cols-3">
        {cells.map((c, i) => {
          const inner = (
            <>
              {c.icon && (
                <div className="mb-2 flex justify-center">{c.icon}</div>
              )}
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                }}
              >
                {c.label}
              </div>
              {c.value && (
                <div
                  style={{
                    ...archivoExp,
                    fontStretch: "110%",
                    fontSize: "clamp(22px,3vw,34px)",
                    lineHeight: 1.1,
                    marginTop: 2,
                  }}
                >
                  {c.value}
                </div>
              )}
            </>
          );
          return (
            <div
              key={i}
              className="text-center"
              style={{
                padding: compact ? "16px 8px" : "clamp(16px,2.5vw,28px) 8px",
                borderRight:
                  i < cells.length - 1 ? `1px solid ${FOREST}` : undefined,
                color: FOREST,
              }}
            >
              {c.href ? (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block no-underline hover:underline"
                  style={{ color: FOREST }}
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>
      {rule()}
    </div>
  );
}

/* ─── eyebrow (mono, tracked, forest-60)
   Rendered as <h2> so each section has a heading and the document doesn't
   jump h1 → h3 on the experience cards. ─── */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        ...mono,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.4em",
        textTransform: "uppercase",
        color: FOREST_60,
        margin: "0 0 16px",
      }}
    >
      {children}
    </h2>
  );
}

/* ─── impact count-up — real value from /api/brote/counter ─── */
function Counter({ goal }: { goal: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [target, setTarget] = useState<number | null>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    fetch("/api/brote/counter")
      .then((r) => r.json())
      .then((d) => setTarget(d.count ?? 0))
      .catch(() => setTarget(0));
  }, []);

  useEffect(() => {
    if (target == null || !inView || started.current) return;
    started.current = true;
    if (reduce) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // cubic-out
      setDisplay(Math.round(e * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, inView, reduce]);

  return (
    <div
      ref={ref}
      style={{
        ...serif,
        fontSize: "clamp(90px,15vw,190px)",
        lineHeight: 0.95,
        color: FOREST,
      }}
    >
      {display}
      <span style={{ fontSize: "0.35em", color: FOREST_60 }}>
        &#8202;/&#8202;{goal}
      </span>
    </div>
  );
}

/* ─── page ─── */
interface Props {
  dict: BroteDict;
  locale: string;
}

export default function BroteLanding({ dict, locale }: Props) {
  const reduce = useReducedMotion();
  const otherLocale = locale === "en" ? "es" : "en";
  const localeLabel = locale === "en" ? "ES" : "EN";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ctaHover, setCtaHover] = useState<string | null>(null);
  const [openLineup, setOpenLineup] = useState<number>(-1);

  useEffect(() => {
    initPostHog();
    trackSectionView("brote_hero");

    // Meta Pixel — ViewContent (poll until fbq is ready, up to 5s)
    const fireViewContent = () => {
      if (window.fbq) {
        window.fbq("track", "ViewContent", {
          content_name: "BROTE Landing",
          content_category: "Event Ticket",
          currency: "ARS",
          value: broteConfig.earlyBirdPriceRaw,
        });
      }
    };
    if (window.fbq) {
      fireViewContent();
      return;
    }
    const interval = setInterval(() => {
      if (window.fbq) {
        fireViewContent();
        clearInterval(interval);
      }
    }, 200);
    const stop = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, []);

  const handleCheckout = useCallback(() => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    trackCtaClick("ticket", `/${locale}/brote/checkout`, "brote_ticket");
    // Identity capture + email verification + payment happen on the
    // checkout page (the Meta Pixel InitiateCheckout fires there on mount).
    window.location.href = `/${locale}/brote/checkout`;
  }, [checkoutLoading, locale]);

  // Early-bird check (Argentina UTC-3) — flips live when the deadline passes
  const [isEarlyBird, setIsEarlyBird] = useState(() => {
    const deadline = new Date(
      broteConfig.earlyBirdDeadline + "T23:59:59-03:00",
    );
    return new Date() <= deadline;
  });

  useEffect(() => {
    const deadline = new Date(
      broteConfig.earlyBirdDeadline + "T23:59:59-03:00",
    );
    const remaining = deadline.getTime() - Date.now();
    if (remaining <= 0) return;
    const MAX_TIMEOUT = 2_147_483_647;
    if (remaining > MAX_TIMEOUT) return;
    const timer = setTimeout(() => setIsEarlyBird(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  const attendeesText = dict.impact.attendees.replace(
    /\{count\}/g,
    String(broteConfig.expectedAttendees),
  );

  const ctaButton = (label: string, id: string) => (
    <button
      onClick={() => handleCheckout()}
      onMouseEnter={() => setCtaHover(id)}
      onMouseLeave={() => setCtaHover((c) => (c === id ? null : c))}
      disabled={checkoutLoading}
      className="inline-block cursor-pointer uppercase disabled:opacity-60"
      style={{
        ...mono,
        background: ctaHover === id ? FOREST_HOVER : FOREST,
        color: PAPER,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: "0.25em",
        padding: "18px 40px",
        borderRadius: 2,
        transition: "background 0.2s ease",
      }}
    >
      {checkoutLoading ? "…" : label}
    </button>
  );

  const texture = (alt: string, priority = false) => (
    <Image
      src="/brote/tiles.png"
      alt={alt}
      width={662}
      height={120}
      priority={priority}
      className="block h-auto w-full"
      sizes="(max-width: 1160px) 100vw, 1160px"
    />
  );

  return (
    <div
      className="brote-scope relative overflow-x-hidden"
      style={{ background: PAPER, color: FOREST, minHeight: "100vh" }}
    >
      {/* scoped tokens: selection, links, focus ring */}
      <style>{`
        .brote-scope ::selection { background: ${FOREST}; color: ${PAPER}; }
        .brote-scope a { color: ${FOREST}; }
        .brote-scope :focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
        /* The spec logotype clamp (min 70px) only fits at ≥~580px; below that
           it overflows the viewport. Cap it fluidly on small screens so the
           brand never clips. Desktop/tablet keep the spec sizing untouched. */
        @media (max-width: 580px) {
          .brote-scope .brote-logo { font-size: 15vw !important; }
          /* clear the fixed locale toggle so the top-bar "2026" isn't covered */
          .brote-scope .brote-topbar { padding-right: 42px; }
        }
        /* Accordion row fill is declarative — hover via CSS, open state via the
           aria-expanded attribute — so it can't desync from React state. */
        .brote-scope .brote-lineup-row {
          background: transparent;
          transition: background 0.2s ease;
        }
        .brote-scope .brote-lineup-row:hover,
        .brote-scope .brote-lineup-row[aria-expanded="true"] {
          background: ${FOREST_10};
        }
        @media (prefers-reduced-motion: reduce) {
          .brote-scope .brote-lineup-row { transition: none; }
        }
      `}</style>

      {/* grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          opacity: 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Locale switch */}
      <a
        href={`/${otherLocale}/brote`}
        onClick={() => trackLocaleSwitch(locale, otherLocale)}
        className="fixed right-4 top-4 z-50 no-underline"
        style={{
          ...mono,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          border: `1px solid ${FOREST}`,
          borderRadius: 2,
          padding: "4px 10px",
          background: PAPER,
        }}
      >
        {localeLabel}
      </a>

      <div className={CONTAINER}>
        {/* ───────── Hero ───────── */}
        <header style={{ paddingTop: "clamp(20px,3vw,36px)" }}>
          {/* top bar */}
          <div
            className="brote-topbar flex items-baseline"
            style={{
              ...mono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.5em",
              textTransform: "uppercase",
            }}
          >
            <span>{dict.topbar.left}</span>
            <span
              className="mx-4 flex-1"
              style={{
                borderBottom: `1px dotted ${FOREST_60}`,
                transform: "translateY(-4px)",
              }}
            />
            <span style={{ marginRight: "-0.5em" }}>{dict.topbar.right}</span>
          </div>

          {/* logotype */}
          <motion.h1
            className="brote-logo"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...archivoExp,
              fontSize: "clamp(70px,17.5vw,218px)",
              lineHeight: 0.9,
              letterSpacing: "0.01em",
              textAlign: "center",
              textTransform: "uppercase",
              color: FOREST,
              margin: "clamp(8px,2vw,20px) 0 clamp(16px,3vw,32px)",
            }}
          >
            BROTE
          </motion.h1>

          {/* texture strip */}
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {texture(dict.hero.textureAlt, true)}
          </motion.div>

          {/* info bar */}
          <div style={{ marginTop: "clamp(32px,5vw,56px)" }}>
            <InfoBar
              cells={[
                {
                  icon: <CalendarIcon />,
                  label: dict.infoBar.date.label,
                  value: dict.infoBar.date.value,
                },
                {
                  icon: <ClockIcon />,
                  label: dict.infoBar.time.label,
                  value: dict.infoBar.time.value,
                },
                {
                  icon: <PinIcon />,
                  label: dict.infoBar.place.label,
                  value: dict.infoBar.place.value,
                },
              ]}
            />
          </div>

          {/* CTA */}
          <div
            className="flex justify-center"
            style={{
              padding: "clamp(28px,4vw,44px) 0 clamp(40px,6vw,72px)",
            }}
          >
            {ctaButton(dict.hero.cta, "hero")}
          </div>
        </header>

        {/* ───────── Experience ───────── */}
        <Section
          id="experiencia"
          style={{ paddingBottom: "clamp(48px,7vw,88px)" }}
        >
          <Eyebrow>{dict.eyebrows.experience}</Eyebrow>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              border: `1.5px solid ${FOREST}`,
            }}
          >
            {dict.experience.map((item, i) => (
              <div
                key={item.title}
                style={{
                  padding: "clamp(20px,3vw,32px)",
                  border: `0.75px solid ${FOREST}`,
                }}
              >
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.3em",
                    color: FOREST_60,
                    marginBottom: 14,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3
                  style={{
                    ...serif,
                    fontSize: "clamp(24px,2.6vw,30px)",
                    lineHeight: 1.1,
                    margin: "0 0 10px",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    margin: 0,
                    color: BODY,
                  }}
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ───────── Lineup (editorial accordion) ───────── */}
        <Section id="lineup" style={{ paddingBottom: "clamp(48px,7vw,88px)" }}>
          <Eyebrow>{dict.eyebrows.lineup}</Eyebrow>
          <div style={{ borderTop: `1.5px solid ${FOREST}` }}>
            {dict.lineup.items.map((act, i) => {
              const open = openLineup === i;
              return (
                <div
                  key={act.name}
                  style={{ borderBottom: `1.5px solid ${FOREST}` }}
                >
                  <button
                    onClick={() => setOpenLineup((o) => (o === i ? -1 : i))}
                    aria-expanded={open}
                    aria-controls={`brote-lineup-panel-${i}`}
                    className="brote-lineup-row flex w-full cursor-pointer items-baseline gap-4 text-left"
                    style={{
                      ...mono,
                      color: FOREST,
                      padding: "clamp(16px,2.5vw,24px) 4px",
                      border: "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.2em",
                        color: FOREST_60,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        ...serif,
                        fontSize: "clamp(26px,3.4vw,40px)",
                        lineHeight: 1,
                        flex: 1,
                      }}
                    >
                      {act.name}
                    </span>
                    <span
                      className="hidden sm:inline"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        color: FOREST_60,
                      }}
                    >
                      {act.tag}
                    </span>
                    <span style={{ fontSize: 18 }}>{open ? "−" : "+"}</span>
                  </button>
                  {/* `inert` keeps the collapsed panel out of the tab order and
                      the a11y tree — max-height alone leaves the link focusable. */}
                  <div
                    id={`brote-lineup-panel-${i}`}
                    inert={!open}
                    style={{
                      overflow: "hidden",
                      transition: "max-height 0.4s ease",
                      maxHeight: open ? 240 : 0,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.7,
                        margin: "0 4px 20px",
                        maxWidth: "60ch",
                        color: BODY,
                      }}
                    >
                      {act.detail}
                      {act.link && (
                        <>
                          {" "}
                          <a
                            href={act.link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            @{act.link.label}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ───────── Impact (counter) ───────── */}
        <Section
          id="impacto"
          className="text-center"
          style={{ paddingBottom: "clamp(48px,7vw,88px)" }}
        >
          <Counter goal={broteConfig.expectedAttendees} />
          <div
            style={{
              ...mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              marginTop: 12,
            }}
          >
            {dict.impact.counterLabel}
          </div>
          <h2
            className="mx-auto"
            style={{
              ...serif,
              fontSize: "clamp(34px,5vw,56px)",
              lineHeight: 1.05,
              margin: "clamp(36px,5vw,56px) auto 20px",
              maxWidth: "18ch",
            }}
          >
            {dict.impact.heading}
          </h2>
          <p
            className="mx-auto"
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              maxWidth: "62ch",
              margin: "0 auto 14px",
              textAlign: "left",
            }}
          >
            {dict.impact.partner.intro}
            <a
              href="https://unarbol.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {dict.impact.partner.name}
            </a>
            {dict.impact.partner.rest}
          </p>
          <p
            className="mx-auto"
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              maxWidth: "62ch",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            {dict.impact.body} {attendeesText}
          </p>
        </Section>

        {/* ───────── Pricing ───────── */}
        <Section id="precio" style={{ paddingBottom: "clamp(48px,7vw,88px)" }}>
          <Eyebrow>{dict.eyebrows.pricing}</Eyebrow>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
              border: `1.5px solid ${FOREST}`,
            }}
          >
            {/* Preventa (highlighted / expired) */}
            <div
              style={{
                padding: "clamp(24px,3.5vw,40px)",
                background: isEarlyBird ? FOREST : "transparent",
                color: isEarlyBird ? PAPER : FOREST,
                border: isEarlyBird ? undefined : `0.75px solid ${FOREST}`,
                opacity: isEarlyBird ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  marginBottom: 18,
                }}
              >
                {isEarlyBird
                  ? dict.pricing.earlyBirdLabel
                  : dict.pricing.earlyBirdExpired}
              </div>
              <div
                style={{
                  ...serif,
                  fontSize: "clamp(44px,5vw,60px)",
                  lineHeight: 1,
                }}
              >
                {broteConfig.earlyBirdPrice}
              </div>
              <div
                style={{
                  fontSize: 13,
                  marginTop: 10,
                  textDecoration: "line-through",
                  opacity: 0.7,
                }}
              >
                {broteConfig.ticketPrice}
              </div>
              {isEarlyBird && (
                <div
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    marginTop: 18,
                  }}
                >
                  {dict.pricing.earlyBirdUntil}
                </div>
              )}
            </div>

            {/* General */}
            <div
              style={{
                padding: "clamp(24px,3.5vw,40px)",
                border: `0.75px solid ${FOREST}`,
              }}
            >
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: FOREST_60,
                  marginBottom: 18,
                }}
              >
                {dict.pricing.generalLabel}
              </div>
              <div
                style={{
                  ...serif,
                  fontSize: "clamp(44px,5vw,60px)",
                  lineHeight: 1,
                }}
              >
                {broteConfig.ticketPrice}
              </div>
              <div style={{ fontSize: 13, marginTop: 10, color: FOREST_60 }}>
                {dict.pricing.generalFrom}
              </div>
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginTop: 18,
                  color: FOREST_60,
                }}
              >
                {dict.pricing.generalUntil}
              </div>
            </div>

            {/* Includes */}
            <div
              style={{
                padding: "clamp(24px,3.5vw,40px)",
                border: `0.75px solid ${FOREST}`,
              }}
            >
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: FOREST_60,
                  marginBottom: 18,
                }}
              >
                {dict.pricing.includesLabel}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  fontSize: 13,
                  lineHeight: 2.1,
                }}
              >
                {dict.pricing.includesItems.map((it, i) => (
                  <li
                    key={it}
                    style={{
                      borderBottom:
                        i < dict.pricing.includesItems.length - 1
                          ? `1px dotted ${FOREST_30}`
                          : undefined,
                    }}
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p style={{ fontSize: 12, color: FOREST_60, marginTop: 14 }}>
            {dict.pricing.payment}
          </p>
        </Section>

        {/* ───────── Community ───────── */}
        <Section
          id="comunidad"
          className="text-center"
          style={{ paddingBottom: "clamp(48px,7vw,88px)" }}
        >
          <p
            className="mx-auto"
            style={{ fontSize: 14, lineHeight: 1.9, maxWidth: "58ch" }}
          >
            {dict.community.intro.before}
            <strong>{dict.community.intro.sponsors}</strong>
            {dict.community.intro.after} {dict.community.body}
          </p>
          <p
            style={{
              ...mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              margin: "24px 0 0",
              color: FOREST_60,
            }}
          >
            {dict.community.tagline}
          </p>
        </Section>

        {/* ───────── Final CTA ───────── */}
        <Section id="final" style={{ paddingBottom: "clamp(56px,8vw,96px)" }}>
          <div style={{ marginBottom: "clamp(32px,5vw,56px)" }}>
            {texture("")}
          </div>
          <h2
            style={{
              ...serif,
              fontSize: "clamp(40px,6vw,72px)",
              lineHeight: 1.02,
              textAlign: "center",
              margin: "0 0 clamp(28px,4vw,44px)",
            }}
          >
            {dict.final.heading}
          </h2>
          <div style={{ marginBottom: "clamp(28px,4vw,44px)" }}>
            <InfoBar
              compact
              cells={[
                { label: dict.final.compactDate },
                { label: dict.final.compactTime },
                { label: dict.final.address, href: broteConfig.locationLink },
              ]}
            />
          </div>
          <div className="flex flex-col items-center gap-5">
            {ctaButton(dict.final.cta, "final")}
            <a
              href={broteConfig.plantingContactLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, letterSpacing: "0.05em" }}
            >
              {dict.final.plantingPrompt} {dict.final.plantingCta}
            </a>
          </div>
        </Section>

        {/* ───────── Footer ───────── */}
        <footer
          className="flex items-baseline"
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            paddingBottom: 32,
            color: FOREST_60,
          }}
        >
          <span>{dict.footer.left}</span>
          <span
            className="mx-4 flex-1"
            style={{
              borderBottom: `1px dotted ${FOREST_30}`,
              transform: "translateY(-3px)",
            }}
          />
          <span>{dict.footer.right}</span>
        </footer>
      </div>

      {/* Meta Pixel */}
      {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');`}
          </Script>
          <Script
            id="meta-pixel-sdk"
            src="https://connect.facebook.net/en_US/fbevents.js"
            strategy="afterInteractive"
            onLoad={() => {
              if (window.fbq) {
                window.fbq("track", "PageView");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
