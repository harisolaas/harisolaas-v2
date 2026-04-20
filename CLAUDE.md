# Harald Solaas — Personal Site Brief
## "Technology that serves people."

---

## PROJECT OVERVIEW

Build a personal storytelling website for Harald Solaas (goes by Hari), a 31-year-old Argentine senior software engineer and humanitarian. This is NOT a portfolio or online resume. It is a values-first narrative site where the career timeline supports the values — not the other way around.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Framer Motion (scroll animations), deploy-ready for Vercel.

**Design Direction:** Warm & earthy. Think natural tones, textured, deeply human. NOT corporate, NOT startup-slick.

---

## WORKFLOW FOR AGENTS

Two non-negotiable operational conventions for anyone (human or agent) opening work in this repo:

1. **Site is LIVE — do NOT push to main without explicit approval.** A clean review does not constitute merge approval. Wait for an explicit "ship" / "merge" / "mergealo" from the repo owner.
2. **Every PR goes through the review lifecycle** — Copilot auto-review + author self-review + addressing both sets of feedback — before handing off for merge. See [`docs/ops/pr-review.md`](docs/ops/pr-review.md) for the operational steps (open PR → self-review → fetch Copilot comments → merge findings → fix → verify → resolve threads → hand off).

Skip the review cycle only if the requester explicitly says so ("don't review" / "just open the PR") or the PR is genuinely trivial (one-line copy fix, typo).

**Prod-migration note:** Vercel does NOT auto-run `drizzle-kit migrate`. Any PR that changes `src/db/schema.ts` needs a manual migration step against the prod Neon branch — apply the generated SQL from `src/db/migrations/` after merge, before the new code serves traffic.

---

## COPY & LANGUAGE CONVENTIONS

### Spanish copy must be gender agnostic
Avoid gendered forms like "solo/sola", "bienvenido/a", "todos". Rewrite around them — usually with neutral phrasings that read more natural than "/a" workarounds.

| ❌ Avoid | ✅ Prefer |
|---|---|
| Solo / Sola | Por mi cuenta |
| ¿Venís solo? | ¿Venís por tu cuenta? |
| Bienvenido/a | Te damos la bienvenida · Qué bueno tenerte |
| Todos | Toda la comunidad · Quienes vienen |
| Anotado/a | En la lista · Anotaste tu lugar |

This applies to landing copy, dictionaries (`src/dictionaries/es.ts`), and emails. When in doubt, find a phrasing that doesn't need a gendered word at all — that's almost always cleaner than `/a`.

### Argentine voseo throughout
Spanish copy uses voseo (vos, tenés, querés, anotate) — never tuteo (tú, tienes, quieres). The site speaks like an Argentine friend, not a neutral Spanish translator.

### English mirror
The English dictionary (`src/dictionaries/en.ts`) mirrors the Spanish but doesn't try to translate Argentine slang literally. Keep the warmth, drop the regionalisms.

---

## DESIGN SPECIFICATIONS

### Color Palette
- **Primary cream/warm white:** `#FAF6F1` (backgrounds)
- **Deep forest green:** `#2D4A3E` (headings, accents)
- **Terracotta:** `#C4704B` (accent, highlights, links)
- **Warm tan:** `#D4C5B2` (secondary backgrounds, cards)
- **Charcoal:** `#2C2C2C` (body text)
- **Soft sage:** `#A8B5A0` (subtle accents, borders)

### Typography
- **Display/Headings:** A distinctive serif — something like Playfair Display, Lora, or DM Serif Display (load from Google Fonts). Bold, warm, editorial.
- **Body:** A clean but warm sans-serif — something like Source Sans 3, Nunito, or DM Sans. NOT Inter, NOT Roboto.
- **Accent/Quotes:** The serif font in italic for pull quotes and value statements.

### Visual Language
- Subtle linen/paper texture overlays on background sections (CSS noise or subtle gradients)
- Generous whitespace — let the content breathe
- Photography placeholders with warm-toned overlay treatment (sepia/warm filter via CSS)
- Asymmetric layouts — not everything centered, some sections left-aligned, some with offset elements
- Subtle scroll-triggered fade-in animations (Framer Motion)
- NO generic card grids, NO icon libraries, NO stock illustration style

### Motion & Animation
- Smooth scroll-triggered reveals (staggered fade-up for content blocks)
- Value statement text could have a subtle typewriter or fade-word effect
- Parallax on photo sections (subtle, not aggressive)
- Hover states on proof-point cards that reveal more detail
- Page load: staggered reveal of hero elements

---

## SITE ARCHITECTURE: VALUES-FIRST

The site is structured as **5 full-screen value statements**, each immediately followed by proof/evidence. Then a compact timeline reference section at the bottom. Then contact.

### SECTION 0: HERO
**Full viewport.**

- Name: **Harald Solaas**
- Tagline: *"I started meditating at 15, teaching in slums at 17, and writing code at 20. I haven't stopped doing any of them."*
- No job title in the hero — introduce Harald as a human, not a role
- Warm, atmospheric background (placeholder for a personal photo)
- Simple scroll indicator (arrow or "scroll to meet me")
- Minimal navigation: just anchor links to sections, maybe a hamburger on mobile

---

### SECTION 1: VALUE — "I build things that outlive me."

**The statement** takes up most of the viewport. Large serif type. Deep green on cream.

**The evidence** appears as you scroll into it — three proof points side by side (stacked on mobile):

1. **Community:** Led 50 volunteers to teach 500+ people in a Buenos Aires slum. Built the volunteer infrastructure, then stepped away. The program continued for 2+ years without him.
2. **Personal:** Created a basketball team at age 29 because he was too old to join one. Built it from nothing, played for two years, then left due to injury. The team kept playing for two more years.
3. **Professional:** At Cruise (autonomous vehicles, Silicon Valley), inherited a codebase with 20% test coverage and 14 crashes/month. Left it at 70%+ coverage with 0.3 crashes/month. The testing infrastructure he built became the team's foundation.

*Photo placeholder: volunteering or community work*

---

### SECTION 2: VALUE — "I see the humans behind the system."

**The statement** fills the screen.

**The evidence:**

1. **Origin:** Father was a psychologist and organizational consultant. From childhood, Hari learned to see systems as collections of people — their motivations, rewards, and sense of belonging.
2. **Formative:** At 15, became the youngest Art of Living trauma relief teacher in Latin America. Worked with people who lost homes in Villa La Angostura (2011-2012). Worked with orphans, at-risk youth, and past criminals. Learned that behind every difficult exterior, there's a story and there's love.
3. **Professional:** At Estée Lauder, a React component library serving 200+ ecommerce sites wasn't about code — it was about the person on the other end trying to buy a product. At Carewell, rebuilt a healthcare ecommerce platform so exhausted family caregivers could find what they need faster. At every company, ended up as the bridge between engineering and product/leadership — because he sees the humans, not just the code.

*Photo placeholder: working with youth or community setting*

---

### SECTION 3: VALUE — "I go to the last percentile."

**The statement** fills the screen.

**The evidence:**

1. **Cruise:** Testing coverage 20% → 70% in 3 months. Application crashes 14/month → 0.3/month. Reduced execution time by 90% on critical components. Built the analytics platform used by executives and operations staff across the company.
2. **Carewell:** Rebuilt a $21M healthcare ecommerce platform with React, Next.js, Tailwind CSS, and GraphQL. The site loads instantly, works without JavaScript, achieves exceptional SEO scores. Launched on time with increased engagement and sales in the first month.
3. **Estée Lauder:** Built flexible, reusable components serving 200+ brand sites globally. Test coverage 60% → 85%. Reduced time to first interaction. Multi-tenancy taken to the extreme — every deployment matters when hundreds of thousands of users depend on it daily.
4. **Philosophy:** "Not leaving anything for later. Going to the one percentile of making the user experience awesome. Optimizing as much as it makes sense, as much as it adds value."

*Visual: Key metrics displayed as large, bold numbers with context underneath*

---

### SECTION 4: VALUE — "Technology should serve people, not replace them."

**The statement** fills the screen.

**The evidence:**

1. **Art of Living streaming platform:** Built for the foundation with thousands of monthly users, using gamified video challenges to deepen engagement with meditation and wellbeing content.
2. **Cruise analytics:** Built tools that helped car engineers, testers, and data scientists visualize hundreds of thousands of data points from autonomous drives. Building the tools that build the future of transportation.
3. **Carewell:** Making healthcare supplies accessible to families caring for aging loved ones. Technology that reduces friction in a moment of vulnerability.
4. **Nubi digital wallet:** Gave 50,000+ Latin Americans easier access to their PayPal funds — international transfers, withdrawals, credit card management.
5. **Muhammad Yunus influence:** Inspired by the "Banker to the Poor" — the idea that systems (financial, technological, organizational) can be designed to serve people who have been forgotten.

*Quote callout: "I want to make technology your ally, your friend — not a threat."*

---

### SECTION 5: VALUE — "I bring joy to the work."

**The statement** fills the screen.

**The evidence:**

1. **The basketball team:** Too old to join a team at 29, so he created one. Joined an amateur league. It became its own living thing.
2. **Teaching meditation:** Three years in a slum, teaching teenagers breathing techniques, human values, how to be kids again. Helping adolescents leave crime. Showing that there's another way.
3. **Art of Living teacher (2022–present):** Teaching courses, building community on social media, learning to sell with authenticity, networking, building volunteer groups rooted in ethics.
4. **Daily practice:** 8-9 years of daily Sudarshan Kriya breathing practice. Joy isn't accidental — it's a discipline.
5. **Work philosophy:** "Having fun while we do the things that need to be done. Celebrating our victories and learning from our defeats and keeping our chin up."

*Photo placeholder: surfing, basketball, or Art of Living community*

---

### SECTION 6: "What I'm Building Right Now"

A living, breathing section that shows what Hari is actively doing. NOT a blog — more like a curated bulletin board. This section sits between the values (who I am) and the timeline (where I've been), creating a present-tense bridge.

**Visual treatment:** A grid of cards (2-3 columns desktop, stacked mobile) with warm backgrounds. Each card has:
- A category tag (Teaching, Building, Community, Personal)
- A short headline
- 1-2 sentences of context
- A date, status indicator, or "ongoing" badge
- A CTA button where relevant (Register, Learn More, Get in Touch, Follow)

**Tags color coding:**
- Teaching → sage green
- Building → terracotta
- Community → deep forest green
- Personal → warm tan

**Sample cards (to be replaced with real content):**

1. **[Teaching]** "Art of Living Workshops"
   Next dates for meditation and breathing technique courses. Learn Sudarshan Kriya and tools for managing stress, anxiety, and emotional wellbeing.
   → CTA: "See Upcoming Dates" (link to calendar or registration)

2. **[Building]** "Technology Partner for Local Businesses"
   Currently helping Argentine businesses bring their operations into the digital world — from automation to full product builds. If you need a technology partner who understands both the tech and the business, let's talk.
   → CTA: "Get in Touch"

3. **[Community]** "Tree Planting Initiative"
   Annual birthday tradition — planting trees with the community. Next event: [date placeholder].
   → CTA: "Join Us" or "Learn More"

4. **[Teaching]** "Breathwork & Human Values for Youth"
   Ongoing programs working with teenagers and young adults on meditation, emotional resilience, and finding alternatives to violence and crime.
   → CTA: "Volunteer" or "Learn More"

5. **[Personal]** "Surf Season Prep"
   Following an 8-week training program to get surf-ready and protect the knees. Follow along on Instagram.
   → CTA: "Follow on Instagram"

**Technical note:** This section should be easy to update. Consider making the cards data-driven (a simple JSON/content file or even a Notion integration later) so Hari can swap cards without touching the layout code. For now, a well-organized data array in the codebase is fine.

**Section headline:** "What I'm Building Right Now" or "What's Alive Right Now"
**Section subtext:** "I'm always building something — in code, in community, or in myself. Here's what I'm working on these days."

---

### SECTION 7: TIMELINE REFERENCE — "The Full Story"

A compact, elegant timeline — NOT the main attraction. More like an appendix. Expandable/collapsible.

**The arc:**
- **Age 15 (2009):** Art of Living — meditation, trauma relief teacher
- **2011-2012:** Villa La Angostura — post-disaster community support
- **2014-2017:** University of Belgrano — BSc in Business Management. Started programming at 20 out of necessity for entrepreneurship contests.
- **2016-Present:** Independent Software Engineer — freelance, artist portfolios, foundation sites, ecommerce
- **2018-2019:** GuruDevelopers — ecommerce, Art of Living streaming platform, WordPress plugins. First "real" software factory.
- **2019-2020:** Litebox (Technical Lead) — Nubi digital wallet (50K+ users), BI startup, marine business apps, mobile game (50K+ downloads), personalized dog nutrition ecommerce, mentored juniors to mid-level. Hybrid technical/leadership role.
- **~2016-2022:** Community service work — slum programs (50 volunteers, 500+ participants), 3-year soccer club youth program, volunteer team building
- **2020-2021:** The Estée Lauder Companies (Senior Frontend Engineer) — React component library, 200+ ecommerce sites, test coverage 60%→85%, global multi-tenancy at scale.
- **2021-2023:** Cruise via Toptal (Senior Software Engineer) — Autonomous vehicle analytics platform, testing 20%→70%, crashes 14→0.3/month, D3.js data visualization, solved never-before-solved problems. First Silicon Valley company.
- **2022:** Became Art of Living teacher for core programs
- **2023:** Norway trip — reconnecting with family heritage
- **2023-Present:** Senior consultant role — Carewell ($21M healthcare ecommerce, React/Next.js/Tailwind/GraphQL rebuild), Colgate (became PM's right hand, technology advisor), various clients. Natural evolution from engineer to trusted advisor.

**Technologies (compact display):**
React.js, React Native, Next.js, TypeScript, Node.js, GraphQL, D3.js, Tailwind CSS, Redux, MobX, Jest, Cypress, Styled Components, Vue.js, Express.js, PHP, Laravel, Docker, AWS, PostgreSQL, MySQL, MongoDB

---

### SECTION 7: WORKING WITH ME / CTA

**Headline:** "Let's build something."

**Short text:** I work as a senior technology consultant — helping companies build the right products with the right technologies. I bring deep engineering expertise, human communication, and a service-oriented mindset. I charge well because I deliver real value. If you want an engineer who cares about your problem as much as you do, let's talk.

**Links:**
- Email (placeholder)
- LinkedIn
- Toptal profile: https://www.toptal.com/resume/harald-solaas
- Carewell case study: https://www.toptal.com/case-study/healthcare-supply-modernizes-ecommerce-platform
- Instagram (for community/personal brand)
- Website: harisolaas.com

---

## WHAT THE VISITOR SHOULD FEEL

When someone finishes scrolling this site, they should think:

*"This person sees the world differently. He builds things that matter, he treats people with real respect, he's been in hard rooms and hard codebases and he handles both with the same calm. If I work with him, he's going to care about my problem as much as I do — maybe more. And he's going to build something that lasts."*

---

## TECHNICAL NOTES

- Next.js 14 App Router
- Tailwind CSS for styling
- Framer Motion for scroll-triggered animations
- Google Fonts for typography
- Responsive: mobile-first, beautiful on all screen sizes
- Image placeholders should be clearly marked for later replacement with real photos
- The timeline section should be expandable/collapsible
- Smooth scroll between sections
- Subtle navigation (floating or minimal header)
- Deploy-ready for Vercel
- SEO-optimized meta tags, Open Graph
- Performance: fast, lightweight, minimal JavaScript where possible

---

## KEY LINKS & REFERENCES

- Toptal profile: https://www.toptal.com/resume/harald-solaas
- Carewell case study: https://www.toptal.com/case-study/healthcare-supply-modernizes-ecommerce-platform
- Current site: harisolaas.com
- Resume PDF attached separately

---

## PHOTO PLACEHOLDERS NEEDED

1. Hero: personal portrait or atmospheric shot
2. Section 1 (Outlive me): community/volunteering work
3. Section 2 (Humans behind system): working with youth or community
4. Section 3 (Last percentile): could be abstract/code-related or product screenshots
5. Section 4 (Technology serves people): could show real products or human impact
6. Section 5 (Joy): surfing, basketball, Art of Living, or candid personal shot
7. Norway: transitional/personal moment (optional)

---

## BROTE — Event Ticketing System

BROTE is a reforestation party (fiesta de reforestación). Each ticket plants a real tree in Argentina via partnership with Un Árbol NGO. The event is March 28, 2026 in Palermo, Buenos Aires. **The site is LIVE — do NOT push to main without explicit approval.**

### Payment Flow (MercadoPago Checkout Pro)

1. User clicks CTA → frontend POSTs to `/api/brote/checkout`
2. Checkout endpoint creates an MP `Preference` with the ticket price → returns `init_point` URL
3. User is redirected to MercadoPago to pay (credit, debit, cash, MP wallet)
4. After payment → user lands on `/[locale]/brote/success` or `/brote/failure`
5. MP sends async webhook POST to `/api/brote/webhook`
6. Webhook: verifies HMAC signature → fetches payment from MP API → generates `BROTE-XXXXXXXX` ticket (nanoid) → stores in Redis → increments counter → sends email with QR code via Resend
7. At the door: `/brote/gate` scans/validates ticket IDs via `/api/brote/validate`

### Pricing (in `src/data/brote.ts`)

| Tier | Price (ARS) | Config key |
|---|---|---|
| Early bird (until Mar 14) | $18.650 | `earlyBirdPriceRaw` |
| Regular (door) | $23.313 | `ticketPriceRaw` |
| Un Árbol community (25% OFF) | $17.477 | `unArbolPriceRaw` |

### API Routes (`src/app/api/brote/`)

| Route | Method | Purpose |
|---|---|---|
| `checkout/` | POST | Creates MP Preference for regular/early-bird ticket. Rate limited (5/IP/60s) |
| `webhook/` | POST | Receives MP payment notifications. HMAC verification, idempotent (Redis `brote:payment:{id}` → ticketId), `emailSent` flag for crash recovery email retry |
| `counter/` | GET | Returns ticket count from Redis |
| `validate/` | POST | Actions: `check` (is ticket valid?) and `use` (mark used at door) |
| `admin/` | GET/POST | System status, ticket lookup, email resend, payment lookup. Auth: `Bearer $BROTE_ADMIN_SECRET` |
| `attendees/` | GET | Export attendee list. Auth required |
| `unarbol/` | GET/POST | Un Árbol discount codes: validate code, checkout at $17.477, admin generate/reset/list codes |

### Un Árbol Discount System (`/api/brote/unarbol`)

Single-use codes stored in Redis (`brote:unarbol:{CODE}` → `"valid"` or `"used"`). Page at `/[locale]/brote-unarbol` (noindex, not in nav/sitemap). Flow: enter code → validate → show checkout CTA → checkout marks code as used + creates MP preference at discounted price.

**Admin: generate codes:**
```
POST /api/brote/unarbol  (Auth: Bearer $BROTE_ADMIN_SECRET)
{"action": "generate", "count": 20}
```

**Admin: list codes:** `GET /api/brote/unarbol` (Auth required)

**Admin: reset used code:** `POST {"action": "reset", "code": "UNARBOL-XXXXXX"}` (Auth required)

### Pages

| Path | Purpose |
|---|---|
| `/[locale]/brote` | Main landing page — hero, experience grid, lineup accordion, impact section, pricing, about, practical details, final CTA |
| `/[locale]/brote/success` | Post-payment confirmation with forest message, email instructions, WhatsApp fallback |
| `/[locale]/brote/failure` | Failed/cancelled payment |
| `/[locale]/brote-unarbol` | Un Árbol community discount page (noindex, code-gated) |
| `/brote/flyer` | Internal flyer generator — 4 formats (1:1, 9:16, 16:9, 4:5), dark/light themes, original/promo variants, full-res PNG export. State lives in URL params (`?f=story&t=dark&v=promo`) |

### Key Files

| File | What it does |
|---|---|
| `src/components/BroteLanding.tsx` | Main landing — CTA calls `handleCheckout()` → POST `/api/brote/checkout` → redirect to MP |
| `src/components/BroteUnArbol.tsx` | Un Árbol discount page — code validation + checkout |
| `src/components/TreeCounter.tsx` | Animated SVG forest visualization (tickets vs goal). Dev buttons gated behind `NODE_ENV` |
| `src/data/brote.ts` | Config: prices, currency, venue, early bird deadline, expected attendees |
| `src/lib/brote-types.ts` | `BroteTicket` interface (id, paymentId, buyerEmail, buyerName, status, emailSent) |
| `src/lib/brote-email.ts` | HTML email template with inline QR code (CID attachment) |
| `src/lib/redis.ts` | Redis client singleton (node-redis v4, camelCase methods: `sMembers`, `sAdd`) |
| `src/lib/meta-capi.ts` | Meta Conversions API helper — `sendMetaEvent()`, fails silently |
| `src/app/brote/flyer/page.tsx` | Flyer generator with format/theme/variant toggles, html-to-image export |
| `src/app/brote/flyer/layout.tsx` | Standalone layout (outside `[locale]`, needs its own html/body + font imports) |

### Dependencies

- `mercadopago` — MP SDK (Preference, Payment classes)
- `redis` — node-redis v4 (camelCase methods)
- `resend` — Transactional email (lazy-instantiated in webhook to avoid build-time crash)
- `qrcode` — QR codes as data URLs
- `nanoid` — Short unique ticket IDs
- `html-to-image` — Client-side PNG export for flyer generator

### Environment Variables

| Var | Notes |
|---|---|
| `MP_ACCESS_TOKEN` | MercadoPago production token (starts with `APP_USR-`) |
| `MP_WEBHOOK_SECRET` | HMAC signing secret from MP dashboard |
| `REDIS_URL` | Redis connection string |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | From address (default: `brote@harisolaas.com`) |
| `NEXT_PUBLIC_BASE_URL` | **Must be `https://www.harisolaas.com`** (non-www gets 307, breaks MP webhook POSTs) |
| `BROTE_ADMIN_SECRET` | Auth for admin/attendees/unarbol-admin endpoints |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel ID (client-side) |
| `META_PIXEL_ID` | Same Pixel ID (server-side, used by CAPI) |
| `META_CAPI_TOKEN` | Meta Conversions API token |

### Redis Keys

| Key | Value |
|---|---|
| `brote:ticket:{ticketId}` | JSON BroteTicket (includes `emailSent` flag) |
| `brote:payment:{mpPaymentId}` | ticketId (idempotency) |
| `brote:counter` | Integer ticket count |
| `brote:attendees` | SET of JSON attendee objects |
| `brote:unarbol:{CODE}` | `"valid"` or `"used"` |
| `brote:checkout:{preferenceId}` | JSON: `{eventId, fbp, fbc, ip, ua}` for Meta CAPI (24h TTL) |

### Known Issues

- **www redirect**: Vercel 307 redirects non-www → www. All MP webhook URLs must use `www.harisolaas.com`
- **Webhook signature 401s**: Some MP webhook calls fail HMAC verification. Debug logging added. Email retry on idempotent calls works as workaround
- **Email crash recovery**: If webhook crashes after storing ticket but before email, `emailSent` flag lets retries pick up and send
- **Can't self-pay on MP**: Buyer ≠ seller MP account. Test with incognito + different account
- **Flyer route outside locale**: `/brote/flyer` is excluded from locale middleware in `src/proxy.ts` and has its own layout with html/body tags

### Routing Notes

- `src/proxy.ts` handles locale middleware. Matcher excludes: `_next`, `api`, `brote/flyer`, `favicon.ico`, static files
- The flyer route (`/brote/flyer`) lives outside `[locale]` with a standalone layout
- Dictionary content for BROTE is in `es.ts`/`en.ts` under `brote` and `broteUnArbol` keys
- Types in `src/dictionaries/types.ts`: `BroteDict`, `BroteUnArbolDict`, `BroteLineupItem`, `BroteExperienceItem`
