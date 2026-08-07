"use client";

import { useRef, useEffect, type CSSProperties } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  fadeIn,
  fadeUp,
  fadeUpSlow,
  heroStagger,
  staggerContainer,
} from "@/lib/animations";
import { trackSectionView, trackCtaClick } from "@/lib/analytics";
import ScrollReveal from "./ScrollReveal";
import type { MentoriaDict, MentoriaSection } from "@/dictionaries/types";

interface MentoriaLandingProps {
  dict: MentoriaDict;
  locale: string;
  /** next/font variable class for Lora, loaded by the route (page.tsx). */
  fontClassName: string;
}

/* ────────────────────────────────────────────────────────────────────────
   Layout primitives.

   The design has a single breakpoint at 52rem (832px) — deliberately not one
   of Tailwind's, so it's expressed as the `min-[52rem]:` arbitrary variant.
   Below it everything is one column; above it the asymmetric two-column grid
   and the left offsets kick in. Type and spacing are fluid via clamp(), so no
   other breakpoint is needed and nothing depends on an exact string length —
   which is what lets ES and EN share the layout.
   ──────────────────────────────────────────────────────────────────────── */

/** The page's only container: max width + horizontal gutter. */
const WRAP = "mx-auto w-full max-w-[74rem] px-[clamp(1.5rem,5vw,4rem)]";

/** Narrow heading column + wide body column. */
const COLS =
  "grid gap-[clamp(1.25rem,3vw,3.5rem)] min-[52rem]:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] min-[52rem]:items-start";

/** "Por qué yo" flips it — the one intentional break in the rhythm. */
const COLS_REVERSED =
  "grid gap-[clamp(1.25rem,3vw,3.5rem)] min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)] min-[52rem]:items-start";

/** Vertical rhythm of a body section. */
const SECTION_PAD = "py-[clamp(3.25rem,7vw,6rem)]";

/** Body copy column: measure and colour. */
const PROSE = "max-w-[56ch] text-charcoal/90";

/** Space between consecutive paragraphs. */
const PROSE_GAP = "mt-[1.15em]";

/** Section heading — narrow column on the left, or inline when reversed. */
const HEADING =
  "font-serif text-[clamp(1.5rem,0.9rem_+_1.6vw,2.15rem)] font-medium leading-[1.12] tracking-[-0.012em] text-forest";

/** Uppercase micro-label — Source Sans 3, not the mono `.tech-label`. */
const MICRO_LABEL = "text-[0.78rem] font-semibold uppercase tracking-[0.19em]";

type SectionPhoto = {
  src: string;
  /** Aspect-ratio utility — the handoff fixes these framings. */
  aspect: string;
  sizes: string;
};

/* ────────────────────────────── pieces ────────────────────────────── */

/**
 * Hari's voice. Lora italic, hung on the left margin inside the text column —
 * deliberately a lower tier than the mentee testimonial, which is roman, much
 * larger, and gets a full-bleed band of its own. Kept local to this file
 * rather than reusing SectionQuote, which the homepage's ValueSection styles.
 */
function PullQuote({ text }: { text: string }) {
  return (
    <ScrollReveal
      variants={fadeUpSlow}
      className="mt-[clamp(2.25rem,5vw,3.5rem)]"
    >
      <blockquote className="max-w-[30ch] border-l-2 border-terracotta pl-[1.35rem] font-serif text-[clamp(1.12rem,0.95rem_+_0.5vw,1.4rem)] italic leading-[1.45] text-forest">
        {text}
      </blockquote>
    </ScrollReveal>
  );
}

function SectionPhotoFrame({
  photo,
  alt,
  className,
}: {
  photo: SectionPhoto;
  alt: string;
  className?: string;
}) {
  return (
    <ScrollReveal variants={fadeUpSlow} className={className}>
      <div className={`relative ${photo.aspect} overflow-hidden border border-tan`}>
        <Image
          src={photo.src}
          alt={alt}
          fill
          sizes={photo.sizes}
          className="object-cover"
        />
      </div>
    </ScrollReveal>
  );
}

/**
 * The mentee's voice — primary proof, read before any explanation.
 * `quoteClassName` carries the scale, which is the only thing that changes
 * between the hero band and the closing block: the quote stays the top voice
 * on the dark block, but small enough that the CTA heading leads the action.
 */
function Testimonial({
  testimonial,
  quoteClassName,
  dark = false,
}: {
  testimonial: { text: string; name: string; role?: string };
  quoteClassName: string;
  dark?: boolean;
}) {
  // One reveal around the whole figure, not one per part: figcaption has to
  // stay a direct child of figure for the two to be associated at all.
  return (
    <ScrollReveal variants={fadeUpSlow}>
      <figure>
        <blockquote
          className={`font-serif font-normal ${quoteClassName} ${
            dark ? "text-cream" : "text-forest"
          }`}
        >
          {/* Hangs above the first line without adding leading. */}
          <span aria-hidden="true" className="block h-[0.5em] leading-[0] text-sage">
            &ldquo;
          </span>
          {testimonial.text}
        </blockquote>
        <figcaption className="mt-[clamp(1.75rem,3vw,2.75rem)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.98rem]">
          <span
            aria-hidden="true"
            className={`h-px w-9 flex-none ${dark ? "bg-sage" : "bg-terracotta"}`}
          />
          <span className={`font-semibold ${dark ? "text-cream" : "text-charcoal"}`}>
            {testimonial.name}
          </span>
          {testimonial.role && (
            <span className={dark ? "text-cream/75" : "text-charcoal/75"}>
              {testimonial.role}
            </span>
          )}
        </figcaption>
      </figure>
    </ScrollReveal>
  );
}

/** One narrative section: heading in the narrow column, prose in the wide one. */
function Section({
  id,
  section,
  photo,
  reversed = false,
}: {
  id: string;
  section: MentoriaSection;
  photo?: SectionPhoto;
  reversed?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (isInView) trackSectionView(`mentoria_${id}`);
  }, [isInView, id]);

  const paragraphs = section.paragraphs.map((paragraph, i) => (
    <ScrollReveal
      key={`${id}-p-${i}`}
      variants={fadeUp}
      // The first paragraph sits flush; the rest carry the prose rhythm. When
      // reversed the heading precedes it, so paragraph 0 needs the gap too.
      className={i > 0 || reversed ? PROSE_GAP : undefined}
    >
      <p>{paragraph}</p>
    </ScrollReveal>
  ));

  if (reversed) {
    // The heading moves inside the text column and the photo takes the
    // right-hand column on its own.
    return (
      <section ref={ref} className={SECTION_PAD}>
        <div className={`${WRAP} ${COLS_REVERSED}`}>
          <div className={PROSE}>
            <ScrollReveal variants={fadeUp}>
              <h2 className={HEADING}>{section.heading}</h2>
            </ScrollReveal>
            {paragraphs}
            {section.quote && <PullQuote text={section.quote} />}
          </div>
          {photo && section.imageAlt && (
            <SectionPhotoFrame photo={photo} alt={section.imageAlt} />
          )}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={SECTION_PAD}>
      <div className={`${WRAP} ${COLS}`}>
        <ScrollReveal variants={fadeUp}>
          <h2 className={HEADING}>{section.heading}</h2>
        </ScrollReveal>
        <div className={PROSE}>
          {paragraphs}
          {section.quote && <PullQuote text={section.quote} />}
          {photo && section.imageAlt && (
            <SectionPhotoFrame
              photo={photo}
              alt={section.imageAlt}
              className="mt-[clamp(2rem,5vw,3rem)]"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── the page ───────────────────────────── */

export default function MentoriaLanding({
  dict,
  locale,
  fontClassName,
}: MentoriaLandingProps) {
  const ctaRef = useRef<HTMLElement>(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();

  // Under reduced motion everything still reveals, but by opacity only.
  const reveal = reducedMotion ? fadeIn : fadeUp;

  useEffect(() => {
    trackSectionView("mentoria_hero");
  }, []);

  const brandLink = `/${locale}`;

  return (
    <div
      className={`${fontClassName} texture-overlay relative min-h-screen bg-cream text-[clamp(1.02rem,0.55vw_+_0.9rem,1.18rem)] leading-[1.68] text-pretty`}
      // Lora replaces the site serif for this subtree only — every existing
      // `font-serif` inside resolves through it, and no other page is touched.
      style={{ "--font-serif": "var(--font-lora)" } as CSSProperties}
    >
      <div className="relative z-10">
        {/* Top bar: the brand and a hairline. No nav, not sticky. */}
        <header className="pt-6 pb-2">
          <div className={`${WRAP} flex items-baseline gap-3`}>
            <a
              href={brandLink}
              onClick={() => trackCtaClick("brand_home", brandLink, "mentoria")}
              className="font-serif text-[1.35rem] tracking-[0.01em] text-forest transition-colors hover:text-terracotta"
            >
              Hari
            </a>
            <span aria-hidden="true" className="h-px flex-1 bg-tan/80" />
          </div>
        </header>

        <main>
          {/* Hero */}
          <motion.section
            initial="hidden"
            animate="visible"
            variants={heroStagger}
            className="pt-[clamp(3.5rem,10vw,8rem)] pb-[clamp(3rem,7vw,5.5rem)]"
          >
            <div
              className={`${WRAP} min-[52rem]:grid min-[52rem]:grid-cols-2 min-[52rem]:items-end min-[52rem]:gap-x-[clamp(2rem,6vw,5rem)] min-[52rem]:gap-y-[clamp(2rem,4vw,3.25rem)]`}
            >
              <motion.p
                variants={reveal}
                className={`${MICRO_LABEL} flex items-center gap-[0.85rem] text-terracotta`}
              >
                {dict.hero.eyebrow}
                <span
                  aria-hidden="true"
                  className="h-px w-[clamp(2rem,6vw,5rem)] bg-sage"
                />
              </motion.p>

              <motion.h1
                variants={reveal}
                className="mt-[1.6rem] max-w-[17ch] font-serif text-[clamp(2.05rem,1.1rem_+_4.2vw,4.15rem)] font-medium leading-[1.12] tracking-[-0.012em] text-balance text-forest min-[52rem]:col-span-2"
              >
                {dict.hero.heading}
              </motion.h1>

              <motion.p
                variants={reveal}
                className="mt-8 max-w-[44ch] text-[1.1em] text-charcoal/75 min-[52rem]:mt-0 min-[52rem]:pb-[0.4rem]"
              >
                {dict.hero.intro}
              </motion.p>
            </div>
          </motion.section>

          {/* Testimonial 1 — full-bleed band, acts as a second hero. The extra
              left inset on desktop is what separates it from the hero above. */}
          {dict.testimonials[0] && (
            <section className="border-y border-sage/50 bg-cream-dark py-[clamp(3.5rem,9vw,7rem)]">
              <div
                className={`${WRAP} min-[52rem]:pl-[calc(clamp(1.5rem,5vw,4rem)_+_4vw)]`}
              >
                <Testimonial
                  testimonial={dict.testimonials[0]}
                  quoteClassName="max-w-[24ch] text-[clamp(1.9rem,1rem_+_3.6vw,3.5rem)] leading-[1.18] tracking-[-0.015em]"
                />
              </div>
            </section>
          )}

          <Section id="for_who" section={dict.sections.forWho} />
          <Section id="what" section={dict.sections.what} />
          <Section
            id="how"
            section={dict.sections.how}
            photo={{
              src: "/speaking.jpg",
              aspect: "aspect-[16/10]",
              sizes: "(min-width: 52rem) 46rem, 100vw",
            }}
          />
          <Section
            id="why_me"
            section={dict.sections.whyMe}
            reversed
            photo={{
              src: "/hari.jpg",
              aspect: "aspect-[4/5]",
              sizes: "(min-width: 52rem) 20rem, 100vw",
            }}
          />

          {/* "Lo práctico" and the closing block read as one piece: the spec
              list, the seam and the dark block all start in the same grid
              column, and the background change is a continuation, not a new
              section. */}
          <section className="pt-[clamp(3rem,7vw,5.5rem)]">
            <div className={`${WRAP} ${COLS}`}>
              <ScrollReveal variants={fadeUp}>
                <h2 className={HEADING}>{dict.practical.heading}</h2>
              </ScrollReveal>

              <div>
                <ScrollReveal variants={fadeUp}>
                  {/* No card, no zebra, no box — hairlines only. */}
                  <dl className="border-t border-tan">
                    {dict.practical.items.map((item) => (
                      <div
                        key={item.label}
                        className="grid gap-x-2 gap-y-[0.15rem] border-b border-tan py-[1.05rem] min-[52rem]:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] min-[52rem]:items-baseline min-[52rem]:gap-x-6 min-[52rem]:py-5"
                      >
                        <dt className="text-[0.76rem] font-semibold uppercase tracking-[0.15em] text-terracotta">
                          {item.label}
                        </dt>
                        <dd className="text-charcoal/90">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </ScrollReveal>

                <ScrollReveal variants={fadeUp}>
                  <p className="mt-[clamp(1.75rem,3.5vw,2.5rem)] max-w-[46ch] text-charcoal/75">
                    {dict.practical.note}
                  </p>
                </ScrollReveal>

                {/* The seam: a hairline that fades from tan into forest and
                    runs down into the dark block, which starts at -1px so the
                    line lands in it with no gap. */}
                <div
                  aria-hidden="true"
                  className="mt-[clamp(1.5rem,4vw,3rem)] h-[clamp(3rem,7vw,5.5rem)] w-px bg-gradient-to-b from-tan to-forest"
                />
              </div>
            </div>
          </section>

          {/* Closing block — same grid, so its content lines up with the spec
              list above and the seam runs straight into it. */}
          <motion.section
            ref={ctaRef}
            initial="hidden"
            animate={ctaInView ? "visible" : "hidden"}
            variants={staggerContainer}
            // Its own texture layer: the root overlay sits behind content, so
            // the forest background would otherwise paint over it.
            className="texture-overlay relative -mt-px bg-forest pt-[clamp(3rem,7vw,5.5rem)] pb-[clamp(3.5rem,8vw,6rem)]"
          >
            <div className={`relative z-10 ${WRAP} ${COLS}`}>
              <div className="hidden min-[52rem]:block" />
              <div>
                <motion.h2
                  variants={reveal}
                  className="max-w-[18ch] font-serif text-[clamp(1.7rem,1rem_+_2.2vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.012em] text-cream"
                >
                  {dict.cta.heading}
                </motion.h2>

                <motion.p
                  variants={reveal}
                  className="mt-6 max-w-[44ch] text-cream/75"
                >
                  {dict.cta.body}
                </motion.p>

                {dict.testimonials[1] && (
                  <motion.div
                    variants={reveal}
                    className="mt-[clamp(2.5rem,6vw,4rem)]"
                  >
                    <Testimonial
                      testimonial={dict.testimonials[1]}
                      dark
                      quoteClassName="max-w-[27ch] text-[clamp(1.35rem,0.95rem_+_1.3vw,2rem)] leading-[1.28]"
                    />
                  </motion.div>
                )}

                <motion.div
                  variants={reveal}
                  className="mt-[clamp(2.5rem,5vw,3.5rem)]"
                >
                  <a
                    href={dict.cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackCtaClick("mentoria_whatsapp", dict.cta.href, "mentoria")
                    }
                    className="inline-block border border-transparent bg-terracotta px-8 py-[1.05rem] font-semibold tracking-[0.02em] text-cream transition-colors hover:border-cream hover:bg-cream hover:text-forest"
                  >
                    {dict.cta.buttonLabel}
                  </a>
                </motion.div>
              </div>
            </div>
          </motion.section>
        </main>

        <footer className="texture-overlay relative bg-forest pb-10">
          <div className={`relative z-10 ${WRAP} border-t border-sage/30 pt-6`}>
            <a
              href={brandLink}
              onClick={() => trackCtaClick("brand_footer", brandLink, "mentoria")}
              className="font-serif text-[1.05rem] text-sage transition-colors hover:text-cream"
            >
              Hari
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
