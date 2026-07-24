# BROTE verified-email checkout (port from avivarte)

## Context

BROTE ticket sales currently send buyers straight to Mercado Pago with no identity capture. The webhook resolves the buyer email from `payment.payer.email` — the email on the buyer's **MP account**, which is often a throwaway. Tickets (QR emails) therefore sometimes go to an inbox the buyer never reads, and if `payer.email` is empty the ticket silently isn't delivered.

Fix: port avivarte's battle-tested email-verification checkout (`/Users/haraldsolaas/code/avivarte/avivarte-app`) into harisolaas-v2, adding a pre-payment checkout page where the buyer enters name + email (verified via 6-digit code) + WhatsApp before being redirected to MP. The verified email then flows through the existing Redis stash → `resolveBuyerInfo` path, which **already prefers stash email over `payment.payer.email`** (`src/lib/mp-buyer-info.ts:126-129`) — the resolver needs no changes, only real stash readers wired in.

No new MP credentials needed: same `MP_ACCESS_TOKEN` Checkout Pro preference, just with a `payer: { name, email }` added (sinergia-parrafo already does this).

User decisions (confirmed):
- Flyer QR (`/api/brote/qr-checkout`) routes through the checkout page too — no unverified bypass remains.
- One ticket per email stays: checkout pre-checks the email and blocks with friendly copy; webhook gets an admin alert as safety net.
- unarbol / brote-cima discount variants stay disabled and out of scope.

## Implementation steps

### 1. DB: `email_verifications` table
**Modify `src/db/schema.ts`** — port avivarte's table (`avivarte-app/db/schema.ts:142-171`) adapted to v2 conventions (`bigserial` PK):
- `email` text (normalized-lowercase CHECK, not citext — lib normalizes), `codeHash` (SHA-256, never the raw code), `token` (unique, `randomBytes(16).base64url`), `attempts` int default 0, `status` text default `'pending'` with CHECK (`pending|verified|consumed|superseded`), `expiresAt`/`createdAt`/`verifiedAt`/`consumedAt` timestamptz.
- **Partial unique index** `email_verifications_pending_email_uniq ON (email) WHERE status = 'pending'` — at most one live pending row per email.
- Run `npm run db:generate` → new migration in `src/db/migrations/`.
- **Manual prod migration step** (Vercel doesn't run drizzle migrations) — apply the SQL to prod Neon after merge, before code serves traffic. Call out in PR.

Postgres over Redis on purpose: atomic conditional-UPDATE attempt counting and single-use token consumption are race-free in one SQL statement; ported code comes with an executable test spec; v2 already moved identity data Redis→Postgres.

### 2. Verification lib + email template
**Create `src/lib/email-verification-server.ts`** — port `avivarte-app/lib/email-verification-server.ts`:
- `requestEmailVerification(email, name, locale)` — hourly cap (5/h), 60s resend cooldown, supersede previous pending, insert hashed 6-digit code. Dev mode: `console.log` the code instead of emailing. If Resend throws, delete the row (don't burn quota).
- `verifyEmailCode(email, code)` — single atomic UPDATE: increments `attempts`, flips to `verified` only on hash match, guarded by `pending AND attempts < 5 AND not expired`. Returns opaque `token`. Typed outcomes: `invalid_code|expired|too_many_attempts|not_found`.
- `consumeEmailVerification(token, email)` — atomic single-use consume, 30-min validity window.
- Constants unchanged: 10min code TTL, 5 attempts, 60s resend, 5 sends/hour, 30min token validity.

**Create `src/lib/brote-verification-email.ts`** — adapted from `avivarte-app/emails/verification-code.ts`, styled after `src/lib/brote-email.ts` (BROTE palette: #FAF6F1 paper / #2D4A3E forest / #C4704B terracotta). Big code block + magic link to `/{locale}/brote/checkout?verifEmail=…&verifCode=…&verifName=…`. Bilingual (es voseo, gender-agnostic per CLAUDE.md; en mirror). Lazy Resend instantiation like the webhook.

### 3. Checkout page + form
**Create `src/app/[locale]/brote/checkout/page.tsx`** — server component modeled on `brote/page.tsx`: brote fonts, `getDictionary(locale)`, event summary from `broteConfig` (early-bird resolved like the landing), noindex. Reads magic-link searchParams and passes to the form.

**Create `src/components/BroteCheckoutForm.tsx`** — client component; port the state machine from `avivarte-app/components/CheckoutForm.tsx`:
- Fields: **name (required), email (required + verified), WhatsApp (required, `isValidWhatsApp` from `@/lib/plant-types`, helper copy under input)** — per CLAUDE.md registration-landing convention.
- States: email entry → "Enviar código" → 6-digit input with 60s resend countdown → "Email verificado ✓" (email input locks; editing email invalidates verification) → "Ir a pagar".
- Magic-link autofill effect + `history.replaceState` to strip params.
- Calls the API routes via fetch (not server actions — repo has zero, all flows are route handlers). Maps typed outcomes to dict strings.
- Final submit → `POST /api/brote/checkout` with `{ eventId, fbp, fbc, name, email, phone, verificationToken, locale }` → `window.location.href = init_point`. On `verification_required` (403), reset to unverified state.
- Meta Pixel `InitiateCheckout` fires on checkout-page mount (generate `eventId = crypto.randomUUID()`, hold in state, send with the POST so server CAPI dedups as today).
- Styling: brote visual system from `BroteLanding.tsx`.

**i18n:** add `broteCheckout` to `src/dictionaries/es.ts` / `en.ts` + `BroteCheckoutDict` in `src/dictionaries/types.ts`.

### 4. API routes
**Create `src/app/api/brote/verify-email/route.ts`** — POST with `action` discriminator (unarbol-route pattern):
- `{ action: "send", email, name, locale }` → `isValidEmail` → `requestEmailVerification` → `{ ok, outcome }`.
- `{ action: "verify", email, code }` → `verifyEmailCode` → `{ ok, outcome, token? }`.
- Same in-process IP rate limiter as sibling routes.

**Modify `src/app/api/brote/checkout/route.ts`** (mirror `src/app/api/sinergia-parrafo/checkout/route.ts`):
1. Validate `name`, `isValidEmail(email)`, `isValidWhatsApp(phone)` → 400.
2. **Duplicate-ticket pre-check**: if a participation already exists for this email + `BROTE_EVENT_ID`, return 409 with friendly copy ("esa dirección ya tiene entrada — usá el email de quien va a asistir").
3. `consumeEmailVerification(verificationToken, email)` after field validation, before preference creation → 403 `{ error: "verification_required" }` on failure.
4. Preference gains `payer: { name, email }`, locale-aware `back_urls`, and `metadata: { type: "ticket", buyer_email, buyer_name }` (durable fallback if Redis stash expires — MP propagates preference metadata onto the Payment).
5. Redis stash: `brote:checkout:{preferenceId}` extended with `{ name, email, phone, locale }` + second key `brote:checkout-by-email:{email.toLowerCase()}`, both 24h TTL (mirror sinergia-parrafo:149-176).

**Modify `src/app/api/brote/qr-checkout/route.ts`** — GET becomes `302 → /es/brote/checkout?src=qr` (no more direct preference creation).

### 5. Webhook
**Modify `src/app/api/brote/webhook/route.ts`**:
- Replace no-op stash readers (lines 164-167) with real readers for `brote:checkout:{preferenceId}` / `brote:checkout-by-email:{email}` (mirror `sinergia-parrafo/webhook/route.ts` `stashHolder` pattern). The existing attribution/CAPI block can read off the captured stash instead of a second `redis.get`.
- Pass `phone: buyerInfo.phone` into `recordParticipation`.
- **Fix latent bug**: use `recordParticipation`'s returned `participationId` for the Redis idempotency mapping / metadata / QR email instead of the locally generated `ticketId` (currently, a no-op insert on duplicate email emails a nonexistent BROTE2- id). When `created === false && promoted === false` on a new `mpPaymentId`, alert via `src/lib/admin-alert.ts` (money received, no new ticket).

### 6. Landing entry point
**Modify `src/components/BroteLanding.tsx` `handleCheckout()` (~line 355)** — replace fetch-and-redirect with navigation to `/${locale}/brote/checkout` (keep `trackCtaClick`; drop pixel InitiateCheckout / eventId / cookie reads — moved to the checkout form).

### 7. Tests, seeding, verification
- **Create `src/lib/email-verification-server.test.ts`** — port avivarte's test file (executable spec: pending row + hashed code, normalization, resend throttle, hourly cap, supersede, atomic attempts, expiry, single-use consume + 30min window + email binding). Adapt to v2 harness (vitest vs real dev Neon branch, `maxWorkers: 1`, prefix-cleanup pattern from `community.test.ts`; `vi.mock` the verification-email module).
- Optionally add a `mp-buyer-info.test.ts` case asserting stash email beats payer email.
- **Extend `scripts/seed-preview.ts`** (required per CLAUDE.md): `email_verifications` rows in each state (pending-near-expiry, verified-with-usable-token, consumed, superseded) with production-realistic values.
- **Dev E2E**: `npm run dev` → `/es/brote` → CTA lands on checkout → code prints in server console (dev mode) → verify → MP sandbox → webhook/admin-resend shows ticket email to the typed address. Check resend cooldown, wrong-code error, 6th-attempt lockout, expired-token reset, duplicate-email 409, `/en` locale, qr-checkout redirect.
- PR notes: manual prod migration; webhook must parse pre-deploy in-flight stashes defensively (old shape lacks name/email/phone).

## Edge cases handled
- Concurrent sends: partial unique index guarantees ≤1 pending; rare double-send race 500s one request (avivarte-accepted).
- MP 5xx after token consume: buyer re-verifies (safe; reverse order would leak unconsumed tokens).
- Webhook retries: unchanged Redis idempotency; email-retry path reads identity from DB, immune to stash TTL.
- Stash miss on missing `preference_id` + different payer email: preference `metadata.buyer_email` is the durable fallback.

## Out of scope
- unarbol / brote-cima discount variants (disabled; when reactivated, route to `/brote/checkout?code=…`).
- Multi-ticket purchases per email.
- Localizing the ticket email itself (`brote-email.ts` stays es-only).
