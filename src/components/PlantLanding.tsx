"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { plantConfig } from "@/data/brote";
import type { PlantDict } from "@/dictionaries/types";
import {
  initPostHog,
  trackSectionView,
  trackCtaClick,
  trackLocaleSwitch,
} from "@/lib/analytics";

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
    if (isInView) trackSectionView(`plant_${id}`);
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

/* ─── people emoji pool ─── */

const PEOPLE_EMOJIS = [
  "🙋", "🙋‍♀️", "🙋‍♂️", "👩‍🌾", "🧑‍🌾", "👨‍🌾",
  "🧘", "🧘‍♀️", "🧘‍♂️", "🙌", "💪", "🌿",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getEmojiForSlot(index: number): string {
  const rand = seededRandom(index * 31 + 7);
  return PEOPLE_EMOJIS[Math.floor(rand() * PEOPLE_EMOJIS.length)];
}

/* ─── scroll helper ─── */

function scrollToRegistration() {
  document.getElementById("registro")?.scrollIntoView({ behavior: "smooth" });
}

/* ─── page ─── */

interface Props {
  dict: PlantDict;
  locale: string;
  utmMedium?: string;
}

export default function PlantLanding({ dict, locale, utmMedium }: Props) {
  const otherLocale = locale === "es" ? "en" : "es";
  const localeLabel = locale === "es" ? "EN" : "ES";
  const isReturning = utmMedium === "brote_buyers";

  // Registration counter
  const [peopleCount, setPeopleCount] = useState(0);
  const [optimisticBump, setOptimisticBump] = useState(0);

  // Registration form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UTM params
  const [utm, setUtm] = useState<{ source?: string; medium?: string; campaign?: string }>({});

  useEffect(() => {
    initPostHog();
  }, []);

  // Fetch counter on mount
  useEffect(() => {
    fetch("/api/brote/plant-counter")
      .then((r) => r.json())
      .then((d) => setPeopleCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  // Capture UTM from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u: typeof utm = {};
    if (params.get("utm_source")) u.source = params.get("utm_source")!;
    if (params.get("utm_medium")) u.medium = params.get("utm_medium")!;
    if (params.get("utm_campaign")) u.campaign = params.get("utm_campaign")!;
    if (Object.keys(u).length > 0) setUtm(u);
  }, []);

  const handleRegister = useCallback(async () => {
    if (submitting || !name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    trackCtaClick("plant_register", "/api/brote/register", "plant_registration");

    try {
      const res = await fetch("/api/brote/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          ...(Object.keys(utm).length > 0 && { utm }),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        if (data.alreadyRegistered) {
          setAlreadyRegistered(true);
        } else {
          setOptimisticBump(1);
          setPeopleCount(data.counter);
        }
        setSubmitted(true);
      } else {
        setError(data.error || dict.registration.errorMessage);
      }
    } catch {
      setError(dict.registration.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, name, email, utm, dict]);

  const displayCount = peopleCount + optimisticBump;
  const goal = plantConfig.registrationGoal;
  const visualGoal = Math.max(goal, displayCount + 5); // expand if surpassed

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
        {/* ───────── HERO ───────── */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-tan/40 via-cream to-sage/20" />

          <div className="relative z-10 mx-auto max-w-xl">
            {isReturning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 inline-block rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-medium text-terracotta"
              >
                {dict.hero.welcomeBack}
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-serif text-4xl tracking-tight text-forest md:text-5xl lg:text-6xl"
            >
              {dict.hero.headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-4 font-serif text-xl italic text-forest/80 md:text-2xl"
            >
              {dict.hero.subheadline}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 text-sm font-semibold uppercase tracking-widest text-terracotta"
            >
              {dict.hero.dateTime}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mt-8"
            >
              <button
                onClick={scrollToRegistration}
                className="inline-block cursor-pointer rounded-full bg-forest px-8 py-4 text-lg font-semibold text-cream shadow-md transition-all hover:bg-forest/90 hover:shadow-lg"
              >
                {dict.hero.cta}
              </button>
            </motion.div>

            {/* Photo placeholder */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-10 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-sage/20"
            >
              <div className="flex h-full items-center justify-center text-sm text-charcoal/30">
                Foto del evento
              </div>
            </motion.div>
          </div>
        </section>

        {/* ───────── DUAL COUNTER ───────── */}
        <Section id="counter" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            {/* Trees — completed achievement */}
            <div className="rounded-2xl border border-sage/20 bg-white/70 p-6 text-center">
              <div className="flex flex-wrap justify-center gap-1">
                {Array.from({ length: 100 }).map((_, i) => (
                  <span key={i} className="text-lg">🌳</span>
                ))}
              </div>
              <p className="mt-4 text-lg font-bold text-forest">
                {dict.counter.treesLabel}
              </p>
              <p className="text-sm font-semibold text-terracotta">
                {dict.counter.treesAchievement}
              </p>
            </div>

            {/* People — live counter */}
            <div className="mt-4 rounded-2xl border border-sage/20 bg-white/70 p-6 text-center">
              <div className="flex flex-wrap justify-center gap-1">
                {Array.from({ length: visualGoal }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-lg transition-opacity ${
                      i < displayCount ? "opacity-100" : "opacity-15 grayscale"
                    }`}
                  >
                    {i < displayCount ? getEmojiForSlot(i) : "🙋"}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-lg font-bold text-forest">
                {dict.counter.peopleLabel.replace("{count}", String(displayCount))}
              </p>
              <button
                onClick={scrollToRegistration}
                className="mt-2 text-sm font-semibold text-terracotta underline decoration-terracotta/30 underline-offset-2 transition-colors hover:text-terracotta/80"
              >
                {dict.counter.peopleCta}
              </button>
            </div>
          </div>
        </Section>

        {/* ───────── MINI RECAP ───────── */}
        <Section id="recap" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.recap.heading}
            </h2>
            <div className="mt-6 space-y-3">
              {dict.recap.body.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-charcoal/70">
                  {p}
                </p>
              ))}
            </div>
            {/* Photo placeholders */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="aspect-[4/3] rounded-xl bg-sage/20">
                <div className="flex h-full items-center justify-center text-xs text-charcoal/30">
                  Foto BROTE
                </div>
              </div>
              <div className="aspect-[4/3] rounded-xl bg-sage/20">
                <div className="flex h-full items-center justify-center text-xs text-charcoal/30">
                  Foto BROTE
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ───────── ACTIVITIES ───────── */}
        <Section id="actividades" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dict.activities.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl border border-sage/15 bg-white/70 p-4"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="mt-2 font-serif text-lg text-forest">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ───────── HOW TO GET THERE ───────── */}
        <Section id="como-llegar" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.howToGetThere.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-charcoal/70">
              {dict.howToGetThere.area}
            </p>
            <p className="mt-2 font-semibold text-terracotta">
              {dict.howToGetThere.registerPrompt}
            </p>
            <ul className="mt-6 space-y-3">
              {dict.howToGetThere.transport.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2.5 text-sm text-charcoal/70"
                >
                  <span className="mt-0.5 text-sage">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ───────── REGISTRATION FORM ───────── */}
        <Section id="registro" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-lg">
            <h2 className="text-center font-serif text-3xl text-forest md:text-4xl">
              {dict.registration.heading}
            </h2>

            <div className="mt-8">
              <AnimatePresence mode="wait">
                {!submitted ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-3"
                  >
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={dict.registration.namePlaceholder}
                      className="w-full rounded-full border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder={dict.registration.emailPlaceholder}
                      className="w-full rounded-full border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                    />
                    <button
                      onClick={handleRegister}
                      disabled={submitting || !name.trim() || !email.trim()}
                      className="w-full rounded-full bg-forest px-8 py-3.5 text-base font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
                    >
                      {submitting ? dict.registration.submitting : dict.registration.cta}
                    </button>
                    {error && (
                      <p className="text-center text-sm text-terracotta">{error}</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                      className="text-5xl"
                    >
                      🌱
                    </motion.span>
                    <h3 className="font-serif text-2xl text-forest">
                      {alreadyRegistered
                        ? dict.registration.successHeading
                        : dict.registration.successHeading}
                    </h3>
                    <p className="text-base text-charcoal/70">
                      {alreadyRegistered
                        ? dict.registration.alreadyRegistered
                        : dict.registration.successMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* ───────── UN ÁRBOL ───────── */}
        <Section id="unarbol" className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl rounded-2xl bg-forest/5 p-8">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.unArbol.heading}
            </h2>
            <div className="mt-4 space-y-3">
              {dict.unArbol.body.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-charcoal/70">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </Section>

        {/* ───────── CLOSING ───────── */}
        <Section id="cierre" className="bg-forest px-6 py-16 text-center md:py-20">
          <div className="mx-auto max-w-xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.closing.heading}
            </h2>
            <button
              onClick={scrollToRegistration}
              className="mt-8 inline-block rounded-full bg-cream px-8 py-4 text-lg font-semibold text-forest shadow-md transition-all hover:bg-cream/90 hover:shadow-lg"
            >
              {dict.closing.cta}
            </button>
          </div>
        </Section>
      </main>
    </>
  );
}
