"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import type { DesafioDict } from "@/dictionaries/types";
import type { DesafioLocale, DesafioPhase } from "@/data/desafio";
import type {
  DesafioMedia as DesafioMediaValue,
  DesafioPublicDay,
} from "@/lib/desafio";
import { fillTokens } from "@/data/brote";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { readBrowserAttribution } from "@/lib/attribution";

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

interface Props {
  dict: DesafioDict;
  locale: DesafioLocale;
  /** Built server-side by `buildPublicDays`: locked days carry no content. */
  days: DesafioPublicDay[];
  phase: DesafioPhase;
  unlockedDays: number;
  totalDays: number;
  startDateLabel: string;
  registrationOpen: boolean;
}

export default function DesafioLanding({
  dict,
  locale,
  days,
  phase,
  unlockedDays,
  totalDays,
  startDateLabel,
  registrationOpen,
}: Props) {
  const otherLocale = locale === "es" ? "en" : "es";

  const statusLine =
    phase === "before"
      ? fillTokens(dict.hero.startLabel, { date: startDateLabel })
      : phase === "live"
        ? fillTokens(dict.hero.liveLabel, {
            day: String(unlockedDays),
            total: String(totalDays),
          })
        : dict.hero.endedLabel;

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Once the challenge is running, returning participants come back for
  // the day's practice — the path moves up, right under the hero.
  const pathFirst = phase !== "before";

  const path = <PathSection dict={dict} days={days} />;

  return (
    <div className="min-h-screen bg-cream text-charcoal">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 md:px-10">
          <a
            href={`/${locale}`}
            aria-label={dict.footer.backHome}
            className="font-serif text-lg text-forest transition-colors hover:text-terracotta"
          >
            harisolaas
          </a>
          <a
            href={`/${otherLocale}/desafio`}
            className="rounded-full border border-sage/40 px-3 py-1 text-xs font-semibold tracking-wider text-charcoal/60 transition-colors hover:border-forest/40 hover:text-forest"
          >
            {dict.footer.localeSwitch}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="texture-overlay relative overflow-hidden bg-cream px-6 pb-20 pt-32 md:px-10 md:pb-28 md:pt-40">
        <div className="relative mx-auto max-w-5xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta"
          >
            {dict.hero.eyebrow}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 max-w-3xl font-serif text-5xl leading-[1.05] text-forest md:text-7xl"
          >
            {dict.hero.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal/75 md:ml-24 md:text-xl"
          >
            {dict.hero.subtitle}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-start gap-5 md:ml-24 md:flex-row md:items-center"
          >
            {registrationOpen && (
              <button
                type="button"
                onClick={() => scrollTo("anotate")}
                className="rounded-full bg-forest px-7 py-3.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-terracotta"
              >
                {dict.hero.cta}
              </button>
            )}
            <p className="flex items-center gap-2.5 font-serif text-lg italic text-forest/80">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${
                  phase === "live" ? "bg-terracotta" : "bg-sage"
                }`}
              />
              {statusLine}
            </p>
          </motion.div>
        </div>
      </section>

      {pathFirst && path}

      {/* Cómo funciona — asymmetric: heading left, numbered stops right */}
      <Section
        id="como-funciona"
        className="px-6 py-20 md:px-10 md:py-24"
      >
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <div>
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.what.heading}
            </h2>
            <p className="mt-4 text-sm text-charcoal/50">
              {dict.what.languageNote}
            </p>
          </div>
          <ol className="space-y-10">
            {dict.what.items.map((item, i) => (
              <li
                key={item.title}
                className={`flex gap-6 ${i === 1 ? "md:ml-12" : ""}`}
              >
                <span
                  aria-hidden
                  className="font-serif text-4xl leading-none text-terracotta/70"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-serif text-xl text-forest">
                    {item.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-charcoal/75">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Quién guía */}
      <Section id="quien-guia" className="bg-cream-dark px-6 py-20 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl border-l-2 border-sage pl-6 md:ml-[33%] md:pl-10">
            <h2 className="font-serif text-2xl text-forest md:text-3xl">
              {dict.host.heading}
            </h2>
            <p className="mt-4 font-serif text-lg italic leading-relaxed text-charcoal/80 md:text-xl">
              {dict.host.body}
            </p>
          </div>
        </div>
      </Section>

      {/* Formulario */}
      <Section id="anotate" className="px-6 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-xl">
          {registrationOpen ? (
            <RegistrationForm
              dict={dict}
              locale={locale}
              phase={phase}
              startDateLabel={startDateLabel}
            />
          ) : (
            <ClosedCard dict={dict} />
          )}
        </div>
      </Section>

      {!pathFirst && path}

      <footer className="border-t border-sage/20 px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-sm text-charcoal/50">
          <a href={`/${locale}`} className="hover:text-forest">
            ← {dict.footer.backHome}
          </a>
          <span className="font-serif text-forest/60">harisolaas.com</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Registration form
// ============================================================

function ClosedCard({ dict }: { dict: DesafioDict }) {
  return (
    <div className="rounded-3xl border border-sage/30 bg-white/60 p-8 text-center">
      <h2 className="font-serif text-2xl text-forest">
        {dict.form.closedHeading}
      </h2>
      <p className="mt-3 text-charcoal/70">{dict.form.closedMessage}</p>
    </div>
  );
}

function RegistrationForm({
  dict,
  locale,
  phase,
  startDateLabel,
}: {
  dict: DesafioDict;
  locale: DesafioLocale;
  phase: DesafioPhase;
  startDateLabel: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Errors only show after a field was blurred or a submit was attempted.
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
  });

  const nameInvalid = !name.trim();
  const emailInvalid = !isValidEmail(email);
  const phoneInvalid = !isValidWhatsApp(phone);
  const formInvalid = nameInvalid || emailInvalid || phoneInvalid;
  const showNameError = touched.name && nameInvalid;
  const showEmailError = touched.email && emailInvalid;
  const showPhoneError = touched.phone && phoneInvalid;

  const clearError = useCallback(() => setError(null), []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (formInvalid) {
        setTouched({ name: true, email: true, phone: true });
        setError(dict.form.errorMessage);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/desafio/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            locale,
            ...readBrowserAttribution(window.location.search, document.cookie),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setAlreadyRegistered(Boolean(data.alreadyRegistered));
          setSubmitted(true);
        } else if (data.closed) {
          setClosed(true);
        } else {
          // Server error strings are English and technical — the user
          // always gets the localized message.
          setError(dict.form.errorMessage);
        }
      } catch {
        setError(dict.form.errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, formInvalid, dict, name, email, phone, locale],
  );

  if (closed) return <ClosedCard dict={dict} />;

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-forest p-8 text-cream md:p-10"
        role="status"
      >
        <h2 className="font-serif text-3xl">{dict.form.successHeading}</h2>
        <p className="mt-4 leading-relaxed text-cream/85">
          {alreadyRegistered
            ? dict.form.alreadyRegistered
            : phase === "before"
              ? fillTokens(dict.form.successMessage, { date: startDateLabel })
              : dict.form.successMessageLive}
        </p>
      </motion.div>
    );
  }

  const inputClass = (invalid: boolean) =>
    `w-full rounded-full border bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40 ${
      invalid ? "border-terracotta" : "border-sage/30"
    }`;

  return (
    <div>
      <h2 className="font-serif text-4xl text-forest">{dict.form.heading}</h2>
      <p className="mt-3 leading-relaxed text-charcoal/70">
        {dict.form.subtitle}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-3">
        <div>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError();
            }}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder={dict.form.namePlaceholder}
            aria-label={dict.form.namePlaceholder}
            aria-invalid={showNameError || undefined}
            className={inputClass(showNameError)}
          />
          {showNameError && (
            <p className="ml-5 mt-1 text-xs text-terracotta">
              {dict.form.nameError}
            </p>
          )}
        </div>
        <div>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder={dict.form.emailPlaceholder}
            aria-label={dict.form.emailPlaceholder}
            aria-invalid={showEmailError || undefined}
            className={inputClass(showEmailError)}
          />
          {showEmailError && (
            <p className="ml-5 mt-1 text-xs text-terracotta">
              {dict.form.emailError}
            </p>
          )}
        </div>
        <div>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError();
            }}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            placeholder={dict.form.phonePlaceholder}
            aria-label={dict.form.phonePlaceholder}
            aria-invalid={showPhoneError || undefined}
            className={inputClass(showPhoneError)}
          />
          <p
            className={`ml-5 mt-1 text-xs ${
              showPhoneError ? "text-terracotta" : "text-charcoal/50"
            }`}
          >
            {showPhoneError ? dict.form.phoneError : dict.form.phoneHelper}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-terracotta/10 px-5 py-3 text-sm text-terracotta"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-terracotta px-6 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-forest disabled:opacity-60"
        >
          {submitting ? dict.form.submitting : dict.form.cta}
        </button>
        <p className="text-center text-xs text-charcoal/40">
          {dict.form.micro}
        </p>
      </form>
    </div>
  );
}

// ============================================================
// The path — 15 stops on a vertical line
// ============================================================

function PathSection({
  dict,
  days,
}: {
  dict: DesafioDict;
  days: DesafioPublicDay[];
}) {
  return (
    <Section
      id="recorrido"
      className="border-y border-sage/20 bg-white/40 px-6 py-20 md:px-10 md:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-3xl text-forest md:text-4xl">
          {dict.path.heading}
        </h2>
        <p className="mt-3 max-w-xl text-charcoal/65">{dict.path.subtitle}</p>

        <ol className="mt-12">
          {days.map((day, i) => (
            <PathStop
              key={day.dayNumber}
              day={day}
              dict={dict}
              isLast={i === days.length - 1}
            />
          ))}
        </ol>
      </div>
    </Section>
  );
}

function PathStop({
  day,
  dict,
  isLast,
}: {
  day: DesafioPublicDay;
  dict: DesafioDict;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(day.state === "open" && day.isToday);
  const panelId = useId();
  const dayLabel = fillTokens(dict.path.dayLabel, { n: String(day.dayNumber) });

  const circle =
    day.state === "open"
      ? "border-forest bg-forest text-cream"
      : day.state === "empty"
        ? "border-forest/50 bg-cream text-forest"
        : "border-sage/40 bg-cream text-charcoal/30";

  return (
    <li className="relative flex gap-5 pb-8 last:pb-0">
      {/* connector */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[19px] top-10 bottom-0 w-px bg-sage/40"
        />
      )}
      <span
        aria-hidden
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${circle} ${
          day.isToday ? "ring-4 ring-terracotta/25" : ""
        }`}
      >
        {day.dayNumber}
      </span>

      <div className="min-w-0 flex-1 pt-1.5">
        {day.state === "locked" && (
          <p className="text-sm text-charcoal/40">
            <span className="font-semibold">{dayLabel}</span> ·{" "}
            {fillTokens(dict.path.lockedLabel, { date: day.dateLabel })}
          </p>
        )}

        {day.state === "empty" && (
          <div>
            <DayMeta dict={dict} day={day} dayLabel={dayLabel} />
            <p className="mt-1 font-serif text-lg text-forest/70">
              {dict.path.emptyTitle}
            </p>
            {day.isToday && (
              <p className="mt-1 text-sm text-charcoal/55">
                {dict.path.emptyBody}
              </p>
            )}
          </div>
        )}

        {day.state === "open" && (
          <div>
            <DayMeta dict={dict} day={day} dayLabel={dayLabel} />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={panelId}
              className="group mt-1 flex w-full items-baseline justify-between gap-4 text-left"
            >
              <span className="font-serif text-xl text-forest transition-colors group-hover:text-terracotta md:text-2xl">
                {day.title}
              </span>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-terracotta">
                {open ? dict.path.collapse : dict.path.expand}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={panelId}
                  key="panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-5 pt-4">
                    {day.body && (
                      <p className="whitespace-pre-line leading-relaxed text-charcoal/80">
                        {day.body}
                      </p>
                    )}
                    {day.media && (
                      <DesafioMedia
                        media={day.media}
                        title={day.title ?? dayLabel}
                        dict={dict}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </li>
  );
}

function DayMeta({
  dict,
  day,
  dayLabel,
}: {
  dict: DesafioDict;
  day: DesafioPublicDay;
  dayLabel: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-charcoal/45">
      <span className="font-semibold text-charcoal/60">{dayLabel}</span>
      <span aria-hidden>·</span>
      <span>{day.dateLabel}</span>
      {day.isToday && (
        <span className="rounded-full bg-terracotta px-2 py-0.5 text-[10px] font-semibold text-cream">
          {dict.path.todayBadge}
        </span>
      )}
    </p>
  );
}

function DesafioMedia({
  media,
  title,
  dict,
}: {
  media: DesafioMediaValue;
  title: string;
  dict: DesafioDict;
}) {
  if (media.kind === "youtube") {
    return (
      <iframe
        src={media.embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-xl border-0 bg-charcoal/5"
      />
    );
  }

  if (media.kind === "audio") {
    return (
      <div className="space-y-3">
        <audio controls preload="none" src={media.url} className="w-full">
          {dict.path.audioFallback}
        </audio>
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-charcoal/50 underline decoration-sage underline-offset-2 hover:text-forest"
        >
          {dict.path.openMedia}
        </a>
      </div>
    );
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-forest"
    >
      {dict.path.openMedia} →
    </a>
  );
}
