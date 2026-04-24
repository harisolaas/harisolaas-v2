"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import type { SinergiaDict } from "@/dictionaries/types";
import { isValidEmail, isValidWhatsApp } from "@/lib/sinergia-types";
import { sinergiaConfig } from "@/data/sinergia";

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
  dict: SinergiaDict;
  locale: string;
}

// Reads the `haris_link` cookie set by `/go/[slug]`. Mirrors the fallback
// used on the server side by `buildAttribution` so cookie-only visitors
// (no utm_content in URL) still flow through the override path.
function readHarisLinkCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "haris_link") return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export default function SinergiaLanding({ dict, locale }: Props) {
  const otherLocale = locale === "es" ? "en" : "es";
  const localeLabel = locale === "es" ? "EN" : "ES";

  const [remaining, setRemaining] = useState<number>(sinergiaConfig.capacity);
  const [isFull, setIsFull] = useState(false);
  // When the landing arrives via a capacity-bypass invite link, the
  // backend returns `override: true` and we keep the form visible even
  // when remaining===0, swapping the default "lleno" card for an
  // invite-specific hint.
  const [hasOverride, setHasOverride] = useState(false);
  const [sessionDate, setSessionDate] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staysForDinner, setStaysForDinner] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-field "touched" state so errors only appear after the user has
  // interacted with a field (on blur) or attempted to submit. Prevents
  // the form from screaming in red the moment it loads.
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    dinner: false,
  });
  const touchAll = useCallback(
    () =>
      setTouched({ name: true, email: true, phone: true, dinner: true }),
    [],
  );

  const nameInvalid = !name.trim();
  const emailInvalid = !isValidEmail(email);
  const phoneInvalid = !isValidWhatsApp(phone);
  const dinnerInvalid = staysForDinner === null;
  const formInvalid =
    nameInvalid || emailInvalid || phoneInvalid || dinnerInvalid;
  const showNameError = touched.name && nameInvalid;
  const showEmailError = touched.email && emailInvalid;
  const showPhoneError = touched.phone && phoneInvalid;
  const showDinnerError = touched.dinner && dinnerInvalid;

  const [utm, setUtm] = useState<{
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  }>({});
  const [linkSlug, setLinkSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u: typeof utm = {};
    if (params.get("utm_source")) u.source = params.get("utm_source")!;
    if (params.get("utm_medium")) u.medium = params.get("utm_medium")!;
    if (params.get("utm_campaign")) u.campaign = params.get("utm_campaign")!;
    if (params.get("utm_content")) u.content = params.get("utm_content")!;
    if (Object.keys(u).length > 0) setUtm(u);
    // URL wins, fallback to the `haris_link` cookie set by /go/[slug] so
    // a user who clicked through yesterday and lands directly on sinergia
    // today still gets recognized as an override invitee.
    const slug = params.get("utm_content") ?? readHarisLinkCookie();
    if (slug) setLinkSlug(slug);

    // Pass the slug to next-session so the backend can tell us whether
    // this is an override invite. Coalesces the two effects so the fetch
    // sees the slug synchronously (state wouldn't be settled in time).
    const qs = slug ? `?link=${encodeURIComponent(slug)}` : "";
    fetch(`/api/sinergia/next-session${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setRemaining(d.remaining);
          const override = Boolean(d.override);
          setHasOverride(override);
          // Only show the "lleno" card when remaining===0 AND the user
          // doesn't carry an override invite.
          setIsFull(d.remaining === 0 && !override);
          setSessionDate(d.date);
        }
      })
      .catch(() => {});
  }, []);

  const scrollToRsvp = useCallback(() => {
    document.getElementById("rsvp")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Clear the generic error banner as soon as the user starts editing —
  // the red per-field state carries the "what's wrong" signal; the
  // banner adds nothing once they're correcting. Called from every
  // input's onChange and from the dinner toggle's onClick.
  const clearError = useCallback(() => setError(null), []);

  const handleRsvp = useCallback(async () => {
    if (submitting) return;
    if (formInvalid) {
      touchAll();
      setError(dict.rsvp.errorMessage);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sinergia/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          staysForDinner,
          ...(Object.keys(utm).length > 0 && { utm }),
          ...(linkSlug && { linkSlug }),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.alreadyRegistered) setAlreadyRegistered(true);
        if (typeof data.remaining === "number") {
          setRemaining(data.remaining);
          // Preserve override state — the form stays visible for
          // any subsequent interactions while the slug is active.
          setIsFull(data.remaining === 0 && !hasOverride);
        }
        setSubmitted(true);
      } else if (data.full) {
        setIsFull(true);
        setRemaining(0);
        setError(dict.rsvp.subtitleFull);
      } else {
        setError(data.error || dict.rsvp.errorMessage);
      }
    } catch {
      setError(dict.rsvp.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, formInvalid, touchAll, name, email, phone, staysForDinner, dict, utm, linkSlug, hasOverride]);

  const capacityStr = String(sinergiaConfig.capacity);
  const seatsLabel = isFull
    ? dict.hero.seatsFullLabel
    : dict.hero.seatsLabel
        .replace("{remaining}", String(remaining))
        .replace("{capacity}", capacityStr);

  // When the landing has an override invite and the event is already
  // full, swap the "quedan X de Y" subtitle for a dedicated invite hint
  // so the copy matches the user's situation.
  const rsvpSubtitle = isFull
    ? dict.rsvp.subtitleFull
    : hasOverride && remaining === 0
      ? dict.rsvp.subtitleOverride
      : dict.rsvp.subtitle
          .replace("{remaining}", String(remaining))
          .replace("{capacity}", capacityStr);

  return (
    <div className="sinergia-theme">
      <a
        href={`/${otherLocale}/sinergia`}
        className="fixed right-4 top-4 z-50 rounded-full border border-forest/30 bg-cream/80 px-3 py-1 text-xs font-semibold text-forest backdrop-blur transition-colors hover:border-forest/60"
      >
        {localeLabel}
      </a>

      <main className="overflow-hidden bg-cream text-charcoal">
        {/* ───── HERO ───── */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-forest px-6 text-center">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: "256px 256px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, rgba(217,122,58,0.22) 0%, rgba(14,107,168,0) 55%)",
            }}
          />

          <div className="relative z-10 mx-auto max-w-2xl">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta md:text-sm"
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

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <button
                onClick={scrollToRsvp}
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

        {/* ───── WHAT ───── */}
        <Section id="what" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl leading-tight text-forest md:text-4xl lg:text-5xl">
              {dict.what.heading}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-charcoal/75 md:text-lg">
              {dict.what.intro}
            </p>

            <ol className="mt-10 space-y-6">
              {dict.what.schedule.map((item, i) => (
                <motion.li
                  key={item.time}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="grid grid-cols-[80px_1fr] gap-4 md:grid-cols-[100px_1fr] md:gap-6"
                >
                  <span className="pt-1 font-serif text-lg text-terracotta md:text-xl">
                    {item.time}
                  </span>
                  <div className="border-l border-sage/30 pl-4 md:pl-6">
                    <h3 className="font-serif text-xl text-forest md:text-2xl">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-charcoal/70 md:text-base">
                      {item.description}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </Section>

        {/* ───── HOSTS ───── */}
        <Section id="hosts" className="bg-cream-dark/40 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.hosts.heading}
            </h2>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-sage/20 bg-white/70 p-6">
                <h3 className="font-serif text-2xl text-forest">
                  {dict.hosts.hari.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75 md:text-base">
                  {dict.hosts.hari.role}
                </p>
              </div>
              <div className="rounded-2xl border border-sage/20 bg-white/70 p-6">
                <h3 className="font-serif text-2xl text-forest">
                  {dict.hosts.coni.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75 md:text-base">
                  {dict.hosts.coni.role}
                </p>
              </div>
            </div>

            <p className="mt-8 font-serif text-base italic text-charcoal/70 md:text-lg">
              {dict.hosts.closing}
            </p>
          </div>
        </Section>

        {/* ───── FRICTIONS ───── */}
        <Section id="frictions" className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-forest md:text-4xl">
              {dict.frictions.heading}
            </h2>

            <ul className="mt-10 space-y-5">
              {dict.frictions.items.map((item, i) => (
                <motion.li
                  key={item.title}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="border-l-2 border-terracotta pl-5"
                >
                  <h3 className="font-serif text-xl text-forest md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-charcoal/75 md:text-base">
                    {item.description}
                  </p>
                </motion.li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ───── RSVP ───── */}
        <Section id="rsvp" className="bg-cream-dark/40 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-lg">
            <h2 className="text-center font-serif text-3xl text-forest md:text-4xl">
              {dict.rsvp.heading}
            </h2>
            <p
              className={`mt-3 text-center text-sm md:text-base ${
                isFull ? "text-terracotta" : "text-charcoal/70"
              }`}
            >
              {rsvpSubtitle}
            </p>

            <div className="mt-8">
              <AnimatePresence mode="wait">
                {!submitted && !isFull ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-3"
                  >
                    <div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearError();
                        }}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, name: true }))
                        }
                        placeholder={dict.rsvp.namePlaceholder}
                        aria-invalid={showNameError || undefined}
                        className={`w-full rounded-full border bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40 ${
                          showNameError
                            ? "border-terracotta"
                            : "border-sage/30"
                        }`}
                      />
                      {showNameError && (
                        <p className="ml-5 mt-1 text-xs text-terracotta">
                          {dict.rsvp.nameError}
                        </p>
                      )}
                    </div>
                    <div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearError();
                        }}
                        onBlur={() =>
                          setTouched((t) => ({ ...t, email: true }))
                        }
                        placeholder={dict.rsvp.emailPlaceholder}
                        aria-invalid={showEmailError || undefined}
                        className={`w-full rounded-full border bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40 ${
                          showEmailError
                            ? "border-terracotta"
                            : "border-sage/30"
                        }`}
                      />
                      {showEmailError && (
                        <p className="ml-5 mt-1 text-xs text-terracotta">
                          {dict.rsvp.emailError}
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
                        onBlur={() =>
                          setTouched((t) => ({ ...t, phone: true }))
                        }
                        placeholder={dict.rsvp.phonePlaceholder}
                        aria-invalid={showPhoneError || undefined}
                        className={`w-full rounded-full border bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40 ${
                          showPhoneError
                            ? "border-terracotta"
                            : "border-sage/30"
                        }`}
                      />
                      <p
                        className={`ml-5 mt-1 text-xs ${
                          showPhoneError
                            ? "text-terracotta"
                            : "text-charcoal/50"
                        }`}
                      >
                        {showPhoneError
                          ? dict.rsvp.phoneError
                          : dict.rsvp.phoneHelper}
                      </p>
                    </div>

                    <div className="mt-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-sage">
                        {dict.rsvp.dinnerLabel}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {[
                          { value: true, label: dict.rsvp.dinnerYes },
                          { value: false, label: dict.rsvp.dinnerNo },
                        ].map((opt) => (
                          <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => {
                              setStaysForDinner(opt.value);
                              setTouched((t) => ({ ...t, dinner: true }));
                              clearError();
                            }}
                            className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                              staysForDinner === opt.value
                                ? "border-forest bg-forest text-cream"
                                : showDinnerError
                                  ? "border-terracotta bg-white text-charcoal/70"
                                  : "border-sage/30 bg-white text-charcoal/70 hover:border-forest/40"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {showDinnerError && (
                        <p className="ml-1 mt-1 text-xs text-terracotta">
                          {dict.rsvp.dinnerError}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRsvp}
                      aria-disabled={submitting || formInvalid || undefined}
                      className={`mt-3 w-full rounded-full bg-forest px-8 py-4 text-base font-semibold text-cream transition-colors hover:bg-forest/90 ${
                        submitting || formInvalid ? "opacity-50" : ""
                      }`}
                    >
                      {submitting ? dict.rsvp.submitting : dict.rsvp.cta}
                    </button>
                    <p className="text-center text-xs text-charcoal/50">
                      {dict.rsvp.helper}
                    </p>
                    {error && (
                      <p className="text-center text-sm text-terracotta">
                        {error}
                      </p>
                    )}
                  </motion.div>
                ) : isFull && !submitted ? (
                  <motion.div
                    key="full"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-terracotta/30 bg-white/70 p-6 text-center"
                  >
                    <p className="text-base text-forest">
                      {dict.rsvp.subtitleFull}
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
                      📓
                    </motion.span>
                    <h3 className="font-serif text-2xl text-forest">
                      {dict.rsvp.successHeading}
                    </h3>
                    <p className="text-base text-charcoal/70">
                      {alreadyRegistered
                        ? dict.rsvp.alreadyRegistered
                        : dict.rsvp.successMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* ───── FINAL ───── */}
        <Section id="final" className="bg-forest px-6 py-20 text-center md:py-24">
          <div className="mx-auto max-w-xl">
            <h2 className="font-serif text-3xl text-cream md:text-4xl">
              {dict.final.heading}
            </h2>
            <p className="mt-4 text-base text-cream/80 md:text-lg">
              {dict.final.subtitle}
            </p>
            <button
              onClick={scrollToRsvp}
              className="mt-8 inline-block cursor-pointer rounded-full bg-cream px-8 py-4 text-base font-semibold text-forest shadow-md transition-all hover:bg-cream/90 hover:shadow-lg md:text-lg"
            >
              {dict.final.cta}
            </button>
            <p
              className={`mt-4 text-xs font-semibold uppercase tracking-wider md:text-sm ${
                isFull ? "text-terracotta" : "text-cream/60"
              }`}
            >
              {seatsLabel}
            </p>
            {sessionDate && !isFull && (
              <p className="mt-2 text-xs text-cream/50">
                {sessionDate}
              </p>
            )}
          </div>
        </Section>
      </main>
    </div>
  );
}
