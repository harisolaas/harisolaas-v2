"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import type { SinergiaParrafoDoubleDict } from "@/dictionaries/types";
import { isValidEmail, isValidWhatsApp } from "@/lib/sinergia-types";
import { sinergiaParrafoConfig } from "@/data/sinergia-parrafo";

interface Props {
  dict: SinergiaParrafoDoubleDict;
  locale: string;
}

interface PersonState {
  name: string;
  email: string;
  phone: string;
}

const emptyPerson: PersonState = { name: "", email: "", phone: "" };

function readHarisLinkCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "haris_link") return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export default function SinergiaParrafoDoubleLanding({ dict, locale }: Props) {
  const searchParams = useSearchParams();
  const otherLocale = locale === "es" ? "en" : "es";
  const localeLabel = locale === "es" ? "EN" : "ES";

  const [code, setCode] = useState("");
  const [validCode, setValidCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const [personOne, setPersonOne] = useState<PersonState>(emptyPerson);
  const [personTwo, setPersonTwo] = useState<PersonState>(emptyPerson);
  const [touched, setTouched] = useState({
    p1Name: false,
    p1Email: false,
    p1Phone: false,
    p2Name: false,
    p2Email: false,
    p2Phone: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [utm, setUtm] = useState<{
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
  }>({});
  const [linkSlug, setLinkSlug] = useState<string | undefined>(undefined);

  const validateCode = useCallback(
    async (raw: string): Promise<boolean> => {
      const trimmed = raw.trim().toUpperCase();
      if (!trimmed) return false;
      setValidating(true);
      setCodeError(null);
      try {
        const res = await fetch("/api/sinergia-parrafo/2x1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate", code: trimmed }),
        });
        const data = await res.json();
        if (data.valid) {
          setValidCode(data.code);
          return true;
        }
        setCodeError(
          data.reason === "used" ? dict.codeUsed : dict.codeInvalid,
        );
        return false;
      } catch {
        setCodeError(dict.errorMessage);
        return false;
      } finally {
        setValidating(false);
      }
    },
    [dict],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u: typeof utm = {};
    if (params.get("utm_source")) u.source = params.get("utm_source")!;
    if (params.get("utm_medium")) u.medium = params.get("utm_medium")!;
    if (params.get("utm_campaign")) u.campaign = params.get("utm_campaign")!;
    if (params.get("utm_content")) u.content = params.get("utm_content")!;
    if (Object.keys(u).length > 0) setUtm(u);
    const slug = params.get("utm_content") ?? readHarisLinkCookie();
    if (slug) setLinkSlug(slug);
  }, []);

  // Auto-validate ?code= from URL once on mount. validateCode is stable
  // enough (closes over dict only) that re-running on its identity would
  // just spam validate requests on every render.
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      validateCode(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const p1NameInvalid = !personOne.name.trim();
  const p1EmailInvalid = !isValidEmail(personOne.email);
  const p1PhoneInvalid = !isValidWhatsApp(personOne.phone);
  const p2NameInvalid = !personTwo.name.trim();
  const p2EmailInvalid = !isValidEmail(personTwo.email);
  const p2PhoneInvalid = !isValidWhatsApp(personTwo.phone);

  const emailsMatch =
    personOne.email.trim().toLowerCase() ===
      personTwo.email.trim().toLowerCase() &&
    personOne.email.trim().length > 0;

  const formInvalid =
    p1NameInvalid ||
    p1EmailInvalid ||
    p1PhoneInvalid ||
    p2NameInvalid ||
    p2EmailInvalid ||
    p2PhoneInvalid ||
    emailsMatch;

  const ctaLabel = useMemo(
    () => dict.cta.replace("{amount}", sinergiaParrafoConfig.ticketPriceLabel),
    [dict.cta],
  );

  const touchAll = useCallback(
    () =>
      setTouched({
        p1Name: true,
        p1Email: true,
        p1Phone: true,
        p2Name: true,
        p2Email: true,
        p2Phone: true,
      }),
    [],
  );

  const handleCheckout = useCallback(async () => {
    if (submitting || !validCode) return;
    if (formInvalid) {
      touchAll();
      setSubmitError(
        emailsMatch ? dict.duplicateEmailError : dict.errorMessage,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/sinergia-parrafo/2x1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          code: validCode,
          personOne: {
            name: personOne.name.trim(),
            email: personOne.email.trim(),
            phone: personOne.phone.trim(),
          },
          personTwo: {
            name: personTwo.name.trim(),
            email: personTwo.email.trim(),
            phone: personTwo.phone.trim(),
          },
          locale,
          ...(Object.keys(utm).length > 0 && { utm }),
          ...(linkSlug && { linkSlug }),
        }),
      });
      const data = await res.json();
      if (data.ok && typeof data.initPoint === "string" && data.initPoint) {
        window.location.href = data.initPoint;
        return;
      }
      if (data.full) {
        setSubmitError(dict.capacityFullError);
      } else {
        setSubmitError(data.error || dict.errorMessage);
      }
    } catch {
      setSubmitError(dict.errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    validCode,
    formInvalid,
    emailsMatch,
    touchAll,
    personOne,
    personTwo,
    locale,
    utm,
    linkSlug,
    dict,
  ]);

  const fieldClass = (invalid: boolean) =>
    `w-full rounded-full border bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40 ${
      invalid ? "border-terracotta" : "border-sage/30"
    }`;

  return (
    <div className="sinergia-theme">
      <a
        href={`/${otherLocale}/sinergia-parrafo-2x1${
          validCode ? `?code=${validCode}` : ""
        }`}
        className="fixed right-4 top-4 z-50 rounded-full border border-forest/30 bg-cream/80 px-3 py-1 text-xs font-semibold text-forest backdrop-blur transition-colors hover:border-forest/60"
      >
        {localeLabel}
      </a>

      <main className="overflow-hidden bg-cream text-charcoal">
        {/* ───── HERO ───── */}
        <section className="relative flex min-h-[60svh] flex-col items-center justify-center overflow-hidden bg-forest px-6 py-20 text-center">
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
              className="font-serif text-4xl leading-[1.05] tracking-tight text-cream md:text-5xl"
            >
              {dict.hero.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-cream/85 md:text-lg"
            >
              {dict.hero.subtitle}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-4 font-script text-2xl text-terracotta md:text-3xl"
            >
              {dict.hero.dateLine}
            </motion.p>
          </div>
        </section>

        {/* ───── INCLUDES ───── */}
        <section className="px-6 py-12 md:py-16">
          <div className="mx-auto max-w-xl">
            <ul className="space-y-3 rounded-2xl border border-sage/20 bg-white/70 p-6">
              {dict.includes.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 text-sm leading-relaxed text-charcoal/75 md:text-base"
                >
                  <span className="mt-1 text-terracotta">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───── CODE + FORM ───── */}
        <section className="bg-cream-dark/40 px-6 pb-20 pt-4 md:pb-24">
          <div className="mx-auto max-w-2xl">
            {!validCode ? (
              <div className="mx-auto max-w-md">
                <h2 className="text-center font-serif text-2xl text-forest md:text-3xl">
                  {dict.codePrompt}
                </h2>
                <div className="mt-6 flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setCodeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        validateCode(code);
                      }
                    }}
                    placeholder={dict.codePlaceholder}
                    className="flex-1 rounded-full border border-sage/30 bg-white px-5 py-3 text-sm uppercase tracking-wider text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
                  />
                  <button
                    type="button"
                    onClick={() => validateCode(code)}
                    disabled={!code.trim() || validating}
                    className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
                  >
                    {validating ? "…" : dict.codeButton}
                  </button>
                </div>
                {codeError && (
                  <p className="mt-3 text-center text-sm text-terracotta">
                    {codeError}
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-center text-sm font-semibold uppercase tracking-wider text-forest/60">
                  {dict.codeValidated} {validCode}
                </p>
                <h2 className="mt-4 text-center font-serif text-2xl text-forest md:text-3xl">
                  {dict.formHeading}
                </h2>

                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {(
                    [
                      {
                        label: dict.personOneLabel,
                        state: personOne,
                        setState: setPersonOne,
                        keys: {
                          name: "p1Name",
                          email: "p1Email",
                          phone: "p1Phone",
                        } as const,
                        invalids: {
                          name: p1NameInvalid,
                          email: p1EmailInvalid,
                          phone: p1PhoneInvalid,
                        },
                      },
                      {
                        label: dict.personTwoLabel,
                        state: personTwo,
                        setState: setPersonTwo,
                        keys: {
                          name: "p2Name",
                          email: "p2Email",
                          phone: "p2Phone",
                        } as const,
                        invalids: {
                          name: p2NameInvalid,
                          email: p2EmailInvalid,
                          phone: p2PhoneInvalid,
                        },
                      },
                    ] as const
                  ).map((col) => (
                    <div
                      key={col.label}
                      className="flex flex-col gap-3 rounded-2xl border border-sage/20 bg-white/70 p-5"
                    >
                      <p className="font-serif text-lg text-forest">
                        {col.label}
                      </p>
                      <div>
                        <input
                          type="text"
                          value={col.state.name}
                          onChange={(e) =>
                            col.setState({ ...col.state, name: e.target.value })
                          }
                          onBlur={() =>
                            setTouched((t) => ({ ...t, [col.keys.name]: true }))
                          }
                          placeholder={dict.namePlaceholder}
                          aria-invalid={
                            (touched[col.keys.name] && col.invalids.name) ||
                            undefined
                          }
                          className={fieldClass(
                            touched[col.keys.name] && col.invalids.name,
                          )}
                        />
                        {touched[col.keys.name] && col.invalids.name && (
                          <p className="ml-5 mt-1 text-xs text-terracotta">
                            {dict.nameError}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          type="email"
                          value={col.state.email}
                          onChange={(e) =>
                            col.setState({
                              ...col.state,
                              email: e.target.value,
                            })
                          }
                          onBlur={() =>
                            setTouched((t) => ({
                              ...t,
                              [col.keys.email]: true,
                            }))
                          }
                          placeholder={dict.emailPlaceholder}
                          aria-invalid={
                            (touched[col.keys.email] && col.invalids.email) ||
                            undefined
                          }
                          className={fieldClass(
                            touched[col.keys.email] && col.invalids.email,
                          )}
                        />
                        {touched[col.keys.email] && col.invalids.email && (
                          <p className="ml-5 mt-1 text-xs text-terracotta">
                            {dict.emailError}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={col.state.phone}
                          onChange={(e) =>
                            col.setState({
                              ...col.state,
                              phone: e.target.value,
                            })
                          }
                          onBlur={() =>
                            setTouched((t) => ({
                              ...t,
                              [col.keys.phone]: true,
                            }))
                          }
                          placeholder={dict.phonePlaceholder}
                          aria-invalid={
                            (touched[col.keys.phone] && col.invalids.phone) ||
                            undefined
                          }
                          className={fieldClass(
                            touched[col.keys.phone] && col.invalids.phone,
                          )}
                        />
                        <p
                          className={`ml-5 mt-1 text-xs ${
                            touched[col.keys.phone] && col.invalids.phone
                              ? "text-terracotta"
                              : "text-charcoal/50"
                          }`}
                        >
                          {touched[col.keys.phone] && col.invalids.phone
                            ? dict.phoneError
                            : dict.phoneHelper}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {emailsMatch && (
                  <p className="mt-4 text-center text-sm text-terracotta">
                    {dict.duplicateEmailError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting || formInvalid}
                  className={`mt-8 w-full rounded-full bg-forest px-8 py-4 text-base font-semibold text-cream transition-colors hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {submitting ? dict.submitting : ctaLabel}
                </button>
                <p className="mt-3 text-center text-xs text-charcoal/50">
                  {dict.helper}
                </p>
                {submitError && (
                  <p className="mt-3 text-center text-sm text-terracotta">
                    {submitError}
                  </p>
                )}
              </>
            )}

            <div className="mt-10 text-center">
              <a
                href={`/${locale}/sinergia-parrafo`}
                className="text-sm text-charcoal/50 underline decoration-charcoal/20 underline-offset-2 transition-colors hover:text-forest"
              >
                {dict.backLink}
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
