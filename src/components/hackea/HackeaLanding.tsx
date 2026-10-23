"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import Image from "next/image";
import type { HackeaDict } from "@/dictionaries/types";
import type { HackeaDisplay } from "@/lib/hackea-display";
import type { HackeaVslSource } from "@/lib/hackea-vsl";
import { readBrowserAttribution } from "@/lib/attribution";
import {
  HACKEA_MAX_LENGTH,
  validateHackeaLead,
  type HackeaField,
  type HackeaTextField,
} from "@/lib/hackea-validation";
import {
  HACKEA_MAX_QUANTITY,
  formatArsLabel,
  hackeaGroupDiscountPercent,
  hackeaGroupPriceCents,
  hackeaGroupSavingsCents,
  hackeaPerPersonCents,
  hackeaConfig,
} from "@/data/hackea";
import {
  Badge,
  Eyebrow,
  GlitchText,
  HACKEA_FORM_ANCHOR,
  HACKEA_WHATSAPP_HREF,
  buttonClass,
} from "./ui";
import HackeaVsl from "./HackeaVsl";
import "./hackea.css";

/** Sticky header height the scroll leaves room for (design: −60px). */
const SCROLL_OFFSET = 60;
/** How long the "LISTO, {nombre}" state shows before the MP redirect. */
const REDIRECT_DELAY_MS = 1400;

const FIELDS: HackeaField[] = ["quantity", "name", "phone", "email"];
const QUANTITIES = Array.from({ length: HACKEA_MAX_QUANTITY }, (_, i) => i + 1);

/** Replaces each `{key}` token in a dictionary string. */
function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

const inputId = (f: HackeaField) => `hackea-${f}`;

/** Moves focus to the first field (in form order) that failed validation. */
function focusFirstInvalid(errors: HackeaField[]) {
  const first = FIELDS.find((f) => errors.includes(f));
  if (first) document.getElementById(inputId(first))?.focus();
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function HackeaLanding({
  dict,
  display,
  priceLabel,
  locale,
  fontClassName,
  salesOpen,
  vsl,
  vslPoster,
  vslAutoplay,
}: {
  dict: HackeaDict;
  display: HackeaDisplay;
  priceLabel: string;
  locale: string;
  fontClassName: string;
  /** False once the talk has started: a closed card replaces the form. */
  salesOpen: boolean;
  /** null = poster only (no video configured). */
  vsl: HackeaVslSource | null;
  /** Frame of the video behind the poster; null = gradient only. */
  vslPoster: string | null;
  /** Start the VSL on load (muted + unmute overlay where sound is blocked). */
  vslAutoplay: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<HackeaField[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    [],
  );

  // The fbq stub is inlined by <MetaPixel /> in the page, so it already
  // exists here; the call queues until fbevents.js loads.
  useEffect(() => {
    window.fbq?.("track", "ViewContent", {
      content_name: "Hackeá tu mente",
      content_category: "Event Ticket",
      currency: hackeaConfig.currency,
      value: hackeaConfig.ticketPriceCents / 100,
    });
  }, []);

  const goForm = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(HACKEA_FORM_ANCHOR);
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const result = validateHackeaLead({ quantity, name, phone, email });
    setFormError(null);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstInvalid(result.errors);
      return;
    }
    setErrors([]);
    setSubmitting(true);

    // Shared with the server's CAPI InitiateCheckout so Meta dedupes the pair.
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch("/api/hackea/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // UTMs from the URL + the /go/[slug] cookie: buildAttribution only
        // sees `utm` through the body, so without this an ?utm_source=…
        // link reaches the CRM unattributed.
        body: JSON.stringify({
          ...result.value,
          locale,
          eventId,
          ...readBrowserAttribution(window.location.search, document.cookie),
        }),
      });
      const data: { initPoint?: unknown; error?: unknown } = await res
        .json()
        .catch(() => ({}));

      if (res.ok && typeof data.initPoint === "string") {
        const initPoint = data.initPoint;
        // Only once the server took the lead: that is when its CAPI twin
        // goes out. The basket value, like the server's — a deduped pair
        // that disagrees on value is worse than either alone.
        window.fbq?.(
          "track",
          "InitiateCheckout",
          {
            currency: hackeaConfig.currency,
            value: hackeaGroupPriceCents(result.value.quantity) / 100,
            num_items: result.value.quantity,
          },
          { eventID: eventId },
        );
        setDone(true);
        redirectTimer.current = setTimeout(() => {
          window.location.href = initPoint;
        }, REDIRECT_DELAY_MS);
        return;
      }

      if (
        res.status === 400 &&
        FIELDS.includes(data.error as HackeaField)
      ) {
        setErrors([data.error as HackeaField]);
        // Focus after the re-render that re-enables the inputs.
        const invalid = data.error as HackeaField;
        setTimeout(() => focusFirstInvalid([invalid]), 0);
      } else if (res.status === 409) {
        setFormError(dict.form.errors.alreadyPaid);
      } else if (res.status === 410) {
        setFormError(dict.form.errors.closed);
      } else if (res.status === 429) {
        setFormError(dict.form.errors.rateLimited);
      } else {
        setFormError(dict.form.errors.generic);
      }
    } catch {
      setFormError(dict.form.errors.generic);
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    redirectTimer.current = null;
    setDone(false);
  };

  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const doneTitle = firstName
    ? dict.done.title.replace("{nombre}", firstName)
    : dict.done.titleNoName;
  const [doneBefore, doneAfter = ""] = dict.done.body.split("{phone}");

  const err = (f: HackeaField) => (errors.includes(f) ? dict.form.errors[f] : null);

  const field = (
    f: HackeaTextField,
    props: {
      label: string;
      placeholder: string;
      value: string;
      onChange: (v: string) => void;
      type: string;
      autoComplete: string;
      hint?: string;
      required?: boolean;
    },
  ) => {
    const error = err(f);
    const note = error ?? props.hint;
    const id = inputId(f);
    const noteId = `${id}-note`;
    // The note sits outside the <label> so it is the input's description
    // (aria-describedby), not part of its accessible name.
    return (
      <div className="htm-field">
        <label htmlFor={id} className="htm-field__label">
          {props.label}
        </label>
        <input
          id={id}
          className="htm-field__input"
          name={f}
          type={props.type}
          autoComplete={props.autoComplete}
          inputMode={f === "phone" ? "tel" : undefined}
          placeholder={props.placeholder}
          maxLength={HACKEA_MAX_LENGTH[f]}
          value={props.value}
          required={props.required}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          onChange={(e) => props.onChange(e.target.value)}
        />
        {note && (
          <span
            id={noteId}
            className={`htm-field__note${error ? " htm-field__note--error" : ""}`}
          >
            {note}
          </span>
        )}
      </div>
    );
  };

  // Per-person price leads, the discount follows; the group total only
  // shows up small, right before paying.
  const perPersonLabel = formatArsLabel(hackeaPerPersonCents(quantity));
  const discountPct = hackeaGroupDiscountPercent(quantity);
  const maxDiscountPct = hackeaGroupDiscountPercent(HACKEA_MAX_QUANTITY);
  const quantityError = err("quantity");
  const quantityNote = quantityError ?? dict.form.quantityHint;

  const details: [string, string][] = [
    [dict.purchase.labels.date, display.longDate],
    [dict.purchase.labels.time, display.time],
    [dict.purchase.labels.place, display.placeShort],
    [dict.purchase.labels.with, dict.purchase.withValue],
    [dict.purchase.labels.includes, dict.purchase.includesValue],
  ];

  return (
    <div className={`hackea ${fontClassName}`}>
      <header className="htm-header">
        <div className="htm-header__inner">
          <div className="htm-wordmark">
            {dict.header.wordmarkLead} <span>{dict.header.wordmarkAccent}</span>
          </div>
          <a
            href={`#${HACKEA_FORM_ANCHOR}`}
            onClick={goForm}
            className={buttonClass({ size: "sm" })}
          >
            {salesOpen ? dict.header.cta : dict.closed.cta}
          </a>
        </div>
      </header>

      <main>
        <HackeaVsl
          dict={dict.vsl}
          source={vsl}
          poster={vslPoster}
          autoplay={vslAutoplay}
          priceLabel={priceLabel}
          salesOpen={salesOpen}
          closedCta={dict.closed.cta}
          goForm={goForm}
        />

        <section className="htm-hero htm-grain">
          <div className="htm-hero__scan htm-scanlines" aria-hidden="true" />
          <div className="htm-hero__grid">
            <div className="htm-hero__copy">
              <Eyebrow lead={dict.hero.eyebrowLead}>{dict.hero.eyebrowRest}</Eyebrow>
              <h1 className="htm-hero__title" style={{ margin: 0 }}>
                <GlitchText as="span">{dict.hero.titleLine1}</GlitchText>{" "}
                <GlitchText as="span" fill="violet" glitch="lg">
                  {dict.hero.titleLine2}
                </GlitchText>
              </h1>
              <div className="htm-datestamp">
                <span className="htm-datestamp__date">{display.stamp}</span>
                <span className="htm-datestamp__time">/ {display.stampTime}</span>
              </div>
              <p className="htm-hero__body">{dict.hero.body}</p>
              <div className="htm-hero__place">{display.placeFull}</div>
              <div className="htm-row">
                <a
                  href={`#${HACKEA_FORM_ANCHOR}`}
                  onClick={goForm}
                  className={buttonClass({ size: "lg" })}
                >
                  {salesOpen ? dict.hero.cta : dict.closed.cta}
                </a>
                {salesOpen && <Badge tone="outline">{dict.hero.scarcity}</Badge>}
              </div>
            </div>
            <div className="htm-hero__portrait">
              <div className="htm-hero__glow" aria-hidden="true" />
              <Image
                src="/hackea/hari-cutout.png"
                alt={dict.hero.imageAlt}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 540px"
                className="htm-hero__img"
              />
              <div className="htm-speaker">
                <div className="htm-speaker__prefix">{dict.hero.speakerPrefix}</div>
                <div className="htm-speaker__name">
                  <b>{dict.hero.speakerFirst}</b> {dict.hero.speakerLast}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="htm-section htm-section--void">
          <div className="htm-section__grid htm-ebook-grid">
            <div className="htm-book-stage" aria-hidden="true">
              <div className="htm-book-stage__glow" />
              <div className="htm-book">
                <div className="htm-book__pages" />
                <div className="htm-book__cover">
                  <div className="htm-book__spine" />
                  <div className="htm-book__scan htm-scanlines" />
                  <div className="htm-book__kicker">{dict.ebook.cover.kicker}</div>
                  <div className="htm-book__mid">
                    <div className="htm-book__num">{dict.ebook.cover.number}</div>
                    <div className="htm-book__title">{dict.ebook.cover.title}</div>
                    <div className="htm-book__sub">{dict.ebook.cover.subtitle}</div>
                  </div>
                  <div className="htm-book__author">{dict.ebook.cover.author}</div>
                </div>
              </div>
            </div>
            <div className="htm-copy-col">
              <div style={{ display: "flex" }}>
                <Badge>{dict.ebook.badge}</Badge>
              </div>
              <h2 className="htm-h2">
                {dict.ebook.titleLead}{" "}
                <span className="htm-text-violet">{dict.ebook.titleAccent}</span>
              </h2>
              <p className="htm-ebook-body">{dict.ebook.body}</p>
            </div>
          </div>
        </section>

        <section id={HACKEA_FORM_ANCHOR} className="htm-section htm-section--page">
          <div className="htm-section__grid htm-buy-grid">
            <div className="htm-buy-col">
              <h2 className="htm-h2">
                {salesOpen ? dict.purchase.title : dict.closed.sectionTitle}
              </h2>
              <dl className="htm-details">
                {details.map(([label, value]) => (
                  <div key={label} className="htm-details__row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {salesOpen && (
                <div className="htm-row">
                  <Badge tone="outline">{dict.purchase.scarcity}</Badge>
                  {maxDiscountPct > 0 && (
                    <Badge>{fill(dict.purchase.groupBadge, { pct: maxDiscountPct })}</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="htm-card">
              {!salesOpen ? (
                <div className="htm-done">
                  <GlitchText fill="violet">{dict.closed.cardTitle}</GlitchText>
                  <p>{dict.closed.body}</p>
                  <div>
                    <a
                      href={HACKEA_WHATSAPP_HREF}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      {dict.closed.whatsappCta}
                    </a>
                  </div>
                </div>
              ) : done ? (
                <div className="htm-done" role="status">
                  <GlitchText fill="violet" animated>
                    {doneTitle}
                  </GlitchText>
                  <p>
                    {doneBefore}
                    <b>{phone.trim()}</b>
                    {doneAfter}
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={back}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      {dict.done.back}
                    </button>
                  </div>
                </div>
              ) : (
                <form className="htm-form" onSubmit={onSubmit} noValidate>
                  <div className="htm-form__head">
                    <div className="htm-form__title">
                      {quantity > 1
                        ? fill(dict.purchase.cardTitleGroup, { n: quantity })
                        : dict.purchase.cardTitle}
                    </div>
                    <div className="htm-form__price-wrap">
                      {discountPct > 0 && <Badge>-{discountPct}%</Badge>}
                      <div className="htm-form__price">
                        {quantity > 1 ? perPersonLabel : priceLabel}
                        {quantity > 1 && (
                          <span className="htm-form__unit"> {dict.form.perPerson}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="htm-field">
                    <label htmlFor={inputId("quantity")} className="htm-field__label">
                      {dict.form.quantityLabel}
                    </label>
                    <select
                      id={inputId("quantity")}
                      className="htm-field__input htm-field__select"
                      name="quantity"
                      value={quantity}
                      disabled={submitting}
                      aria-invalid={quantityError ? true : undefined}
                      aria-describedby={`${inputId("quantity")}-note`}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    >
                      {QUANTITIES.map((q) => (
                        <option key={q} value={q}>
                          {q === 1
                            ? fill(dict.form.quantityOptionSingle, { precio: priceLabel })
                            : fill(dict.form.quantityOption, {
                                n: q,
                                precio: formatArsLabel(hackeaPerPersonCents(q)),
                                pct: hackeaGroupDiscountPercent(q),
                              })}
                        </option>
                      ))}
                    </select>
                    <span
                      id={`${inputId("quantity")}-note`}
                      className={`htm-field__note${quantityError ? " htm-field__note--error" : ""}`}
                    >
                      {quantityNote}
                    </span>
                  </div>
                  {field("name", {
                    label: dict.form.nameLabel,
                    placeholder: dict.form.namePlaceholder,
                    value: name,
                    onChange: setName,
                    type: "text",
                    autoComplete: "name",
                    required: true,
                  })}
                  {field("phone", {
                    label: dict.form.phoneLabel,
                    placeholder: dict.form.phonePlaceholder,
                    value: phone,
                    onChange: setPhone,
                    type: "tel",
                    autoComplete: "tel",
                    hint: dict.form.phoneHint,
                    required: true,
                  })}
                  {field("email", {
                    label: dict.form.emailLabel,
                    placeholder: dict.form.emailPlaceholder,
                    value: email,
                    onChange: setEmail,
                    type: "email",
                    autoComplete: "email",
                  })}
                  {quantity > 1 && (
                    <p className="htm-form__total">
                      {fill(dict.form.totalLine, {
                        total: formatArsLabel(hackeaGroupPriceCents(quantity)),
                        ahorro: formatArsLabel(hackeaGroupSavingsCents(quantity)),
                      })}
                    </p>
                  )}
                  {formError && (
                    <p className="htm-form__error" role="alert">
                      {formError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    className={buttonClass({ size: "lg", fullWidth: true })}
                  >
                    {submitting ? dict.form.submitting : dict.form.submit}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="htm-footer">
        <div className="htm-footer__inner">
          <span className="htm-footer__left">{dict.footer.left}</span>
          <span>
            {display.stamp} / {display.stampTime} · {display.placeShort}
          </span>
        </div>
      </footer>
    </div>
  );
}
