# Landing Upgrade Plan — "Warm-Tech Fusion"

**Goal:** The landing at `/[locale]` should make a visitor think *"this person is an elite UI engineer"* within the first 3 seconds — while keeping the warm, organic, human identity intact. The palette and the story stay; the **craft escalates**. Motion, typography, and interaction detail become the proof of skill, before a single word is read.

**Direction decided:** Warm-tech fusion (keep earthy palette, award-site execution) + full showpiece tech budget (WebGL, smooth scroll, custom cursor allowed).

**Reference vibe:** nature/culture studio sites that win Awwwards — organic materials, surgical motion. NOT dark-mode terminal aesthetics.

---

## Design principles

1. **The palette stays, the contrast sharpens.** Cream/forest/terracotta/sage remain the identity. Add one deep ink tone (`--color-ink: #16241D`, a near-black forest) for high-contrast editorial moments, and use terracotta more surgically — as a kinetic accent, not a decoration.
2. **Monospace is the "tech" signal.** A mono accent font (JetBrains Mono or IBM Plex Mono via `next/font`) for labels, metrics, dates, nav items, and index numbers (`01 / 05`). This is the single cheapest way to read "engineer" without abandoning warmth.
3. **Motion is the message.** Every animation scroll-linked (scrubbed) or physics-based, never generic fade-ups on a timer. Custom easing everywhere (expo/quart curves, no `easeOut` defaults).
4. **Craft that engineers notice.** Custom cursor, magnetic hover, tabular-nums count-ups, `prefers-reduced-motion` respected, 60fps, console Easter egg. The site itself is the portfolio piece.
5. **Performance is part of the flex.** Lighthouse ≥95 mobile stays non-negotiable. WebGL lazy-loads after LCP; a slow site that looks fancy would undermine the whole message.

---

## New dependencies

| Package | Purpose | Cost / mitigation |
|---|---|---|
| `lenis` | Smooth (lerped) scrolling — foundation for all scroll choreography | ~4KB gzip |
| `three` + `@react-three/fiber` | WebGL hero background (organic noise shader) | ~150KB — **dynamic import**, loads after LCP, static gradient fallback |
| *(none for text splitting)* | Hand-roll a `SplitText` component — it's ~40 lines and shows craft | 0 |

Everything else is framer-motion (already installed) pushed much harder: `useScroll`, `useTransform`, `useSpring`, `useMotionValue`.

---

## Phase 1 — Foundation: type, easing, smooth scroll

*Everything later builds on this. No visual redesign yet — the skeleton gets good bones.*

1. **Mono font token.** Add JetBrains Mono via `next/font` in `src/app/[locale]/layout.tsx`, expose as `--font-mono` in `globals.css` `@theme`. Convert all uppercase-tracking-widest labels to mono: `ProofCard` labels, `MetricDisplay` labels, `Navigation` links, Hero scroll CTA, timeline dates.
2. **Easing system.** Extend `src/lib/animations.ts` with named cubic-bezier curves (`easeOutExpo`, `easeOutQuart`, `easeInOutCirc`) and replace every `"easeOut"` usage. Longer durations (0.8–1.2s) with expo curves read dramatically more expensive than 0.6s easeOut.
3. **Lenis smooth scroll.** New `SmoothScroll.tsx` client wrapper mounted in the locale layout (landing only — exclude BROTE/Sinergia funnels; don't touch conversion pages). Sync with framer-motion's `useScroll`.
4. **`SplitText.tsx` component.** Splits text into words/chars, wraps in overflow-hidden masks, animates with stagger + clip-path reveal. Handles both locales (words re-split on dict change). This becomes the workhorse for hero + value statements.
5. **`prefers-reduced-motion`.** Global `useReducedMotion` handling — currently missing entirely. All scroll choreography degrades to simple opacity fades.

**Files touched:** `globals.css`, `animations.ts`, `[locale]/layout.tsx`, new `SmoothScroll.tsx`, new `SplitText.tsx`, label swaps in `ProofCard.tsx` / `MetricDisplay.tsx` / `Navigation.tsx`.

---

## Phase 2 — Hero showpiece (the 3-second impression)

*The current hero (centered name + circular photo + fade-up) is the weakest/most generic part. It becomes the signature moment.*

1. **Editorial type layout.** Name set at display scale (`clamp` up to ~12rem), tight leading, possibly split across two staggered lines (`HARALD` / `SOLAAS`) with an offset baseline. Char-by-char masked reveal on load via `SplitText`. Small mono metadata row above the name: `UI ENGINEER — BUENOS AIRES — {year}` style.
2. **WebGL organic background.** `HeroCanvas.tsx` — full-bleed r3f canvas running a fragment shader: slow-flowing fractal noise in cream/sage/tan tones (an animated, living version of the current static `texture-overlay`). Subtle mouse-position influence. `next/dynamic` with `ssr: false`; fallback = current CSS texture (also the reduced-motion and mobile-low-power path). Must not delay LCP (hero text is LCP).
3. **Portrait treatment.** Drop the circular avatar (reads "LinkedIn"). Rectangular portrait with a scroll-parallax inner image, warm-grain overlay, and a hover displacement/zoom. Decorative mono caption (`fig. 01 — the human`).
4. **Custom cursor.** Dot + spring-trailing ring (`useSpring` on motion values), scales up over interactive elements, `mix-blend-mode: difference`. Pointer-fine media query only — never on touch.
5. **Magnetic nav.** `Magnetic.tsx` wrapper (element eases toward cursor within proximity radius) applied to nav links and locale pill. Active-section indicator driven by scroll position.
6. **Scroll indicator → progress.** Replace bouncing arrow with a thin scroll-progress line + mono percentage or section index.

**Files touched:** `Hero.tsx` (rewrite), new `HeroCanvas.tsx`, new `Cursor.tsx`, new `Magnetic.tsx`, `Navigation.tsx`.

---

## Phase 3 — Scroll choreography of the value sections

*Five value statements are the narrative spine — they become scroll-scrubbed set pieces instead of fade-in text.*

1. **Scrubbed statement reveals.** Value statements reveal word-by-word tied to scroll progress (`useScroll` + `useTransform`, not one-shot `useInView`): words start at low opacity/ink-10% and resolve to full as the statement crosses the viewport. Add a large mono index (`01`–`05`) per section.
2. **Continuous background morphing.** Replace hard section-color boundaries (`bg-cream` → `bg-tan/30` → `bg-forest`) with scroll-driven color interpolation so cream melts into forest and back. This single change makes the page feel like one crafted piece instead of stacked sections. Keep `bgConfig` as the anchor palette per section.
3. **ProofCard tactility.** Mouse-tracked spotlight border (radial-gradient following cursor), subtle 3D tilt on hover, mono label + index. Remove generic `shadow-sm` card look — borders + background shifts read more editorial.
4. **MetricDisplay count-up.** Numbers animate from 0 with `tabular-nums` mono when scrolled into view (`animate` + spring). "20% → 70%", "14 → 0.3" become kinetic — this is Section 3's entire personality and currently it's static text.
5. **Photo reveals.** Images reveal via scroll-linked `clip-path` inset + inner parallax (image scales/translates inside its mask). Warm overlay stays.

**Files touched:** `ValueSection.tsx` (rewrite), `ProofCard.tsx`, `MetricDisplay.tsx`, `SectionQuote.tsx`.

---

## Phase 4 — Supporting cast + engineer-facing details

1. **Timeline.** SVG path that draws itself on scroll connecting entries; mono dates; year markers as large ink numerals. Keep expand/collapse.
2. **NowSection cards.** Magnetic CTAs, pulsing status dot on "ongoing" badges (subtle, like a healthy service indicator), stagger tied to scroll.
3. **Contact.** "Let's build something." gets the SplitText treatment; email link gets a copy-to-clipboard interaction with a micro-confirmation.
4. **View-source layer.** Console Easter egg (styled ASCII signature + "want to see how this was built?" + contact), `humans.txt`. Cheap, memorable, exactly the audience we want poking around.
5. **Footer.** Optional mono build-info line (commit short-hash, "hand-built with Next.js — no template").

---

## Phase 5 — Hardening

- **Perf budget:** Lighthouse mobile ≥95; LCP = hero heading (verify WebGL chunk loads post-LCP); WebGL bundle only on landing route; check `next build` output sizes.
- **Fallback matrix:** reduced-motion (fades only, no Lenis, no canvas), touch devices (no cursor/magnetic), low-power/no-WebGL (static texture), both locales (SplitText with long Spanish strings at display sizes).
- **A11y:** contrast on ink/terracotta combos, focus-visible styles that match the design (not browser default), semantic heading order unchanged.
- **QA on real devices** + cross-browser (Safari `clip-path` + blend-mode quirks are the usual suspects).

---

## Rollout

- One PR per phase, standard review lifecycle (Copilot + self-review), **no merge to main without explicit approval** — site is live.
- Phases 1–2 deliver most of the perceived impact; 3–5 compound it. Each phase leaves the site shippable.
- No seeder changes needed — the landing is fully static/dictionary-driven (allowed skip per repo conventions).
- No dictionary content changes required except possible new micro-copy keys (mono metadata row, fig captions) — added to both `es.ts` and `en.ts`, gender-agnostic voseo rules apply.

## What deliberately does NOT change

- The five values, the copy, the story structure, i18n, analytics events (`trackSectionView` etc.).
- BROTE / Sinergia / admin surfaces — untouched.
- The warm palette and photography-forward identity.
