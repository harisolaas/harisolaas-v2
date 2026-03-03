"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { broteConfig } from "@/data/brote";
import type { BroteDict } from "@/dictionaries/types";
import {
  initPostHog,
  trackSectionView,
  trackCtaClick,
  trackLocaleSwitch,
} from "@/lib/analytics";
import TreeCounter from "@/components/TreeCounter";

/* ─── animated section wrapper ─── */

function Section({
  id,
  children,
  className = "",
}: {
  id: string;
  children: ReactNode;
  className?: string;
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
      initial={{ opacity: 0, y: 18 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [ctaHovered, setCtaHovered] = useState(false);

  useEffect(() => {
    initPostHog();
    trackSectionView("brote_hero");
    videoRef.current?.load();
  }, []);

  const handleCheckout = useCallback(async (type: "ticket" | "donation") => {
    if (checkoutLoading) return;
    setCheckoutLoading(type);
    trackCtaClick(type, "/api/brote/checkout", `brote_${type}`);

    try {
      const res = await fetch("/api/brote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch {
      setCheckoutLoading(null);
    }
  }, [checkoutLoading]);

  // Early bird check (client-side, Argentina UTC-3)
  const isEarlyBird = (() => {
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    return new Date() <= deadline;
  })();

  const { expectedAttendees } = broteConfig;
  const attendeesText = dict.impact.attendees.replace(
    /\{count\}/g,
    String(expectedAttendees),
  );

  return (
    <>
      {/* Locale switch */}
      <a
        href={`/${otherLocale}/brote`}
        onClick={() => trackLocaleSwitch(locale, otherLocale)}
        className="fixed right-4 top-4 z-50 mix-blend-difference rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white transition-colors hover:border-white/60"
      >
        {localeLabel}
      </a>

      <main>
        {/* ───────── BLOCK 1 — Hero ───────── */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          {/* Gradient fallback — visible while video loads */}
          <div className="absolute inset-0 bg-gradient-to-br from-tan/40 via-cream to-sage/20" />

          {/* Background video — loads progressively after page render */}
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setVideoLoaded(true)}
            className={`absolute inset-0 z-[1] h-full w-full object-cover object-left transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src="/brote-hero.mp4" type="video/mp4" />
          </video>

          {/* Cream overlay */}
          <div className="absolute inset-0 z-[2] bg-cream/75" />

          <div className="relative z-10 mx-auto max-w-xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-serif text-7xl tracking-tight text-forest md:text-8xl"
            >
              BROTE
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-2 font-serif text-xl italic text-forest md:text-2xl"
            >
              {dict.hero.subtitle}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 text-sm font-semibold uppercase tracking-widest text-terracotta"
            >
              {dict.hero.dateTime}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mx-auto mt-6 max-w-md text-base leading-relaxed text-charcoal md:text-lg"
            >
              {dict.hero.subhead}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-8"
            >
              <button
                onClick={() => handleCheckout("ticket")}
                onMouseEnter={() => setCtaHovered(true)}
                onMouseLeave={() => setCtaHovered(false)}
                disabled={checkoutLoading === "ticket"}
                className="inline-block cursor-pointer rounded-full bg-forest px-8 py-4 text-lg font-semibold text-cream shadow-md transition-all hover:bg-forest/90 hover:shadow-lg disabled:opacity-60"
              >
                {checkoutLoading === "ticket" ? "..." : dict.hero.cta}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="mt-10"
            >
              <TreeCounter
                goal={broteConfig.expectedAttendees}
                label={locale === "es" ? "meta:" : "goal:"}
                treesLabel={locale === "es" ? "árboles" : "trees"}
                locale={locale}
                onCheckout={() => handleCheckout("ticket")}
                optimisticBump={checkoutLoading === "ticket" || ctaHovered ? 1 : 0}
              />
            </motion.div>
          </div>
        </section>

        {/* ───────── BLOCK 2 — Qué vas a vivir ───────── */}
        <Section id="experiencia" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              {dict.experience.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl border border-sage/15 bg-white/70 p-4"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="mt-2 font-serif text-base text-forest md:text-lg">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <span className="text-xs italic text-charcoal/40">
                      {item.subtitle}
                    </span>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ───────── BLOCK 3 — El árbol ───────── */}
        <Section
          id="impacto"
          className="relative overflow-hidden px-6 py-12 md:py-16"
        >
          <Image
            src="/unarbol-en-accion.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-forest/70" />

          <div className="relative z-10 mx-auto max-w-xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.impact.heading}
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-cream md:text-lg">
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
              <p className="font-semibold text-cream">{attendeesText}</p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-cream">
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

        {/* ───────── BLOCK 4 — CTA + precio ───────── */}
        <Section id="precio" className="px-6 py-12 text-center md:py-16">
          <div className="mx-auto max-w-md">
            {isEarlyBird ? (
              <>
                <span className="inline-block rounded-full bg-terracotta/15 px-4 py-1.5 text-sm font-semibold tracking-wide text-terracotta">
                  {dict.pricing.earlyBirdBadge}
                </span>
                <p className="mt-4 font-serif text-5xl text-terracotta md:text-6xl">
                  {broteConfig.earlyBirdPrice}
                </p>
                <p className="mt-2 text-base text-charcoal/40 line-through">
                  {broteConfig.ticketPrice}
                </p>
                <p className="mt-1 text-sm text-charcoal/50">
                  {dict.pricing.earlyBirdUntil}
                </p>
              </>
            ) : (
              <p className="font-serif text-5xl text-terracotta md:text-6xl">
                {broteConfig.ticketPrice}
              </p>
            )}
            <p className="mt-4 text-base leading-relaxed text-charcoal/70 md:text-lg">
              {dict.pricing.reanchor}
            </p>
            <button
              onClick={() => handleCheckout("ticket")}
              disabled={checkoutLoading === "ticket"}
              className="mt-6 inline-block cursor-pointer rounded-full bg-forest px-8 py-4 text-lg font-semibold text-cream shadow-md transition-all hover:bg-forest/90 hover:shadow-lg disabled:opacity-60"
            >
              {checkoutLoading === "ticket" ? "..." : dict.pricing.cta}
            </button>
            <p className="mt-4 text-xs text-charcoal/40">
              {dict.pricing.payment}
            </p>
          </div>
        </Section>

        {/* ───────── BLOCK 5 — Quiénes somos ───────── */}
        <Section id="nosotros" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-xl space-y-4 text-base leading-relaxed text-charcoal/70 md:text-lg">
            <p>
              {dict.about.intro.before}
              <strong className="text-charcoal">
                {dict.about.intro.sponsors}
              </strong>
              {dict.about.intro.after}
            </p>
            <p>{dict.about.body}</p>
            <p className="font-semibold text-forest">{dict.about.closing}</p>
          </div>
        </Section>

        {/* ───────── BLOCK 6 — Datos prácticos ───────── */}
        <Section id="datos" className="bg-tan/20 px-6 py-12 md:py-16">
          <ul className="mx-auto max-w-md space-y-4 text-base text-charcoal/80">
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
                className="underline decoration-terracotta/30 underline-offset-2 transition-colors hover:text-forest"
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

        {/* ───────── BLOCK 7 — CTA final + donación ───────── */}
        <Section
          id="final"
          className="bg-forest px-6 py-14 text-center md:py-20"
        >
          <div className="mx-auto max-w-md">
            <p className="font-serif text-3xl text-cream md:text-4xl">
              {dict.final.heading}
            </p>
            <button
              onClick={() => handleCheckout("ticket")}
              disabled={checkoutLoading === "ticket"}
              className="mt-6 inline-block cursor-pointer rounded-full bg-cream px-8 py-4 text-lg font-semibold text-forest shadow-md transition-all hover:bg-cream/90 hover:shadow-lg disabled:opacity-60"
            >
              {checkoutLoading === "ticket" ? "..." : dict.final.cta}
            </button>

            <div className="mx-auto my-8 h-px w-16 bg-cream/20" />

            <p className="text-sm text-cream/50">{dict.final.donationPrompt}</p>
            <a
              href={broteConfig.plantingContactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block cursor-pointer rounded-full border border-cream/25 px-6 py-2.5 text-sm text-cream/60 transition-all hover:border-cream/50 hover:text-cream"
            >
              {dict.final.donationCta}
            </a>
          </div>
        </Section>
      </main>
    </>
  );
}
