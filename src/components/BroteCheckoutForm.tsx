"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Script from "next/script";
import { motion, useReducedMotion } from "framer-motion";
import type { BroteCheckoutDict } from "@/dictionaries/types";
import { isValidEmail, isValidWhatsApp } from "@/lib/plant-types";
import { trackCtaClick } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/* Same vintage eco-editorial palette as BroteLanding */
const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const FOREST_60 = "#78855E";
const FOREST_30 = "#BBC2A9";
const BODY = "#5C6B45";
const FOREST_HOVER = "#2E3D1C";
const ERROR = "#A0522D";

const serif: CSSProperties = {
  fontFamily: "var(--font-brote-serif), serif",
  fontWeight: 400,
};
const mono: CSSProperties = { fontFamily: "var(--font-brote-mono), monospace" };

const inputClasses =
  "w-full rounded-[2px] border border-[#BBC2A9]/40 bg-white px-4 py-3 text-[15px] text-[#3E5226] placeholder-[#5C6B45]/30 outline-none transition-colors focus:border-[#3E5226]/50 read-only:bg-[#E0E1D2] read-only:text-[#78855E]";

const labelStyle: CSSProperties = {
  ...mono,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: FOREST_60,
};

const RESEND_COOLDOWN_SECONDS = 60;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

interface BroteCheckoutFormProps {
  dict: BroteCheckoutDict;
  locale: string;
  isEarlyBird: boolean;
  priceDisplay: string;
  priceRaw: number;
  initialName?: string;
  initialEmail?: string;
  initialCode?: string;
}

export default function BroteCheckoutForm({
  dict,
  locale,
  isEarlyBird,
  priceDisplay,
  priceRaw,
  initialName,
  initialEmail,
  initialCode,
}: BroteCheckoutFormProps) {
  const reduce = useReducedMotion();

  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState(initialCode ?? "");

  const [verifToken, setVerifToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  // Address the last code actually went to (normalized). Drives the code
  // step visibility and the "te mandamos un código a X" note, so editing
  // the email never claims a code was sent somewhere it wasn't. Seeded
  // from the magic link, whose code was emailed to initialEmail.
  const [sentToEmail, setSentToEmail] = useState<string | null>(
    initialEmail && initialCode ? normalizeEmail(initialEmail) : null,
  );
  const [sendError, setSendError] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const autoVerifyRan = useRef(false);

  // Meta Pixel dedup id: generated once on mount, fired with the browser
  // InitiateCheckout below and sent with the checkout POST so the server
  // CAPI event dedups against it.
  const [eventId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const isVerified =
    verifToken !== null && verifiedEmail === normalizeEmail(email);
  const showCodeStep = !isVerified && sentToEmail !== null;

  // Meta Pixel — InitiateCheckout fires on checkout-page mount (moved here
  // from the landing CTA). Polls briefly because the pixel script loads async.
  useEffect(() => {
    let fired = false;
    const fire = () => {
      if (fired || !window.fbq) return;
      fired = true;
      window.fbq(
        "track",
        "InitiateCheckout",
        { currency: "ARS", value: priceRaw },
        { eventID: eventId },
      );
    };
    fire();
    if (fired) return;
    const interval = setInterval(() => {
      if (window.fbq) {
        fire();
        clearInterval(interval);
      }
    }, 200);
    const stop = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [eventId, priceRaw]);

  // Magic link from the verification email: auto-verify once, then strip
  // the params so a reload/share doesn't re-run or leak them.
  useEffect(() => {
    if (autoVerifyRan.current || !initialEmail || !initialCode) return;
    autoVerifyRan.current = true;
    void runVerify(initialEmail, initialCode);
    window.history.replaceState(null, "", `/${locale}/brote/checkout`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail, initialCode, locale]);

  // Resend countdown ticker.
  useEffect(() => {
    if (!sentAt) return;
    const tick = () =>
      setSecondsLeft(
        Math.max(
          0,
          RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - sentAt) / 1000),
        ),
      );
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sentAt]);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (verifiedEmail && normalizeEmail(value) !== verifiedEmail) {
      setVerifiedEmail(null);
      setVerifToken(null);
    }
    // Any pending code belongs to the previous address — back to "send".
    if (sentToEmail && normalizeEmail(value) !== sentToEmail) {
      setSentToEmail(null);
      setSentAt(null);
      setCode("");
      setSendError(null);
      setVerifyError(null);
    }
  }

  async function handleSend() {
    if (isSending) return;
    setSendError(null);
    setVerifyError(null);
    if (!isValidEmail(email)) {
      setSendError(dict.errors.emailInvalid);
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/brote/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email, name, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.outcome === "sent") {
        setSentAt(Date.now());
        setSentToEmail(normalizeEmail(email));
        setCode("");
      } else if (data.outcome === "resend_too_soon") {
        setSendError(dict.errors.resendTooSoon);
        // The previous code is still live — show the code step anyway.
        if (!sentToEmail) setSentToEmail(normalizeEmail(email));
        if (!sentAt) setSentAt(Date.now());
      } else if (data.outcome === "hourly_limit") {
        setSendError(dict.errors.hourlyLimit);
      } else {
        setSendError(dict.errors.generic);
      }
    } catch {
      setSendError(dict.errors.generic);
    } finally {
      setIsSending(false);
    }
  }

  async function runVerify(verifEmail: string, verifCode: string) {
    setVerifyError(null);
    setIsVerifying(true);
    try {
      const res = await fetch("/api/brote/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: verifEmail,
          code: verifCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.outcome === "verified" && data.token) {
        setVerifToken(data.token);
        setVerifiedEmail(normalizeEmail(verifEmail));
      } else {
        const map: Record<string, string> = {
          invalid_code: dict.errors.invalidCode,
          expired: dict.errors.expired,
          too_many_attempts: dict.errors.tooManyAttempts,
          not_found: dict.errors.notFound,
        };
        setVerifyError(map[data.outcome as string] ?? dict.errors.generic);
      }
    } catch {
      setVerifyError(dict.errors.generic);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (checkoutLoading) return;
    setCheckoutError(null);

    if (!name.trim()) {
      setCheckoutError(dict.errors.nameRequired);
      return;
    }
    if (!isValidEmail(email)) {
      setCheckoutError(dict.errors.emailInvalid);
      return;
    }
    if (!isValidWhatsApp(whatsapp)) {
      setCheckoutError(dict.errors.phoneInvalid);
      return;
    }
    if (!isVerified || !verifToken) {
      setCheckoutError(dict.form.verifyFirst);
      return;
    }

    setCheckoutLoading(true);
    trackCtaClick("ticket", "/api/brote/checkout", "brote_checkout_pay");

    // Meta cookies for server-side CAPI dedup.
    const cookies = document.cookie.split("; ");
    const fbp = cookies.find((c) => c.startsWith("_fbp="))?.split("=")[1];
    const fbc = cookies.find((c) => c.startsWith("_fbc="))?.split("=")[1];

    try {
      const res = await fetch("/api/brote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          fbp,
          fbc,
          name,
          email,
          phone: whatsapp,
          verificationToken: verifToken,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.error === "verification_required") {
        // Token expired/consumed between verify and pay — back to unverified.
        setVerifToken(null);
        setVerifiedEmail(null);
        setSentAt(null);
        setSentToEmail(null);
        setCode("");
        setCheckoutError(dict.errors.verificationRequired);
        setCheckoutLoading(false);
        return;
      }
      if (res.status === 409) {
        // The copy tells the person to use a different email — unlock the
        // (readOnly-while-verified) input so they actually can. The new
        // address needs its own verification anyway: tokens are
        // email-bound.
        setVerifToken(null);
        setVerifiedEmail(null);
        setSentAt(null);
        setSentToEmail(null);
        setCode("");
        setCheckoutError(dict.errors.duplicateTicket);
        setCheckoutLoading(false);
        return;
      }
      if (data.init_point) {
        window.location.href = data.init_point;
        return;
      }
      setCheckoutError(dict.errors.generic);
      setCheckoutLoading(false);
    } catch {
      setCheckoutError(dict.errors.generic);
      setCheckoutLoading(false);
    }
  }

  const errorText = (msg: string) => (
    <p role="alert" className="m-0 text-[13px]" style={{ ...mono, color: ERROR }}>
      {msg}
    </p>
  );

  return (
    <div className="min-h-screen" style={{ background: PAPER }}>
      {/* Top bar */}
      <header
        className="border-b"
        style={{ borderColor: `${FOREST_30}66` }}
      >
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between px-5 py-4">
          <a
            href={`/${locale}/brote`}
            className="text-[12px] uppercase tracking-[0.2em] transition-opacity hover:opacity-70"
            style={{ ...mono, color: FOREST_60 }}
          >
            {dict.backLink}
          </a>
          <span
            className="text-[14px] font-bold uppercase tracking-[0.3em]"
            style={{ ...mono, color: FOREST }}
          >
            Brote
          </span>
        </div>
      </header>

      <motion.main
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto w-full max-w-[640px] px-5 pb-24 pt-10"
      >
        <p
          className="mb-2 text-[12px] uppercase tracking-[0.25em]"
          style={{ ...mono, color: FOREST_60 }}
        >
          {dict.eyebrow}
        </p>
        <h1
          className="text-[clamp(32px,7vw,44px)] leading-[1.05]"
          style={{ ...serif, color: FOREST }}
        >
          {dict.heading}
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed" style={{ color: BODY }}>
          {dict.subheading}
        </p>

        {/* Event + price summary */}
        <div
          className="mt-8 rounded-[2px] border bg-white/70 p-5"
          style={{ borderColor: `${FOREST_30}66` }}
        >
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]" style={{ ...mono, color: BODY }}>
            <span>{dict.summary.dateValue}</span>
            <span>{dict.summary.timeValue}</span>
            <span>{dict.summary.placeValue}</span>
          </div>
          <div
            className="mt-4 flex items-baseline justify-between border-t pt-4"
            style={{ borderColor: `${FOREST_30}44` }}
          >
            <div>
              <span
                className="block text-[11px] uppercase tracking-[0.2em]"
                style={{ ...mono, color: FOREST_60 }}
              >
                {isEarlyBird ? dict.summary.earlyBirdTag : dict.summary.generalTag}
              </span>
              <span className="text-[11px]" style={{ ...mono, color: FOREST_60 }}>
                {dict.summary.totalLabel}
              </span>
            </div>
            <span className="text-[28px] font-bold" style={{ ...mono, color: FOREST }}>
              {priceDisplay}
            </span>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: FOREST_60 }}>
            🌱 {dict.summary.treeNote}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handlePay} className="mt-8 flex flex-col gap-6">
          <label className="flex flex-col gap-2">
            <span style={labelStyle}>{dict.form.nameLabel}</span>
            <input
              name="buyerName"
              type="text"
              required
              autoComplete="name"
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2">
              <span style={labelStyle}>{dict.form.emailLabel}</span>
              <input
                name="buyerEmail"
                type="email"
                required
                autoComplete="email"
                className={inputClasses}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                readOnly={isVerified}
              />
            </label>
            <span className="text-[12px]" style={{ color: FOREST_60 }}>
              {dict.form.emailHelper}
            </span>

            {isVerified ? (
              <p className="m-0 text-[13px] font-bold" style={{ ...mono, color: FOREST }}>
                {dict.form.verified}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {!showCodeStep && (
                  <button
                    type="button"
                    disabled={isSending || !email.trim() || !name.trim()}
                    onClick={() => void handleSend()}
                    className="self-start rounded-[2px] border px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.2em] transition-colors disabled:opacity-50"
                    style={{
                      ...mono,
                      borderColor: FOREST,
                      color: FOREST,
                      background: "transparent",
                    }}
                  >
                    {isSending ? dict.form.sending : dict.form.sendCode}
                  </button>
                )}

                {showCodeStep && (
                  <>
                    <span className="text-[12px]" style={{ color: FOREST_60 }}>
                      {dict.form.codeSentNote.replace(
                        "{email}",
                        sentToEmail ?? email,
                      )}
                    </span>
                    <label className="flex flex-col gap-2">
                      <span style={labelStyle}>{dict.form.codeLabel}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className={inputClasses}
                        style={{ ...mono, letterSpacing: "0.3em" }}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        disabled={isVerifying || code.trim().length !== 6}
                        onClick={() => void runVerify(email, code)}
                        className="rounded-[2px] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.2em] text-white transition-colors disabled:opacity-50"
                        style={{ ...mono, background: FOREST }}
                      >
                        {isVerifying ? dict.form.verifying : dict.form.verifyButton}
                      </button>
                      <button
                        type="button"
                        disabled={secondsLeft > 0 || isSending}
                        onClick={() => void handleSend()}
                        className="text-[12px] underline transition-opacity disabled:no-underline disabled:opacity-50"
                        style={{ ...mono, color: FOREST_60 }}
                      >
                        {secondsLeft > 0
                          ? dict.form.resendCountdown.replace(
                              "{seconds}",
                              String(secondsLeft),
                            )
                          : dict.form.resend}
                      </button>
                    </div>
                  </>
                )}

                {sendError && errorText(sendError)}
                {verifyError && errorText(verifyError)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2">
              <span style={labelStyle}>{dict.form.phoneLabel}</span>
              <input
                name="buyerWhatsapp"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder={dict.form.phonePlaceholder}
                className={inputClasses}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </label>
            <span className="text-[12px]" style={{ color: FOREST_60 }}>
              {dict.form.phoneHelper}
            </span>
          </div>

          {checkoutError && errorText(checkoutError)}

          <button
            type="submit"
            disabled={!isVerified || checkoutLoading}
            className="cursor-pointer rounded-[2px] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              ...mono,
              background: checkoutLoading ? FOREST_HOVER : FOREST,
              color: PAPER,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.25em",
              padding: "18px 40px",
            }}
          >
            {checkoutLoading ? dict.form.processing : dict.form.payButton}
          </button>
          {!isVerified && (
            <span className="text-[12px]" style={{ ...mono, color: FOREST_60 }}>
              {dict.form.verifyFirst}
            </span>
          )}
        </form>
      </motion.main>

      {/* Meta Pixel (checkout page loads standalone via QR/magic link, so it
          bootstraps its own pixel — same snippet as the landing) */}
      {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');`}
          </Script>
          <Script
            id="meta-pixel-sdk"
            src="https://connect.facebook.net/en_US/fbevents.js"
            strategy="afterInteractive"
            onLoad={() => {
              if (window.fbq) {
                window.fbq("track", "PageView");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
