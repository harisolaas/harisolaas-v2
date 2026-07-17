"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import Script from "next/script";
import Image from "next/image";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { broteConfig } from "@/data/brote";
import type { BroteDict } from "@/dictionaries/types";
import {
  initPostHog,
  trackSectionView,
  trackCtaClick,
  trackLocaleSwitch,
} from "@/lib/analytics";
import TreeCounter from "@/components/TreeCounter";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/* ─── night palette (inverted from edition 1: dark grounds, cream as light) ─── */
const NIGHT = "#131C18"; // deepest ground — a forest pushed toward black
const NIGHT_2 = "#1A2621"; // one step up, for section rhythm

/* ─── scroll-reveal section wrapper (also fires analytics) ─── */
function Section({
  id,
  children,
  className = "",
  style,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (isInView) trackSectionView(`brote_${id}`);
  }, [isInView, id]);

  return (
    <motion.section
      id={id}
      ref={ref}
      initial={{ opacity: 0, y: 22 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
      style={style}
    >
      {children}
    </motion.section>
  );
}

/* ─── drifting fireflies / embers — the hero's night atmosphere.
   Positions are derived from the index so server and client render the
   same layout (no hydration mismatch, no Math.random). ─── */
function Fireflies({ count = 16 }: { count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37.5) % 100,
        top: (i * 53.7) % 92,
        size: 2 + (i % 3),
        delay: (i % 6) * 0.7,
        duration: 5 + (i % 5),
        drift: i % 2 === 0 ? 10 : -10,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[2]">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            background: "rgba(196,112,75,0.9)",
            boxShadow: "0 0 8px 2px rgba(196,112,75,0.5)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: [0, d.drift, 0] }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── page ─── */
interface Props {
  dict: BroteDict;
  locale: string;
}

export default function BroteLanding({ dict, locale }: Props) {
  const otherLocale = locale === "en" ? "es" : "en";
  const localeLabel = locale === "en" ? "ES" : "EN";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);

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
    } else {
      const interval = setInterval(() => {
        if (window.fbq) {
          fireViewContent();
          clearInterval(interval);
        }
      }, 200);
      setTimeout(() => clearInterval(interval), 5000);
    }
  }, []);

  const handleCheckout = useCallback(async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    trackCtaClick("ticket", "/api/brote/checkout", "brote_ticket");

    // Meta Pixel — InitiateCheckout with dedup event ID
    const eventId = crypto.randomUUID();
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    const price =
      new Date() <= deadline
        ? broteConfig.earlyBirdPriceRaw
        : broteConfig.ticketPriceRaw;

    if (typeof window !== "undefined" && window.fbq) {
      window.fbq(
        "track",
        "InitiateCheckout",
        { currency: "ARS", value: price },
        { eventID: eventId },
      );
    }

    // Read Meta cookies for server-side dedup
    const cookies = document.cookie.split("; ");
    const fbp = cookies.find((c) => c.startsWith("_fbp="))?.split("=")[1];
    const fbc = cookies.find((c) => c.startsWith("_fbc="))?.split("=")[1];

    try {
      const res = await fetch("/api/brote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ticket", eventId, fbp, fbc }),
      });
      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setCheckoutLoading(false);
      }
    } catch {
      setCheckoutLoading(false);
    }
  }, [checkoutLoading]);

  // Early-bird check (Argentina UTC-3) — flips live when the deadline passes
  const [isEarlyBird, setIsEarlyBird] = useState(() => {
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    return new Date() <= deadline;
  });

  useEffect(() => {
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    const remaining = deadline.getTime() - Date.now();
    // Already past on mount → the lazy initializer already set it false.
    if (remaining <= 0) return;
    const timer = setTimeout(() => setIsEarlyBird(false), remaining);
    return () => clearTimeout(timer);
  }, []);

  const attendeesText = dict.impact.attendees.replace(
    /\{count\}/g,
    String(broteConfig.expectedAttendees),
  );

  const ctaButton = (
    label: string,
    variant: "solid" | "ghost" = "solid",
  ) => (
    <button
      onClick={() => handleCheckout()}
      onMouseEnter={() => setCtaHovered(true)}
      onMouseLeave={() => setCtaHovered(false)}
      disabled={checkoutLoading}
      className={
        variant === "solid"
          ? "group relative inline-flex cursor-pointer items-center justify-center rounded-full bg-terracotta px-9 py-4 text-lg font-semibold text-cream shadow-[0_0_30px_rgba(196,112,75,0.35)] transition-all hover:shadow-[0_0_45px_rgba(196,112,75,0.55)] disabled:opacity-60"
          : "inline-flex cursor-pointer items-center justify-center rounded-full border border-cream/25 bg-cream/5 px-9 py-4 text-lg font-semibold text-cream backdrop-blur-sm transition-all hover:border-cream/50 hover:bg-cream/10 disabled:opacity-60"
      }
    >
      {checkoutLoading ? "…" : label}
    </button>
  );

  return (
    <div className="texture-overlay" style={{ background: NIGHT }}>
      {/* Locale switch */}
      <a
        href={`/${otherLocale}/brote`}
        onClick={() => trackLocaleSwitch(locale, otherLocale)}
        className="fixed right-4 top-4 z-50 rounded-full border border-cream/30 px-3 py-1 text-xs font-semibold text-cream/80 transition-colors hover:border-cream/60 hover:text-cream"
      >
        {localeLabel}
      </a>

      <main className="relative z-0">
        {/* ───────── Hero — night ───────── */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
          {/* Generated night sky (placeholder for a future night photo/video) */}
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 8%, #24352C 0%, #17211C 45%, #0E1512 100%)",
            }}
          />
          {/* Warm horizon glow — a gathering somewhere below the fold */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 z-[1] h-1/2"
            style={{
              background:
                "radial-gradient(80% 70% at 50% 120%, rgba(196,112,75,0.35) 0%, rgba(196,112,75,0) 60%)",
            }}
          />
          <Fireflies />

          <div className="relative z-10 mx-auto max-w-xl">
            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.32em" }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="tech-label text-terracotta"
            >
              {dict.hero.subtitle}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-4 font-serif text-7xl tracking-tight text-cream md:text-8xl [text-shadow:0_0_45px_rgba(196,112,75,0.25)]"
            >
              BROTE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-sage"
            >
              {dict.hero.dateTime}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="mx-auto mt-6 max-w-md text-base leading-relaxed text-cream/70 md:text-lg"
            >
              {dict.hero.subhead}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-9"
            >
              {ctaButton(dict.hero.cta)}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.95 }}
              className="mt-12"
            >
              <TreeCounter
                goal={broteConfig.expectedAttendees}
                label={locale === "es" ? "meta:" : "goal:"}
                treesLabel={locale === "es" ? "árboles" : "trees"}
                locale={locale}
                onCheckout={() => handleCheckout()}
                optimisticBump={checkoutLoading || ctaHovered ? 1 : 0}
              />
            </motion.div>
          </div>
        </section>

        {/* ───────── Experience — the program, as an editorial list ───────── */}
        <Section
          id="experiencia"
          className="px-6 py-16 md:py-24"
          style={{ background: NIGHT_2 }}
        >
          <div className="mx-auto max-w-2xl">
            <ul className="divide-y divide-cream/10">
              {dict.experience.map((item, i) => (
                <motion.li
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex items-start gap-5 py-6"
                >
                  <span className="shrink-0 text-3xl leading-none md:text-4xl">
                    {item.icon}
                  </span>
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="tech-label text-terracotta/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-serif text-xl text-cream md:text-2xl">
                        {item.title}
                      </h3>
                    </div>
                    {item.subtitle && (
                      <span className="text-xs italic text-cream/40">
                        {item.subtitle}
                      </span>
                    )}
                    <p className="mt-1.5 text-sm leading-relaxed text-cream/60 md:text-base">
                      {item.description}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>

            {/* Lineup accordion */}
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setLineupOpen((o) => !o)}
                className="group flex items-center gap-2 rounded-full border border-cream/20 px-6 py-3 text-sm font-semibold text-cream/80 transition-all hover:border-cream/40 hover:text-cream"
              >
                {dict.lineup.toggle}
                <motion.svg
                  animate={{ rotate: lineupOpen ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </motion.svg>
              </button>
            </div>

            <AnimatePresence>
              {lineupOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="relative mx-auto mt-8 max-w-md pl-4">
                    {/* Luminous timeline line */}
                    <div className="absolute bottom-1 left-0 top-1 w-px bg-gradient-to-b from-terracotta/60 via-sage/40 to-transparent" />

                    {dict.lineup.items.map((item, i) => (
                      <motion.div
                        key={item.time}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="relative mb-7 pl-8 last:mb-0"
                      >
                        <div className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1 rounded-full bg-terracotta shadow-[0_0_10px_2px_rgba(196,112,75,0.6)]" />
                        <span className="tech-label text-terracotta">
                          {item.time}
                        </span>
                        <h4 className="mt-1 font-serif text-lg text-cream">
                          {item.link ? (
                            <a
                              href={item.link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-terracotta/40 underline-offset-2 transition-colors hover:text-terracotta"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-cream/55">
                          {item.description}
                          {item.link && item.title !== item.link.label && (
                            <>
                              {" "}
                              <a
                                href={item.link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-terracotta/80 underline decoration-terracotta/30 underline-offset-2 transition-colors hover:text-terracotta"
                              >
                                @{item.link.label}
                              </a>
                            </>
                          )}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Section>

        {/* ───────── Impact — the tree (photo + deep forest overlay) ───────── */}
        <Section
          id="impacto"
          className="relative overflow-hidden px-6 py-20 md:py-28"
        >
          <Image
            src="/unarbol-en-accion.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(19,28,24,0.82) 0%, rgba(19,28,24,0.9) 100%)",
            }}
          />
          <div className="relative z-10 mx-auto max-w-xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.impact.heading}
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-cream/80 md:text-lg">
              <p>
                {dict.impact.partner.intro}
                <a
                  href="https://unarbol.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cream underline decoration-cream/50 underline-offset-2 transition-colors hover:text-terracotta"
                >
                  {dict.impact.partner.name}
                </a>
                {dict.impact.partner.rest}
              </p>
              <p>{dict.impact.body}</p>
              <p className="font-semibold text-terracotta">{attendeesText}</p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <span className="tech-label text-cream/70">
                {dict.impact.partnerLabel}
              </span>
              <Image
                src="/logo-unarbol-blanco.png"
                alt="Un Árbol"
                width={160}
                height={46}
                className="h-7 w-auto"
              />
            </div>
          </div>
        </Section>

        {/* ───────── Pricing — the luminous focal moment ───────── */}
        <Section
          id="precio"
          className="px-6 py-20 text-center md:py-28"
          style={{ background: NIGHT_2 }}
        >
          <div
            className="mx-auto max-w-md rounded-3xl border border-cream/10 px-8 py-12"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, rgba(196,112,75,0.12) 0%, rgba(196,112,75,0) 60%)",
            }}
          >
            {isEarlyBird ? (
              <>
                <span className="inline-block rounded-full bg-terracotta/20 px-4 py-1.5 text-sm font-semibold tracking-wide text-terracotta">
                  {dict.pricing.earlyBirdBadge}
                </span>
                <p className="mt-5 font-serif text-6xl text-cream md:text-7xl [text-shadow:0_0_35px_rgba(196,112,75,0.3)]">
                  {broteConfig.earlyBirdPrice}
                </p>
                <p className="mt-2 text-base text-cream/40 line-through">
                  {broteConfig.ticketPrice}
                </p>
                <p className="mt-1 text-sm text-sage">
                  {dict.pricing.earlyBirdUntil}
                </p>
              </>
            ) : (
              <p className="font-serif text-6xl text-cream md:text-7xl [text-shadow:0_0_35px_rgba(196,112,75,0.3)]">
                {broteConfig.ticketPrice}
              </p>
            )}
            <p className="mt-5 text-base leading-relaxed text-cream/70 md:text-lg">
              {dict.pricing.reanchor}
            </p>
            <div className="mt-7">{ctaButton(dict.pricing.cta)}</div>
            <p className="mt-4 text-xs text-cream/40">{dict.pricing.payment}</p>
          </div>
        </Section>

        {/* ───────── About — the quiet section ───────── */}
        <Section id="nosotros" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-xl space-y-4 text-base leading-relaxed text-cream/70 md:text-lg">
            <p>
              {dict.about.intro.before}
              <strong className="text-cream">{dict.about.intro.sponsors}</strong>
              {dict.about.intro.after}
            </p>
            <p>{dict.about.body}</p>
            <p className="font-serif text-2xl italic text-terracotta">
              {dict.about.closing}
            </p>
          </div>
        </Section>

        {/* ───────── Practical details ───────── */}
        <Section
          id="datos"
          className="px-6 py-16 md:py-24"
          style={{ background: NIGHT_2 }}
        >
          <ul className="mx-auto max-w-md space-y-5 text-base text-cream/80">
            <li className="flex items-start gap-3">
              <span className="text-xl">📅</span>
              <span>{dict.practical.dateTime}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-xl">📍</span>
              <a
                href={broteConfig.locationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-terracotta/40 underline-offset-2 transition-colors hover:text-terracotta"
              >
                {broteConfig.locationAddress}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-xl">🎟️</span>
              <span>{dict.practical.includes}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-xl">👟</span>
              <span>{dict.practical.bring}</span>
            </li>
          </ul>
        </Section>

        {/* ───────── Final CTA + planting fallback ───────── */}
        <Section
          id="final"
          className="relative overflow-hidden px-6 py-20 text-center md:py-28"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(90% 80% at 50% 100%, rgba(196,112,75,0.28) 0%, rgba(196,112,75,0) 60%)",
            }}
          />
          <div className="relative z-10 mx-auto max-w-md">
            <p className="font-serif text-3xl text-cream md:text-4xl">
              {dict.final.heading}
            </p>
            <div className="mt-7">{ctaButton(dict.final.cta)}</div>

            <div className="mx-auto my-9 h-px w-16 bg-cream/15" />

            <p className="text-sm text-cream/50">{dict.final.plantingPrompt}</p>
            <a
              href={broteConfig.plantingContactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block cursor-pointer rounded-full border border-cream/25 px-6 py-2.5 text-sm text-cream/60 transition-all hover:border-cream/50 hover:text-cream"
            >
              {dict.final.plantingCta}
            </a>
          </div>
        </Section>
      </main>

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
