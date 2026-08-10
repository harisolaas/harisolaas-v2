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
import {
  artOfLivingUrl,
  broteConfig,
  currentTicketPrice,
  fillTokens,
  pricingTokens,
} from "@/data/brote";
import {
  brandInvitations,
  collaboratorNameUrl,
  getInvitation,
  instagramUrl,
} from "@/lib/brote-invitations";
import type { BroteCollaboratorMention, BroteDict } from "@/dictionaries/types";
import { CONFIRM_TOKEN_STORAGE_KEY } from "@/lib/brote-confirm-token";
import { readBrowserAttribution } from "@/lib/attribution";
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

/* Riso illustrations for "¿Qué incluye tu entrada?", in dict order.
   SVG rather than PNG: transparent, ~2 KB each, and no baked-in background
   green that would break if the palette ever moves. */
const INCLUDE_ILLUSTRATIONS = [
  "/brote/brote-arbol-riso.svg",
  "/brote/brote-lata-riso.svg",
  "/brote/brote-ticket-riso.svg",
];

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
function Eyebrow({
  children,
  marginBottom = "16px",
}: {
  children: ReactNode;
  marginBottom?: string;
}) {
  return (
    <h2
      style={{
        ...mono,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.4em",
        textTransform: "uppercase",
        color: FOREST_60,
        margin: `0 0 ${marginBottom}`,
      }}
    >
      {children}
    </h2>
  );
}

/* ─── block header: kicker · dotted rule · right-hand detail ───
   Repeats as the section head of Line up and of each numbered block. */
function BlockHeader({
  left,
  right,
  size = 12,
  marginBottom,
  heading = false,
}: {
  left: string;
  right?: string;
  size?: number;
  marginBottom: string;
  /** Render `left` as the section's <h2>. Off for the 01/02/03 block
      counters, which are labels rather than headings. */
  heading?: boolean;
}) {
  const labelStyle: CSSProperties = {
    ...mono,
    fontSize: size,
    fontWeight: 700,
    letterSpacing: size >= 12 ? "0.4em" : "0.3em",
    textTransform: "uppercase",
    color: FOREST_60,
    margin: 0,
  };
  return (
    <div className="flex items-baseline gap-4" style={{ marginBottom }}>
      {heading ? (
        <h2 style={labelStyle}>{left}</h2>
      ) : (
        <span style={labelStyle}>{left}</span>
      )}
      <span
        className="flex-1"
        style={{
          borderBottom: `1px dotted ${FOREST_30}`,
          transform: "translateY(-4px)",
        }}
      />
      {right && (
        <span
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: FOREST_60,
          }}
        >
          {right}
        </span>
      )}
    </div>
  );
}

/* ─── Collaborator mentions ───
   Every place the landing names a musician, a brand or the NGO. Identity —
   name, handle, URLs — comes from the invitation registry via the slug, never
   from the dictionary: the DJ block used to carry its own copy of an
   Instagram URL and it had gone stale against the registry, shipping a dead
   link on a live page.

   The name links to the collaborator's own site when they have one and to
   Instagram otherwise; the chip beside it always goes to Instagram, so a
   brand gets both surfaces. With neither, the name renders as plain text. */
export function CollaboratorName({ slug }: { slug: string }) {
  const invitation = getInvitation(slug);
  if (!invitation) return null;

  const href = collaboratorNameUrl(invitation);
  if (!href) return <>{invitation.name}</>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", borderBottom: `1px solid ${FOREST_60}` }}
    >
      {invitation.name}
    </a>
  );
}

function CollaboratorMention({
  mention,
}: {
  mention: BroteCollaboratorMention;
}) {
  return (
    <>
      {mention.bodyBefore}
      <CollaboratorName slug={mention.slug} />
      {mention.bodyAfter}
    </>
  );
}

/** The bordered `@handle` chip. Renders nothing without an account. */
export function InstagramChip({ slug }: { slug: string }) {
  const invitation = getInvitation(slug);
  const href = invitation ? instagramUrl(invitation) : null;
  if (!invitation || !href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="brote-ig-tag inline-flex items-center gap-2 uppercase"
      style={{
        ...mono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.25em",
        textDecoration: "none",
        color: FOREST_60,
        border: `1px solid ${FOREST_30}`,
        padding: "8px 14px",
      }}
    >
      <InstagramIcon />
      {invitation.handle}
    </a>
  );
}

/* ─── Instagram glyph for the DJ tag ─── */
function InstagramIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  );
}

/* ─── Line up block 02 media ───
   Isolated so swapping the photo for a looping <video autoPlay muted loop
   playsInline> is a change inside this component only — the surrounding
   layout never moves. Falls back to the dotted frame until the photo lands. */
const LINEUP_PHOTO = "/brote/lineup-acustico.jpg";

function LineupMedia({ alt }: { alt: string }) {
  // The asset itself is the source of truth: try to render it, fall back to
  // the frame if it 404s. Dropping the file in public/brote is all it takes —
  // there is no flag to remember to flip.
  const [photoMissing, setPhotoMissing] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 420,
        aspectRatio: "3 / 4",
        border: `1.5px solid ${FOREST}`,
        background: FOREST_10,
        overflow: "hidden",
      }}
    >
      {/* The frame is always rendered underneath. If the photo exists it
          covers it; if it 404s the frame is already on screen, so there is
          no empty box and no flash — and nothing to remember to switch on. */}
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <div
          style={{
            position: "absolute",
            inset: 10,
            border: `1px dotted ${FOREST_30}`,
          }}
        />
        <div
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: FOREST_60,
          }}
        >
          Foto 3:4
        </div>
      </div>
      {!photoMissing && (
        <Image
          src={LINEUP_PHOTO}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 420px"
          onError={() => setPhotoMissing(true)}
        />
      )}
    </div>
  );
}

/* ─── impact count-up — real value from /api/brote/counter ─── */
function Counter() {
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
        fontSize: "clamp(110px,18vw,230px)",
        lineHeight: 0.9,
        color: FOREST,
      }}
    >
      {display}
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
  const [checkoutError, setCheckoutError] = useState<{
    ctaId: string;
    message: string;
  } | null>(null);
  const [ctaHover, setCtaHover] = useState<string | null>(null);

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

  const handleCheckout = useCallback(async (ctaId: string) => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    trackCtaClick("ticket", "/api/brote/checkout", "brote_ticket");

    // Straight to MercadoPago — no identity step in the way. Whatever we
    // need to reach this person is asked for AFTER paying, on
    // /brote/success, where it's optional.
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Priced at click time rather than from the `isEarlyBird` state below,
    // so a tab left open across the deadline reports what the server will
    // actually charge.
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    const value =
      new Date() <= deadline
        ? broteConfig.earlyBirdPriceRaw
        : broteConfig.ticketPriceRaw;

    window.fbq?.(
      "track",
      "InitiateCheckout",
      { currency: "ARS", value },
      { eventID: eventId },
    );

    const cookies = document.cookie.split("; ");
    const fbp = cookies.find((c) => c.startsWith("_fbp="))?.split("=")[1];
    const fbc = cookies.find((c) => c.startsWith("_fbc="))?.split("=")[1];

    try {
      const res = await fetch("/api/brote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Where this visitor came from. Read at click time, not on mount:
        // this page never rewrites its own URL, and the server needs it to
        // stamp `link_slug` on the participation the webhook creates.
        body: JSON.stringify({
          eventId,
          fbp,
          fbc,
          locale,
          ...readBrowserAttribution(window.location.search, document.cookie),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.init_point) {
        // Stash the capability token before leaving. The round trip through
        // MercadoPago is same-origin on return, so localStorage survives —
        // and unlike a URL param it never reaches analytics.
        if (data.confirmToken) {
          try {
            window.localStorage.setItem(
              CONFIRM_TOKEN_STORAGE_KEY,
              data.confirmToken,
            );
          } catch {
            // Locked-down browser: the ticket still goes to the MP email,
            // the success page just won't offer the contact step.
          }
        }
        window.location.href = data.init_point;
        return;
      }
      setCheckoutError({ ctaId, message: dict.checkoutError });
      setCheckoutLoading(false);
    } catch {
      setCheckoutError({ ctaId, message: dict.checkoutError });
      setCheckoutLoading(false);
    }
  }, [checkoutLoading, locale, dict.checkoutError]);

  // The price shown here and the price the checkout API charges come from the
  // same helper, so they cannot drift. Held in state only so the block flips
  // live if the deadline passes while the page is open.
  const [ticket, setTicket] = useState(() => currentTicketPrice());
  const isEarlyBird = ticket.isEarlyBird;

  useEffect(() => {
    const deadline = new Date(
      broteConfig.earlyBirdDeadline + "T23:59:59-03:00",
    );
    const remaining = deadline.getTime() - Date.now();
    if (remaining <= 0) return;
    const MAX_TIMEOUT = 2_147_483_647;
    if (remaining > MAX_TIMEOUT) return;
    const timer = setTimeout(
      () => setTicket(currentTicketPrice()),
      remaining,
    );
    return () => clearTimeout(timer);
  }, []);

  const tokens = pricingTokens();

  /** `invert` = cream on green, for the CTA sitting inside the green block. */
  const ctaButton = (label: string, id: string, invert = false) => {
    const hovered = ctaHover === id;
    return (
      // Own column: one call site's container is `flex justify-center` (a
      // row), where a bare fragment would lay the error message BESIDE the
      // button and squeeze the CTA. One flex item, error underneath.
      <div className="flex flex-col items-center">
        <button
          onClick={() => void handleCheckout(id)}
          onMouseEnter={() => setCtaHover(id)}
          onMouseLeave={() => setCtaHover((c) => (c === id ? null : c))}
          disabled={checkoutLoading}
          className="inline-block cursor-pointer uppercase disabled:opacity-60"
          style={{
            ...mono,
            background: invert
              ? hovered
                ? "#FFFFFF"
                : PAPER
              : hovered
                ? FOREST_HOVER
                : FOREST,
            color: invert ? (hovered ? FOREST_HOVER : FOREST) : PAPER,
            fontWeight: 700,
            fontSize: invert ? 14 : 15,
            letterSpacing: "0.25em",
            padding: invert ? "16px 34px" : "18px 40px",
            borderRadius: 2,
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          {checkoutLoading ? "…" : label}
        </button>
        {/* Scoped to the CTA that was actually clicked — the landing renders
            more than one, and a shared error would fire duplicate
            `role="alert"` announcements and show a failure next to a button
            nobody touched. On the green block the terracotta would fall
            through the floor for contrast, so invert uses cream. */}
        {checkoutError?.ctaId === id && (
          <p
            role="alert"
            className="mt-3 max-w-[32ch] text-center text-[13px] leading-relaxed"
            style={{ ...mono, color: invert ? PAPER : "#A0522D" }}
          >
            {checkoutError.message}
          </p>
        )}
      </div>
    );
  };

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
        /* Instagram tag on the DJ block */
        .brote-scope .brote-ig-tag {
          transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }
        .brote-scope .brote-ig-tag:hover {
          color: ${FOREST};
          border-color: ${FOREST};
          background: ${FOREST_10};
        }
        /* Anchor link inside the price block — inherits the block's ink so it
           stays legible in both the live and the closed state. */
        .brote-scope .brote-includes-link {
          transition: border-color 0.2s ease;
        }
        .brote-scope .brote-includes-link:hover {
          border-bottom-color: currentColor;
        }
        @media (prefers-reduced-motion: reduce) {
          .brote-scope .brote-ig-tag,
          .brote-scope .brote-includes-link { transition: none; }
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

        {/* ───────── Line up ─────────
            Three blocks of deliberately unequal weight: 01 narrow-left,
            02 full-width, 03 narrow-right. The asymmetry is the hierarchy —
            do not regularise this into a grid. */}
        <Section id="lineup" style={{ paddingBottom: "clamp(56px,8vw,104px)" }}>
          <BlockHeader
            heading
            left={dict.eyebrows.lineup}
            right={dict.lineup.timeRange}
            marginBottom="clamp(24px,3.5vw,40px)"
          />

          {/* 01 — arrival & community */}
          <div
            style={{
              width: "min(100%,720px)",
              border: `1.5px solid ${FOREST}`,
              background: FOREST_10,
              padding: "clamp(24px,3.5vw,44px)",
              marginBottom: "clamp(40px,6vw,80px)",
            }}
          >
            <BlockHeader
              left={dict.lineup.welcome.number}
              right={dict.lineup.welcome.time}
              marginBottom="clamp(14px,2vw,22px)"
            />
            <h3
              style={{
                ...serif,
                fontSize: "clamp(32px,4.4vw,54px)",
                lineHeight: 1.04,
                margin: "0 0 6px",
                textWrap: "pretty",
              }}
            >
              {dict.lineup.welcome.title}
            </h3>
            <p
              style={{
                ...serif,
                fontStyle: "italic",
                fontSize: "clamp(20px,2.4vw,28px)",
                lineHeight: 1.2,
                margin: "0 0 clamp(16px,2.2vw,24px)",
                color: FOREST_60,
              }}
            >
              {dict.lineup.welcome.kicker}
            </p>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.85,
                margin: "0 0 14px",
                maxWidth: "52ch",
              }}
            >
              {dict.lineup.welcome.body1}
            </p>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.85,
                margin: 0,
                maxWidth: "52ch",
                color: BODY,
              }}
            >
              {dict.lineup.welcome.body2}
            </p>
          </div>

          {/* 02 — live acoustic set, the protagonist */}
          <div style={{ marginBottom: "clamp(40px,6vw,80px)" }}>
            <BlockHeader
              left={dict.lineup.live.number}
              right={dict.lineup.live.time}
              marginBottom="clamp(14px,2vw,20px)"
            />
            <div
              className="grid items-end"
              style={{
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: "clamp(20px,3vw,44px)",
              }}
            >
              <LineupMedia alt={dict.lineup.live.photoAlt} />
              <div>
                <h3
                  style={{
                    ...serif,
                    fontSize: "clamp(40px,5.4vw,72px)",
                    lineHeight: 0.98,
                    margin: "0 0 clamp(14px,2vw,20px)",
                    whiteSpace: "pre-line",
                  }}
                >
                  {dict.lineup.live.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.85,
                    margin: "0 0 16px",
                    maxWidth: "36ch",
                  }}
                >
                  <CollaboratorMention mention={dict.lineup.live.mention} />
                </p>
                <InstagramChip slug={dict.lineup.live.mention.slug} />
              </div>
            </div>
          </div>

          {/* 03 — DJ set */}
          <div
            style={{
              width: "min(100%,600px)",
              marginLeft: "auto",
              borderTop: `1.5px solid ${FOREST}`,
              paddingTop: "clamp(16px,2.4vw,24px)",
            }}
          >
            <BlockHeader
              left={dict.lineup.dj.number}
              right={dict.lineup.dj.time}
              marginBottom="clamp(10px,1.6vw,16px)"
            />
            <h3
              style={{
                ...serif,
                fontSize: "clamp(30px,3.8vw,46px)",
                lineHeight: 1.05,
                margin: "0 0 12px",
              }}
            >
              {dict.lineup.dj.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.85,
                margin: "0 0 16px",
                maxWidth: "44ch",
              }}
            >
              <CollaboratorMention mention={dict.lineup.dj.mention} />
            </p>
            <InstagramChip slug={dict.lineup.dj.mention.slug} />
          </div>
        </Section>

        {/* ───────── Impact (counter) ───────── */}
        <Section
          id="impacto"
          className="text-center"
          style={{ paddingBottom: "clamp(48px,7vw,88px)" }}
        >
          <Counter />
          <div
            style={{
              ...mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              marginTop: 14,
            }}
          >
            {dict.impact.counterLabel}
          </div>
        </Section>

        {/* ───────── Pricing ─────────
            One block, not two columns: two equally-weighted prices made it
            unclear which one you actually pay. Everything here is subordinate
            to the single large number. */}
        <Section
          id="precio"
          className="text-center"
          style={{ paddingBottom: "clamp(48px,7vw,88px)" }}
        >
          <Eyebrow marginBottom="clamp(20px,3vw,32px)">
            {dict.eyebrows.pricing}
          </Eyebrow>

          <div
            className="inline-block"
            style={{
              maxWidth: "100%",
              padding: "clamp(30px,4.5vw,60px) clamp(28px,5vw,76px)",
              background: isEarlyBird ? FOREST : "transparent",
              color: isEarlyBird ? PAPER : FOREST,
              border: `1.5px solid ${FOREST}`,
              // Solid offset shadow, no blur — the only shadow on the page.
              boxShadow: isEarlyBird
                ? "14px 14px 0 rgba(62,82,38,0.16)"
                : undefined,
            }}
          >
            {/* label + discount badge.
                The closed state dims the label and the price — but NOT the
                container: a group opacity here also dims the buy button,
                which drops it to ~2.5:1 against its own text. The CTA is the
                one thing that must stay at full strength in both states. */}
            <div
              className="flex items-center justify-center gap-2.5"
              style={{
                marginBottom: "clamp(20px,2.8vw,30px)",
                opacity: isEarlyBird ? 1 : 0.55,
              }}
            >
              <span
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                }}
              >
                {isEarlyBird
                  ? dict.pricing.earlyBirdLabel
                  : dict.pricing.earlyBirdExpired}
              </span>
              {isEarlyBird && (
                <span
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    background: PAPER,
                    color: FOREST,
                    padding: "3px 8px",
                  }}
                >
                  {dict.pricing.earlyBirdBadge}
                </span>
              )}
            </div>

            {/* prices — the anchor is struck on a diagonal because at this
                size a flat line-through reads as decoration, not as "this is
                not what you pay". Once the preventa closes there is nothing
                left to anchor against, so the anchor goes away entirely. */}
            <div
              className="flex flex-wrap items-baseline justify-center"
              style={{
                gap: "clamp(14px,2.4vw,28px)",
                opacity: isEarlyBird ? 1 : 0.55,
              }}
            >
              {isEarlyBird && (
                <s
                  style={{
                    ...serif,
                    position: "relative",
                    fontSize: "clamp(32px,3.6vw,44px)",
                    lineHeight: 1,
                    opacity: 0.5,
                    textDecoration: "none",
                  }}
                >
                  {broteConfig.ticketPrice}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "-6%",
                      right: "-6%",
                      top: "50%",
                      height: 2,
                      background: "currentColor",
                      transform: "rotate(-9deg)",
                    }}
                  />
                </s>
              )}
              <div
                style={{
                  ...serif,
                  fontSize: "clamp(60px,8vw,104px)",
                  lineHeight: 0.9,
                }}
              >
                {ticket.display}
              </div>
            </div>

            {isEarlyBird && (
              <div
                className="text-center"
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  marginTop: 14,
                  opacity: 0.85,
                }}
              >
                {fillTokens(dict.pricing.savingsLine, tokens)}
              </div>
            )}

            <div
              className="flex flex-col items-center"
              style={{ gap: 14, marginTop: "clamp(22px,3vw,32px)" }}
            >
              {ctaButton(dict.hero.cta, "pricing", isEarlyBird)}
              <span
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  opacity: 0.75,
                }}
              >
                {isEarlyBird
                  ? dict.pricing.earlyBirdUntil
                  : dict.pricing.earlyBirdClosed}
              </span>
            </div>

            <div
              className="flex flex-col items-center"
              style={{
                borderTop: `1px solid ${
                  isEarlyBird ? "rgba(234,227,210,0.25)" : FOREST_30
                }`,
                marginTop: "clamp(22px,3vw,32px)",
                paddingTop: "clamp(14px,2vw,18px)",
                gap: 10,
              }}
            >
              <a
                href="#incluye"
                className="brote-includes-link inline-flex items-center gap-2 uppercase"
                style={{
                  ...mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: `1px solid ${
                    isEarlyBird ? "rgba(234,227,210,0.45)" : FOREST_30
                  }`,
                  paddingBottom: 3,
                }}
              >
                {dict.pricing.includesLink}{" "}
                <span aria-hidden style={{ fontSize: 14 }}>
                  ↓
                </span>
              </a>
              {isEarlyBird && (
                <span
                  className="text-center"
                  style={{ fontSize: 12, lineHeight: 1.7, opacity: 0.6 }}
                >
                  {fillTokens(dict.pricing.generalNote, tokens)}
                </span>
              )}
            </div>
          </div>

          <p
            style={{
              fontSize: 12,
              color: FOREST_60,
              marginTop: "clamp(16px,2.2vw,22px)",
            }}
          >
            {dict.pricing.payment}
          </p>
        </Section>

        {/* ───────── What your ticket includes ───────── */}
        <Section
          id="incluye"
          style={{
            paddingBottom: "clamp(48px,7vw,88px)",
            scrollMarginTop: 24,
          }}
        >
          <BlockHeader
            heading
            left={dict.includes.eyebrow}
            marginBottom="clamp(24px,3.5vw,40px)"
          />
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              border: `1.5px solid ${FOREST}`,
            }}
          >
            {dict.includes.items.map((item, i) => (
              <div
                key={item.number}
                className="text-center"
                style={{
                  padding: "clamp(22px,3vw,34px)",
                  border: `0.75px solid ${FOREST}`,
                }}
              >
                <Image
                  src={INCLUDE_ILLUSTRATIONS[i]}
                  alt=""
                  width={150}
                  height={150}
                  className="mx-auto block"
                  style={{
                    width: "min(100%,150px)",
                    height: "auto",
                    marginBottom: "clamp(14px,2vw,20px)",
                  }}
                />
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.3em",
                    color: FOREST_60,
                    marginBottom: 10,
                  }}
                >
                  {item.number}
                </div>
                <h3
                  style={{
                    ...serif,
                    fontSize: "clamp(22px,2.4vw,28px)",
                    lineHeight: 1.1,
                    margin: "0 0 8px",
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
                  {item.mention ? (
                    <CollaboratorMention mention={item.mention} />
                  ) : (
                    item.body
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* 04 breaks the pattern on purpose — it's the best thing on the
              list and it didn't exist before. */}
          <div
            className="grid items-center"
            style={{
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: "clamp(20px,3vw,44px)",
              border: `1.5px solid ${FOREST}`,
              borderTop: 0,
              background: FOREST,
              color: PAPER,
              padding: "clamp(24px,3.5vw,44px)",
            }}
          >
            <div className="flex justify-center">
              <Image
                src="/brote/brote-arbol-riso-reverse.svg"
                alt=""
                width={220}
                height={220}
                style={{ width: "min(100%,220px)", height: "auto" }}
              />
            </div>
            <div>
              <div
                style={{
                  ...mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  marginBottom: 10,
                  opacity: 0.7,
                }}
              >
                {dict.includes.featured.number}
              </div>
              <h3
                style={{
                  ...serif,
                  fontSize: "clamp(30px,4.2vw,52px)",
                  lineHeight: 1.04,
                  margin: "0 0 12px",
                  textWrap: "pretty",
                }}
              >
                {dict.includes.featured.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.85,
                  margin: 0,
                  maxWidth: "44ch",
                  opacity: 0.9,
                }}
              >
                {dict.includes.featured.mention ? (
                  <CollaboratorMention mention={dict.includes.featured.mention} />
                ) : (
                  dict.includes.featured.body
                )}
              </p>
            </div>
          </div>
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
            <a
              href={artOfLivingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontWeight: 700,
                textDecoration: "none",
                borderBottom: `1px solid ${FOREST_60}`,
              }}
            >
              {dict.community.intro.sponsors}
            </a>
            {dict.community.intro.after} {dict.community.body}
          </p>

          {/* The brands that back the party. Block 01 promises "las marcas con
              propósito que nos acompañan" and nothing followed through — Pulso
              had no public surface on the landing at all. Built from the
              registry so it cannot fall out of sync with who is collaborating. */}
          <div style={{ marginTop: "clamp(32px,5vw,52px)" }}>
            <p
              style={{
                ...mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: FOREST_60,
                margin: "0 0 18px",
              }}
            >
              {dict.community.sponsorsRow.eyebrow}
            </p>
            <div
              className="flex flex-wrap items-center justify-center"
              style={{ gap: "clamp(14px,2.4vw,28px)" }}
            >
              {brandInvitations().map((brand) => (
                <div
                  key={brand.slug}
                  className="flex flex-col items-center"
                  style={{ gap: 8 }}
                >
                  <span style={{ ...serif, fontSize: "clamp(20px,2.2vw,26px)" }}>
                    <CollaboratorName slug={brand.slug} />
                  </span>
                  <InstagramChip slug={brand.slug} />
                </div>
              ))}
            </div>
          </div>
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
          <span>
            <CollaboratorMention mention={dict.footer.right} />
          </span>
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
