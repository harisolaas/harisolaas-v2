"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Image from "next/image";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { plantConfig } from "@/data/brote";
import type { PlantDict } from "@/dictionaries/types";
import { type GroupType, isValidEmail } from "@/lib/plant-types";
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

/* ─── shareable story card (9:16 for Instagram Stories) ─── */

function ShareCard({
  message,
  name,
  cardRef,
}: {
  message: string;
  name: string;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={cardRef}
      style={{ width: 1080, height: 1920 }}
      className="relative flex flex-col items-center justify-between overflow-hidden bg-[#2D4A3E]"
    >
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-5 8-15 12-15 22s10 15 15 18c5-3 15-8 15-18S35 18 30 10z' fill='%23FAF6F1' fill-opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "80px 80px",
        }}
      />
      <div className="relative z-10 flex flex-col items-center pt-[200px]">
        <div className="mb-6 h-[3px] w-[60px] bg-[#A8B5A0]/50" />
        <h1
          className="font-serif font-bold leading-[0.85] tracking-tight text-[#FAF6F1]/85"
          style={{ fontSize: 120 }}
        >
          BROTE
        </h1>
        <p
          className="mt-3 font-serif italic tracking-wide text-[#FAF6F1]"
          style={{ fontSize: 44 }}
        >
          El segundo movimiento
        </p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-[100px]">
        <div className="flex items-center gap-4">
          <div className="h-[1px] w-[40px] bg-[#FAF6F1]/25" />
          <span style={{ fontSize: 48 }}>🌱</span>
          <div className="h-[1px] w-[40px] bg-[#FAF6F1]/25" />
        </div>
        <p
          className="mt-10 text-center font-serif italic leading-relaxed text-[#FAF6F1]"
          style={{
            fontSize:
              message.length > 100 ? 42 : message.length > 60 ? 48 : 56,
          }}
        >
          &ldquo;{message}&rdquo;
        </p>
        <p
          className="mt-8 font-semibold tracking-wide text-[#e8956b]"
          style={{ fontSize: 28 }}
        >
          — {name}
        </p>
      </div>

      <div className="relative z-10 flex flex-col items-center pb-[160px]">
        <div className="flex items-center gap-3">
          <div className="h-[1px] w-[30px] bg-[#FAF6F1]/25" />
          <span style={{ fontSize: 20 }}>🌱</span>
          <div className="h-[1px] w-[30px] bg-[#FAF6F1]/25" />
        </div>
        <p
          className="mt-4 font-serif font-bold text-[#FAF6F1]"
          style={{ fontSize: 36 }}
        >
          Domingo 19 de abril · San Miguel
        </p>
        <p
          className="mt-2 font-medium text-[#FAF6F1]/70"
          style={{ fontSize: 24 }}
        >
          Gratis · 40 lugares · con cupo limitado
        </p>
        <p
          className="mt-6 font-semibold text-[#e8956b]"
          style={{ fontSize: 26, letterSpacing: "0.05em" }}
        >
          harisolaas.com/brote
        </p>
        <div className="mt-4 h-[3px] w-[60px] bg-[#A8B5A0]/50" />
      </div>
    </div>
  );
}

/* ─── Messages carousel (auto-rotating, paused on hover) ─── */

interface PlantMessage {
  initials: string;
  message: string;
}

function MessagesCarousel({
  heading,
  items,
}: {
  heading: string;
  items: PlantMessage[];
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 6000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  if (items.length === 0) return null;

  return (
    <div
      className="mx-auto mb-12 max-w-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-sage">
        {heading}
      </p>

      {/*
        Grid stack: every card lives in the same grid cell, so the cell
        expands to the tallest one and the visible card just fades in/out.
        No layout shift between rotations.
      */}
      <div
        className="mt-5 grid"
        style={{ gridTemplateAreas: '"stack"' }}
      >
        {items.map((item, i) => (
          <motion.div
            key={i}
            style={{ gridArea: "stack" }}
            initial={false}
            animate={{ opacity: i === index ? 1 : 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            aria-hidden={i !== index}
            className={`flex flex-col items-center justify-center rounded-2xl border border-sage/20 bg-white/70 px-6 py-6 text-center ${
              i === index ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <span
              aria-hidden
              className="block font-serif text-4xl leading-none text-terracotta/30"
            >
              &ldquo;
            </span>
            <p className="mt-1 font-serif text-lg italic leading-relaxed text-charcoal/80 md:text-xl">
              {item.message}
            </p>
            <span className="mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-bold tracking-wider text-cream">
              {item.initials}
            </span>
          </motion.div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Mensaje ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-forest" : "w-2 bg-sage/40 hover:bg-sage"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── FAQ accordion item ─── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-sage/20 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-semibold text-forest md:text-base">
          {q}
        </span>
        <span
          className={`text-terracotta transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 pr-8 text-sm leading-relaxed text-charcoal/70">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  // Seats counter
  const [remaining, setRemaining] = useState<number>(plantConfig.capacity);
  const [isFull, setIsFull] = useState(false);

  // Registration form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("solo");
  const [carpool, setCarpool] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waitlist state
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  // Plant messages from prior registrants
  const [plantMessages, setPlantMessages] = useState<PlantMessage[]>([]);

  // Share flow
  const [exporting, setExporting] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // UTM
  const [utm, setUtm] = useState<{
    source?: string;
    medium?: string;
    campaign?: string;
  }>({});

  // Hero video
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      videoRef.current?.play().catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // Fetch seats on mount
  useEffect(() => {
    fetch("/api/brote/plant-counter")
      .then((r) => r.json())
      .then((d) => {
        setRemaining(d.remaining ?? plantConfig.capacity);
        setIsFull(Boolean(d.full));
      })
      .catch(() => {});
  }, []);

  // Fetch plant messages on mount
  useEffect(() => {
    fetch("/api/brote/plant-messages")
      .then((r) => r.json())
      .then((d) => setPlantMessages(d.messages ?? []))
      .catch(() => {});
  }, []);

  // Capture UTM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u: typeof utm = {};
    if (params.get("utm_source")) u.source = params.get("utm_source")!;
    if (params.get("utm_medium")) u.medium = params.get("utm_medium")!;
    if (params.get("utm_campaign")) u.campaign = params.get("utm_campaign")!;
    if (Object.keys(u).length > 0) setUtm(u);
  }, []);

  const handleRegister = useCallback(async () => {
    if (submitting || !name.trim()) return;
    if (!isValidEmail(email)) {
      setError(dict.registration.errorMessage);
      return;
    }
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
          groupType,
          carpool,
          ...(message.trim() && { message: message.trim() }),
          ...(Object.keys(utm).length > 0 && { utm }),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        if (data.alreadyRegistered) {
          setAlreadyRegistered(true);
        } else if (typeof data.remaining === "number") {
          setRemaining(data.remaining);
          setIsFull(data.remaining === 0);
        }
        setSubmitted(true);
      } else if (data.full) {
        setIsFull(true);
        setRemaining(0);
        setError(dict.registration.subtitleFull);
      } else {
        setError(data.error || dict.registration.errorMessage);
      }
    } catch {
      setError(dict.registration.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, name, email, groupType, carpool, message, utm, dict]);

  const handleWaitlist = useCallback(async () => {
    if (submitting) return;
    if (!isValidEmail(waitlistEmail)) {
      setError(dict.registration.errorMessage);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/brote/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "waitlist",
          email: waitlistEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWaitlistSubmitted(true);
      } else {
        setError(dict.registration.errorMessage);
      }
    } catch {
      setError(dict.registration.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, waitlistEmail, dict]);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
      });

      if (navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "brote-plantacion.png", {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "BROTE — El segundo movimiento",
          });
          setExporting(false);
          return;
        }
      }

      const link = document.createElement("a");
      link.download = "brote-plantacion.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const seatsLabel = isFull
    ? dict.hero.seatsFullLabel
    : dict.hero.seatsLabel.replace("{remaining}", String(remaining));

  const registrationSubtitle = isFull
    ? dict.registration.subtitleFull
    : dict.registration.subtitle.replace("{remaining}", String(remaining));

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

      <main className="overflow-hidden">
        {/* ───────── 1. HERO ───────── */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-forest px-6 text-center">
          {/* Background video */}
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setVideoLoaded(true)}
            className={`absolute inset-0 z-[1] h-full w-full object-cover object-center transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src="/plant-hero.mp4" type="video/mp4" />
          </video>

          {/* Strong dark overlay for text contrast */}
          <div className="absolute inset-0 z-[2] bg-forest/75" />

          <div className="relative z-10 mx-auto max-w-2xl">
            {isReturning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 inline-block rounded-full bg-terracotta/20 px-4 py-1.5 text-xs font-medium text-cream md:text-sm"
              >
                {dict.hero.welcomeBack}
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-terracotta md:text-sm"
            >
              {dict.hero.eyebrow}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-serif text-4xl leading-[1.05] tracking-tight text-cream md:text-6xl lg:text-7xl"
            >
              {dict.hero.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream/85 md:text-lg"
            >
              {dict.hero.subtitle}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mt-6 text-sm font-medium text-cream/70 md:text-base"
            >
              {dict.hero.tag}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <button
                onClick={scrollToRegistration}
                className="inline-block cursor-pointer rounded-full bg-cream px-8 py-4 text-base font-semibold text-forest shadow-lg transition-all hover:bg-cream/90 hover:shadow-xl md:text-lg"
              >
                {dict.hero.cta}
              </button>
              <p
                className={`text-xs font-semibold uppercase tracking-wider md:text-sm ${
                  isFull ? "text-terracotta" : "text-cream/70"
                }`}
              >
                {seatsLabel}
              </p>
            </motion.div>
          </div>
        </section>

        {/* ───────── 2. EL SEGUNDO MOVIMIENTO ───────── */}
        <Section id="ritual" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl leading-tight text-forest md:text-4xl lg:text-5xl">
              {dict.ritual.title}
              <br />
              <span className="text-terracotta">{dict.ritual.titleLine2}</span>
            </h2>
            <p className="mt-8 text-base leading-relaxed text-charcoal/75 md:text-lg">
              {dict.ritual.body}
            </p>
          </div>
        </Section>

        {/* ───────── 3. QUÉ VA A PASAR ESA TARDE ───────── */}
        <Section id="actividades" className="bg-cream-dark/30 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-serif text-3xl text-forest md:text-4xl">
              {dict.activitiesHeading}
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {dict.activities.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-2xl border border-sage/20 bg-white/70 p-6"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <h3 className="mt-3 font-serif text-xl text-forest">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ───────── 4. UN ÁRBOL ───────── */}
        <Section
          id="unarbol"
          className="relative overflow-hidden px-6 py-16 md:py-24"
        >
          <Image
            src="/unarbol-en-accion.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-forest/80" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.unArbol.heading}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-cream/90 md:text-lg">
              {dict.unArbol.body}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-cream/80">
                {dict.unArbol.partnerLabel}
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

        {/* ───────── 5. LO QUE NECESITÁS SABER (LOGISTICS + FAQ) ───────── */}
        <Section id="logistica" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.logistics.heading}
            </h2>

            <ul className="mt-8 space-y-3">
              {dict.logistics.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-charcoal/75 md:text-base"
                >
                  <span className="mt-0.5 flex-shrink-0 text-terracotta">•</span>
                  {item}
                </li>
              ))}
            </ul>

            <h3 className="mt-12 text-xs font-semibold uppercase tracking-widest text-sage">
              {dict.logistics.faqHeading}
            </h3>
            <div className="mt-4">
              {dict.logistics.faq.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </Section>

        {/* ───────── 6. ANOTATE ───────── */}
        <Section
          id="registro"
          className="bg-cream-dark/30 px-6 py-16 md:py-24"
        >
          <MessagesCarousel
            heading={dict.messagesHeading}
            items={plantMessages}
          />

          <div className="mx-auto max-w-lg">
            <h2 className="text-center font-serif text-3xl text-forest md:text-4xl">
              {isFull
                ? dict.registration.waitlistHeading
                : dict.registration.heading}
            </h2>
            <p
              className={`mt-3 text-center text-sm md:text-base ${
                isFull ? "text-terracotta" : "text-charcoal/70"
              }`}
            >
              {isFull
                ? dict.registration.waitlistSubtitle
                : registrationSubtitle}
            </p>

            <div className="mt-8">
              <AnimatePresence mode="wait">
                {!submitted && !waitlistSubmitted && !isFull ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-3"
                  >
                    <p className="text-sm text-charcoal/60">
                      {dict.registration.helper}
                    </p>

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
                      placeholder={dict.registration.emailPlaceholder}
                      className="w-full rounded-full border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                    />

                    {/* Group type radio */}
                    <div className="mt-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-sage">
                        {dict.registration.groupLabel}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                        {(
                          [
                            { value: "solo", label: dict.registration.groupSolo },
                            { value: "con-alguien", label: dict.registration.groupWithSomeone },
                            { value: "grupo", label: dict.registration.groupGroup },
                          ] as { value: GroupType; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setGroupType(opt.value)}
                            className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                              groupType === opt.value
                                ? "border-forest bg-forest text-cream"
                                : "border-sage/30 bg-white text-charcoal/70 hover:border-forest/40"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Carpool checkbox */}
                    <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-sage/20 bg-white p-4">
                      <input
                        type="checkbox"
                        checked={carpool}
                        onChange={(e) => setCarpool(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-forest"
                      />
                      <span className="text-sm leading-snug text-charcoal/80">
                        {dict.registration.carpoolLabel}
                      </span>
                    </label>

                    {/* Message */}
                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-charcoal/50">
                        {dict.registration.messageLabel}
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                        placeholder={dict.registration.messagePlaceholder}
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                      />
                    </div>

                    <button
                      onClick={handleRegister}
                      disabled={submitting || !name.trim() || !isValidEmail(email)}
                      className="mt-2 w-full rounded-full bg-forest px-8 py-4 text-base font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
                    >
                      {submitting
                        ? dict.registration.submitting
                        : dict.registration.cta}
                    </button>
                    {error && (
                      <p className="text-center text-sm text-terracotta">
                        {error}
                      </p>
                    )}
                  </motion.div>
                ) : !submitted && !waitlistSubmitted && isFull ? (
                  <motion.div
                    key="waitlist-form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-3"
                  >
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleWaitlist()}
                      placeholder={dict.registration.emailPlaceholder}
                      className="w-full rounded-full border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                    />
                    <button
                      onClick={handleWaitlist}
                      disabled={submitting || !isValidEmail(waitlistEmail)}
                      className="w-full rounded-full bg-forest px-8 py-4 text-base font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
                    >
                      {submitting
                        ? dict.registration.submitting
                        : dict.registration.waitlistCta}
                    </button>
                    {error && (
                      <p className="text-center text-sm text-terracotta">
                        {error}
                      </p>
                    )}
                  </motion.div>
                ) : waitlistSubmitted ? (
                  <motion.div
                    key="waitlist-success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <span className="text-5xl">🌱</span>
                    <p className="text-base text-forest">
                      {dict.registration.waitlistSuccess}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4 text-center"
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
                      {dict.registration.successHeading}
                    </h3>
                    <p className="text-base text-charcoal/70">
                      {alreadyRegistered
                        ? dict.registration.alreadyRegistered
                        : dict.registration.successMessage}
                    </p>

                    {message.trim() && !alreadyRegistered && (
                      <div className="mt-4 flex w-full flex-col items-center gap-4">
                        <div
                          className="overflow-hidden rounded-xl shadow-lg"
                          style={{ width: 240, height: 426 }}
                        >
                          <div
                            style={{
                              width: 1080,
                              height: 1920,
                              transform: "scale(0.222)",
                              transformOrigin: "top left",
                            }}
                          >
                            <ShareCard
                              message={message.trim()}
                              name={name.trim()}
                              cardRef={shareCardRef}
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleShare}
                          disabled={exporting}
                          className="flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
                        >
                          {exporting
                            ? "..."
                            : typeof navigator !== "undefined" &&
                                "share" in navigator &&
                                "canShare" in navigator
                              ? dict.registration.shareButton
                              : dict.registration.shareDownload}
                        </button>
                        <p className="max-w-xs text-center text-sm text-charcoal/60">
                          {dict.registration.sharePrompt}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* ───────── 7. FINAL CTA ───────── */}
        <Section id="cierre" className="bg-forest px-6 py-20 text-center md:py-24">
          <div className="mx-auto max-w-xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.finalCta.title}
            </h2>
            <p className="mt-4 text-base text-cream/80 md:text-lg">
              {dict.finalCta.subtitle}
            </p>
            <button
              onClick={scrollToRegistration}
              className="mt-8 inline-block rounded-full bg-cream px-8 py-4 text-base font-semibold text-forest shadow-md transition-all hover:bg-cream/90 hover:shadow-lg md:text-lg"
            >
              {dict.finalCta.cta}
            </button>
            <p
              className={`mt-4 text-xs font-semibold uppercase tracking-wider md:text-sm ${
                isFull ? "text-terracotta" : "text-cream/60"
              }`}
            >
              {seatsLabel}
            </p>
          </div>
        </Section>
      </main>
    </>
  );
}
