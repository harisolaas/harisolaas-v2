"use client";

import { useState, useRef, useCallback, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import QRCode from "qrcode";

const FORMATS: Record<string, { label: string; w: number; h: number }> = {
  square: { label: "1:1", w: 1080, h: 1080 },
  story: { label: "9:16", w: 1080, h: 1920 },
  landscape: { label: "16:9", w: 1920, h: 1080 },
  post: { label: "4:5", w: 1080, h: 1350 },
};

type Theme = "dark" | "light";
type Variant = "original" | "promo" | "forest" | "qr" | "qr-direct";

const ACTIVITIES = [
  { icon: "🎵", text: "Música en vivo" },
  { icon: "☕", text: "Coffee Rave" },
  { icon: "🎧", text: "DJ Set" },
  { icon: "✨", text: "Café de especialidad" },
];

// --- Tree generation (mirrors TreeCounter.tsx logic, no framer-motion) ---

interface TreeData {
  x: number;
  baseY: number;
  height: number;
  canopyRx: number;
  canopyRy: number;
  lean: number;
  shade: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hillYAt(x: number): number {
  const t = x / 100;
  return 65 - Math.sin(t * Math.PI) * 12;
}

const GREENS = ["#2D4A3E", "#3A5F4F", "#4A7A5E", "#3E6B52", "#4F7D5F", "#5C8A6A"];

function generateTrees(goal: number): TreeData[] {
  const posRand = seededRandom(42);
  const shuffleRand = seededRandom(99);

  const slotTrees: TreeData[] = [];
  for (let i = 0; i < goal; i++) {
    const slot = (i + 0.5) / goal;
    const baseX = 8 + slot * 84;
    const jitter = (posRand() - 0.5) * (60 / goal);
    const x = Math.max(6, Math.min(94, baseX + jitter));
    const baseY = hillYAt(x) + 2;
    const distFromCenter = Math.abs(x - 50) / 50;
    const sizeFactor = 1 - distFromCenter * 0.2;
    const height = (10 + posRand() * 8) * sizeFactor;
    const canopyRx = (2.5 + posRand() * 2) * sizeFactor;
    const canopyRy = (3 + posRand() * 2.5) * sizeFactor;
    const lean = (posRand() - 0.5) * 1.5;
    const shade = GREENS[Math.floor(posRand() * GREENS.length)];
    slotTrees.push({ x, baseY, height, canopyRx, canopyRy, lean, shade });
  }

  const order = Array.from({ length: goal }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(shuffleRand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((slotIdx) => slotTrees[slotIdx]);
}

function StaticTree({ x, baseY, height, canopyRx, canopyRy, lean, shade }: TreeData) {
  const trunkHeight = height * 0.35;
  const trunkWidth = Math.max(1.2, height * 0.055);
  const canopyCy = baseY - trunkHeight - canopyRy * 0.6;

  return (
    <g>
      <rect
        x={x - trunkWidth / 2 + lean * 0.3}
        y={baseY - trunkHeight}
        width={trunkWidth}
        height={trunkHeight}
        rx={0.4}
        fill="#6B4F3A"
      />
      <ellipse
        cx={x + lean}
        cy={canopyCy}
        rx={canopyRx}
        ry={canopyRy}
        fill={shade}
      />
    </g>
  );
}

// --- Theme configs ---

const themes = {
  dark: {
    bg: "bg-[#1a332b]",
    gradient: "from-[#2D4A3E] via-[#1a332b] to-[#2D4A3E]",
    glow1: "rgba(168,181,160,0.15)",
    glow2: "rgba(196,112,75,0.1)",
    leafFill: "%23FAF6F1",
    leafOpacity: "opacity-[0.04]",
    title: "text-[#FAF6F1]/85",
    subtitle: "text-[#FAF6F1]",
    divider: "bg-[#FAF6F1]/25",
    decoLine: "bg-[#A8B5A0]/50",
    pillBorder: "border-[#FAF6F1]/20",
    pillBg: "bg-[#FAF6F1]/[0.08]",
    pillText: "text-[#FAF6F1]",
    accent: "text-[#e8956b]",
    date: "text-[#FAF6F1]",
    time: "text-[#FAF6F1]/70",
    location: "text-[#c8d4c0]",
    promoBg: "bg-[#FAF6F1]/[0.06]",
    promoBorder: "border-[#FAF6F1]/15",
    promoOld: "text-[#FAF6F1]/40",
    promoNew: "text-[#e8956b]",
    promoDeadline: "text-[#FAF6F1]/60",
  },
  light: {
    bg: "bg-[#FAF6F1]",
    gradient: "from-[#FAF6F1] via-[#D4C5B2]/20 to-[#FAF6F1]",
    glow1: "rgba(168,181,160,0.12)",
    glow2: "rgba(196,112,75,0.08)",
    leafFill: "%232D4A3E",
    leafOpacity: "opacity-[0.03]",
    title: "text-[#2D4A3E]/85",
    subtitle: "text-[#2D4A3E]",
    divider: "bg-[#A8B5A0]/40",
    decoLine: "bg-[#D4C5B2]",
    pillBorder: "border-[#D4C5B2]",
    pillBg: "bg-[#D4C5B2]/25",
    pillText: "text-[#2C2C2C]",
    accent: "text-[#C4704B]",
    date: "text-[#2D4A3E]",
    time: "text-[#2C2C2C]/50",
    location: "text-[#2D4A3E]/70",
    promoBg: "bg-[#2D4A3E]/[0.06]",
    promoBorder: "border-[#D4C5B2]",
    promoOld: "text-[#2C2C2C]/35",
    promoNew: "text-[#C4704B]",
    promoDeadline: "text-[#2C2C2C]/50",
  },
};

// --- Background layers (shared between flyers) ---

function BackgroundLayers({ theme }: { theme: Theme }) {
  const t = themes[theme];
  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 30% 20%, ${t.glow1}, transparent 60%)`,
      }} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 80% 80%, ${t.glow2}, transparent 50%)`,
      }} />
      <div className={`absolute inset-0 ${t.leafOpacity}`} style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-5 8-15 12-15 22s10 15 15 18c5-3 15-8 15-18S35 18 30 10z' fill='${t.leafFill}' fill-opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: "80px 80px",
      }} />
    </>
  );
}

// --- Original / Promo Flyer ---

function Flyer({ format, theme, variant }: { format: keyof typeof FORMATS; theme: Theme; variant: Variant }) {
  const { w, h } = FORMATS[format];
  const isVertical = h > w;
  const isStory = format === "story";
  const isLandscape = w > h;
  const t = themes[theme];

  return (
    <div
      id="flyer-canvas"
      style={{ width: w, height: h }}
      className={`relative flex flex-col overflow-hidden ${t.bg}`}
    >
      <BackgroundLayers theme={theme} />

      {/* Content container */}
      <div className={`relative z-10 flex flex-1 flex-col items-center justify-center ${
        isVertical ? "gap-[80px] px-[72px]" : isLandscape ? "gap-[40px] px-[120px]" : "gap-[50px] px-[72px]"
      }`}>

        {/* Top section — branding */}
        <div className="flex flex-col items-center text-center">
          <div className={`mb-6 h-[2px] w-[60px] ${t.decoLine}`} />

          <h1 style={{ fontSize: isStory ? 160 : isVertical ? 140 : isLandscape ? 100 : 120 }}
            className={`font-serif font-bold leading-[0.85] tracking-tight ${t.title}`}>
            BROTE
          </h1>

          <p style={{ fontSize: isStory ? 64 : isVertical ? 52 : 42 }}
            className={`mt-4 font-serif italic tracking-wide ${t.subtitle}`}>
            Fiesta de reforestación
          </p>
        </div>

        {/* Middle — what's happening / promo */}
        <div className={`flex flex-col items-center text-center ${isLandscape ? "gap-4" : "gap-5"}`}>
          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className={`h-[1px] w-[40px] ${t.divider}`} />
            <span style={{ fontSize: isStory ? 48 : 40 }}>🌱</span>
            <div className={`h-[1px] w-[40px] ${t.divider}`} />
          </div>

          {variant === "promo" ? (
            <>
              {/* Promo pricing block */}
              <div
                style={{
                  padding: isStory ? "40px 56px" : isVertical ? "32px 48px" : "24px 40px",
                  borderRadius: isStory ? 24 : 20,
                }}
                className={`flex flex-col items-center gap-2 border ${t.promoBorder} ${t.promoBg}`}
              >
                <p style={{ fontSize: isStory ? 24 : isVertical ? 20 : 16 }}
                  className={`font-semibold uppercase tracking-[0.2em] ${t.accent}`}>
                  Precio early bird
                </p>

                <div className="flex flex-col items-center">
                  <span style={{ fontSize: isStory ? 28 : isVertical ? 24 : 20 }}
                    className={`font-medium line-through ${t.promoOld}`}>
                    $23.313
                  </span>
                  <span style={{ fontSize: isStory ? 72 : isVertical ? 60 : isLandscape ? 48 : 54 }}
                    className={`font-serif font-bold ${t.promoNew}`}>
                    $18.650
                  </span>
                </div>

                <p style={{ fontSize: isStory ? 22 : isVertical ? 18 : 15 }}
                  className={`mt-1 font-medium ${t.promoDeadline}`}>
                  Hasta el 16 de marzo
                </p>
              </div>

              {/* Tree callout */}
              <p style={{ fontSize: isStory ? 26 : isVertical ? 22 : 18 }}
                className={`mt-2 font-semibold tracking-wide ${t.accent}`}>
                Cada entrada planta un árbol real en Argentina
              </p>
            </>
          ) : (
            <>
              {/* Activity pills */}
              <div className={`flex flex-wrap items-center justify-center ${isStory ? "gap-4" : "gap-3"}`}>
                {ACTIVITIES.map((item) => (
                  <div
                    key={item.text}
                    style={{
                      fontSize: isStory ? 28 : isVertical ? 24 : 20,
                      padding: isStory ? "14px 32px" : isVertical ? "12px 28px" : "10px 24px",
                    }}
                    className={`flex items-center gap-3 rounded-full border ${t.pillBorder} ${t.pillBg} ${t.pillText}`}
                  >
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* 1 entrada = 1 árbol callout */}
              <p style={{ fontSize: isStory ? 26 : isVertical ? 22 : 18 }}
                className={`mt-2 font-semibold tracking-wide ${t.accent}`}>
                Cada entrada planta un árbol real en Argentina
              </p>
            </>
          )}
        </div>

        {/* Bottom — when & where */}
        <div className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center">
            <p style={{ fontSize: isStory ? 46 : isVertical ? 38 : isLandscape ? 30 : 34 }}
              className={`font-serif font-bold ${t.date}`}>
              Sábado 28 de marzo
            </p>
            <p style={{ fontSize: isStory ? 30 : isVertical ? 26 : 22 }}
              className={`mt-1 font-medium ${t.time}`}>
              14:00 a 19:00h
            </p>
          </div>

          <div className={`my-4 h-[1px] w-[40px] ${t.divider}`} />

          <p style={{ fontSize: isStory ? 28 : isVertical ? 24 : 20 }}
            className={`font-medium ${t.location}`}>
            Costa Rica 5644, Palermo
          </p>

          <div className={`mt-6 h-[2px] w-[60px] ${t.decoLine}`} />
        </div>
      </div>
    </div>
  );
}

// --- Forest Flyer (with live tree count) ---

const GOAL = 100;

function ForestFlyer({ format, theme, treeCount }: {
  format: keyof typeof FORMATS;
  theme: Theme;
  treeCount: number;
}) {
  const { w, h } = FORMATS[format];
  const isStory = format === "story";
  const isPost = format === "post";
  const isLandscape = format === "landscape";
  const t = themes[theme];
  const isDark = theme === "dark";

  const allTrees = useMemo(() => generateTrees(GOAL), []);
  const count = Math.min(Math.max(0, treeCount), GOAL);
  const visibleTrees = allTrees.slice(0, count).sort((a, b) => a.baseY - b.baseY);
  const progress = (count / GOAL) * 100;

  // Responsive scale factor
  const s = isStory ? 1 : isPost ? 0.85 : isLandscape ? 0.58 : 0.72;

  // Colors
  const accentColor = isDark ? "#e8956b" : "#C4704B";
  const textSecondary = isDark ? "rgba(250,246,241,0.55)" : "rgba(45,74,62,0.55)";
  const progressBg = isDark ? "rgba(250,246,241,0.08)" : "rgba(45,74,62,0.08)";
  const hillColor = isDark ? "#4A6B5A" : "#A8B5A0";
  const progressGradientEnd = isDark ? "#f0b08a" : "#e8956b";

  // Padding
  const px = isLandscape ? 140 : Math.round(70 * s + 24);
  const py = isLandscape ? 60 : Math.round(70 * s + 30);

  // Forest SVG width
  const forestW = isLandscape ? Math.round(w * 0.52) : Math.round(w * 0.88);

  return (
    <div
      id="flyer-canvas"
      style={{ width: w, height: h }}
      className={`relative flex flex-col overflow-hidden ${t.bg}`}
    >
      <BackgroundLayers theme={theme} />

      {/* Extra warm glow behind the forest area */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 50% ${isLandscape ? "60%" : "50%"}, ${isDark ? "rgba(232,149,107,0.06)" : "rgba(168,181,160,0.06)"}, transparent 55%)`,
      }} />

      {/* Content */}
      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-between"
        style={{ padding: `${py}px ${px}px` }}
      >
        {/* Top: Title */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`h-[2px] ${t.decoLine}`}
            style={{ width: Math.round(50 * s), marginBottom: Math.round(16 * s) }}
          />

          <h1
            style={{ fontSize: Math.round(120 * s) }}
            className={`font-serif font-bold leading-[0.85] tracking-tight ${t.title}`}
          >
            BROTE
          </h1>

          <p
            style={{ fontSize: Math.round(44 * s), marginTop: Math.round(10 * s) }}
            className={`font-serif italic tracking-wide ${t.subtitle}`}
          >
            Fiesta de reforestación
          </p>
        </div>

        {/* Middle: Forest + Counter */}
        <div
          className="flex flex-col items-center"
          style={{ gap: Math.round(20 * s) }}
        >
          {/* Message */}
          <p
            style={{ fontSize: Math.round(24 * s), letterSpacing: "0.18em" }}
            className={`font-semibold uppercase ${t.subtitle}`}
          >
            Nuestro bosque crece
          </p>

          {/* Forest SVG */}
          <svg
            viewBox="0 20 100 50"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: forestW }}
          >
            {/* Atmospheric glow behind trees */}
            <defs>
              <radialGradient id="forestGlow" cx="50%" cy="60%" r="40%">
                <stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.12 : 0.06} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect x="0" y="20" width="100" height="50" fill="url(#forestGlow)" />

            {/* Ground hill */}
            <path
              d="M0,65 Q25,56 50,53 Q75,56 100,65 L100,70 L0,70 Z"
              fill={hillColor}
            />

            {/* Trees */}
            {visibleTrees.map((tree) => (
              <StaticTree key={`t-${tree.x.toFixed(2)}`} {...tree} />
            ))}

            {/* Empty state hint */}
            {count === 0 && (
              <text
                x="50"
                y="55"
                textAnchor="middle"
                fill={isDark ? "#FAF6F1" : "#2D4A3E"}
                fontSize="3"
                fontWeight="500"
                opacity={0.3}
              >
                ...
              </text>
            )}
          </svg>

          {/* Counter */}
          <div className="flex flex-col items-center" style={{ gap: Math.round(10 * s) }}>
            <div className="flex items-baseline" style={{ gap: Math.round(10 * s) }}>
              <span
                style={{ fontSize: Math.round(88 * s), color: accentColor }}
                className="font-serif font-bold leading-none"
              >
                {count}
              </span>
              <span
                style={{ fontSize: Math.round(26 * s), color: textSecondary }}
                className="font-medium"
              >
                / {GOAL} árboles
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="overflow-hidden rounded-full"
              style={{
                width: Math.round(forestW * 0.55),
                height: Math.round(8 * s),
                backgroundColor: progressBg,
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${progressGradientEnd})`,
                }}
              />
            </div>
          </div>

          {/* Tagline */}
          <p
            style={{ fontSize: Math.round(22 * s), color: accentColor }}
            className="font-semibold tracking-wide"
          >
            Cada entrada planta un árbol real 🌱
          </p>
        </div>

        {/* Bottom: Event info + CTA */}
        <div
          className="flex flex-col items-center text-center"
          style={{ gap: Math.round(10 * s) }}
        >
          <div
            className="flex items-center"
            style={{ gap: Math.round(12 * s) }}
          >
            <div className={`h-[1px] ${t.divider}`} style={{ width: Math.round(30 * s) }} />
            <span style={{ fontSize: Math.round(20 * s) }}>🌱</span>
            <div className={`h-[1px] ${t.divider}`} style={{ width: Math.round(30 * s) }} />
          </div>

          <p
            style={{ fontSize: Math.round(32 * s) }}
            className={`font-serif font-bold ${t.date}`}
          >
            Sábado 28 de marzo
          </p>

          <p
            style={{ fontSize: Math.round(20 * s) }}
            className={`font-medium ${t.time}`}
          >
            14:00 a 19:00h · Costa Rica 5644, Palermo
          </p>

          <p
            style={{
              fontSize: Math.round(22 * s),
              color: accentColor,
              marginTop: Math.round(6 * s),
              letterSpacing: "0.05em",
            }}
            className="font-semibold"
          >
            harisolaas.com/brote
          </p>

          <div
            className={`h-[2px] ${t.decoLine}`}
            style={{ width: Math.round(50 * s), marginTop: Math.round(4 * s) }}
          />
        </div>
      </div>
    </div>
  );
}

// --- QR Code Flyer ---

const BROTE_LANDING_URL = "https://www.harisolaas.com/es/brote";
const BROTE_CHECKOUT_URL = "https://www.harisolaas.com/api/brote/qr-checkout";

function QRFlyer({ format, theme, direct }: { format: keyof typeof FORMATS; theme: Theme; direct: boolean }) {
  const { w, h } = FORMATS[format];
  const isStory = format === "story";
  const isPost = format === "post";
  const isLandscape = format === "landscape";
  const t = themes[theme];
  const isDark = theme === "dark";

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const qrSize = isStory ? 520 : isPost ? 440 : isLandscape ? 340 : 400;

  useEffect(() => {
    const targetUrl = direct ? BROTE_CHECKOUT_URL : BROTE_LANDING_URL;
    QRCode.toDataURL(targetUrl, {
      width: qrSize * 2,
      margin: 0,
      color: {
        dark: isDark ? "#FAF6F1" : "#2D4A3E",
        light: "#00000000",
      },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(console.error);
  }, [isDark, qrSize, direct]);

  const s = isStory ? 1 : isPost ? 0.85 : isLandscape ? 0.58 : 0.72;
  const accentColor = isDark ? "#e8956b" : "#C4704B";

  const px = isLandscape ? 140 : Math.round(70 * s + 24);
  const py = isLandscape ? 60 : Math.round(70 * s + 30);

  return (
    <div
      id="flyer-canvas"
      style={{ width: w, height: h }}
      className={`relative flex flex-col overflow-hidden ${t.bg}`}
    >
      <BackgroundLayers theme={theme} />

      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-between"
        style={{ padding: `${py}px ${px}px` }}
      >
        {/* Top: Title */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`h-[2px] ${t.decoLine}`}
            style={{ width: Math.round(50 * s), marginBottom: Math.round(16 * s) }}
          />
          <h1
            style={{ fontSize: Math.round(120 * s) }}
            className={`font-serif font-bold leading-[0.85] tracking-tight ${t.title}`}
          >
            BROTE
          </h1>
          <p
            style={{ fontSize: Math.round(44 * s), marginTop: Math.round(10 * s) }}
            className={`font-serif italic tracking-wide ${t.subtitle}`}
          >
            Fiesta de reforestación
          </p>
        </div>

        {/* Middle: QR Code */}
        <div className="flex flex-col items-center" style={{ gap: Math.round(20 * s) }}>
          <p
            style={{ fontSize: Math.round(22 * s), letterSpacing: "0.15em" }}
            className={`font-semibold uppercase ${t.subtitle}`}
          >
            {direct ? "Escaneá y comprá tu entrada" : "Escaneá y conocé más"}
          </p>

          {qrDataUrl && (
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{
                width: qrSize,
                height: qrSize,
                padding: Math.round(24 * s),
                backgroundColor: isDark ? "rgba(250,246,241,0.08)" : "rgba(45,74,62,0.05)",
                border: `2px solid ${isDark ? "rgba(250,246,241,0.12)" : "rgba(45,74,62,0.1)"}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code to BROTE landing page"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          )}

          <p
            style={{ fontSize: Math.round(22 * s), color: accentColor }}
            className="font-semibold tracking-wide"
          >
            Cada entrada planta un árbol real 🌱
          </p>
        </div>

        {/* Bottom: Event info */}
        <div
          className="flex flex-col items-center text-center"
          style={{ gap: Math.round(10 * s) }}
        >
          <div className="flex items-center" style={{ gap: Math.round(12 * s) }}>
            <div className={`h-[1px] ${t.divider}`} style={{ width: Math.round(30 * s) }} />
            <span style={{ fontSize: Math.round(20 * s) }}>🌱</span>
            <div className={`h-[1px] ${t.divider}`} style={{ width: Math.round(30 * s) }} />
          </div>

          <p
            style={{ fontSize: Math.round(32 * s) }}
            className={`font-serif font-bold ${t.date}`}
          >
            Sábado 28 de marzo
          </p>

          <p
            style={{ fontSize: Math.round(20 * s) }}
            className={`font-medium ${t.time}`}
          >
            14:00 a 19:00h · Costa Rica 5644, Palermo
          </p>

          <p
            style={{
              fontSize: Math.round(22 * s),
              color: accentColor,
              marginTop: Math.round(6 * s),
              letterSpacing: "0.05em",
            }}
            className="font-semibold"
          >
            harisolaas.com/brote
          </p>

          <div
            className={`h-[2px] ${t.decoLine}`}
            style={{ width: Math.round(50 * s), marginTop: Math.round(4 * s) }}
          />
        </div>
      </div>
    </div>
  );
}

// --- URL state & page shell ---

function useUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const f = searchParams.get("f");
  const format: keyof typeof FORMATS = f && f in FORMATS ? f : "square";
  const theme: Theme = searchParams.get("t") === "light" ? "light" : "dark";
  const v = searchParams.get("v");
  const variant: Variant = v === "promo" ? "promo" : v === "forest" ? "forest" : v === "qr" ? "qr" : v === "qr-direct" ? "qr-direct" : "original";

  const set = useCallback((updates: Partial<{ f: string; t: string; v: string }>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, val] of Object.entries(updates)) params.set(k, val);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  return { format, theme, variant, set };
}

export default function FlyerPage() {
  return (
    <Suspense>
      <FlyerPageInner />
    </Suspense>
  );
}

function FlyerPageInner() {
  const { format, theme, variant, set } = useUrlState();
  const [exporting, setExporting] = useState(false);
  const [treeCount, setTreeCount] = useState(0);
  const [countOverride, setCountOverride] = useState("");
  const flyerRef = useRef<HTMLDivElement>(null);
  const { w, h } = FORMATS[format];

  // Fetch live tree count
  useEffect(() => {
    fetch("/api/brote/counter")
      .then((r) => r.json())
      .then((d) => setTreeCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  const displayCount = countOverride !== "" ? Math.max(0, parseInt(countOverride) || 0) : treeCount;

  const handleExport = useCallback(async () => {
    if (!flyerRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        width: w,
        height: h,
        pixelRatio: 1,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `BROTE-${FORMATS[format].label}-${theme}${
        variant === "promo" ? "-promo" : variant === "forest" ? "-forest" : ""
      }.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [format, theme, variant, w, h, exporting]);

  // Scale to fit viewport (use state to avoid SSR/client mismatch)
  const [viewportH, setViewportH] = useState(800);
  useEffect(() => {
    setViewportH(window.innerHeight);
  }, []);
  const maxW = 800;
  const scale = Math.min(maxW / w, (viewportH * 0.75) / h);

  return (
    <div className="min-h-screen bg-neutral-900 px-6 py-10">
      {/* Controls */}
      <div className="mx-auto mb-6 flex flex-col items-center gap-4">
        {/* Format selector */}
        <div className="flex items-center gap-3">
          {Object.entries(FORMATS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => set({ f: key })}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                format === key
                  ? "bg-white text-neutral-900"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => set({ t: "dark" })}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              theme === "dark"
                ? "bg-[#2D4A3E] text-[#FAF6F1]"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <span className="inline-block h-3 w-3 rounded-full bg-[#2D4A3E] ring-1 ring-white/30" />
            Oscuro
          </button>
          <button
            onClick={() => set({ t: "light" })}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              theme === "light"
                ? "bg-[#FAF6F1] text-[#2D4A3E]"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            <span className="inline-block h-3 w-3 rounded-full bg-[#FAF6F1] ring-1 ring-white/30" />
            Claro
          </button>
        </div>

        {/* Variant toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => set({ v: "original" })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              variant === "original"
                ? "bg-white text-neutral-900"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => set({ v: "promo" })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              variant === "promo"
                ? "bg-[#e8956b] text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            Promo
          </button>
          <button
            onClick={() => set({ v: "forest" })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              variant === "forest"
                ? "bg-[#A8B5A0] text-[#1a332b]"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            Bosque
          </button>
          <button
            onClick={() => set({ v: "qr" })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              variant === "qr"
                ? "bg-white text-neutral-900"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            QR Landing
          </button>
          <button
            onClick={() => set({ v: "qr-direct" })}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              variant === "qr-direct"
                ? "bg-[#e8956b] text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            QR Compra
          </button>
        </div>

        {/* Tree count control (forest variant) */}
        {variant === "forest" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              API: {treeCount}
            </span>
            <label className="text-sm text-neutral-400">Simular:</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder={String(treeCount)}
              value={countOverride}
              onChange={(e) => setCountOverride(e.target.value)}
              className="w-20 rounded-lg bg-neutral-800 px-3 py-1.5 text-center text-sm text-white outline-none focus:ring-1 focus:ring-white/30"
            />
            {countOverride !== "" && (
              <button
                onClick={() => setCountOverride("")}
                className="text-xs text-neutral-500 hover:text-white"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dimensions label */}
      <p className="mb-4 text-center text-xs text-neutral-500">
        {w} x {h}px
      </p>

      {/* Preview container */}
      <div className="flex justify-center">
        <div
          style={{
            width: w * scale,
            height: h * scale,
          }}
          className="overflow-hidden rounded-lg shadow-2xl"
        >
          <div style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}>
            <div ref={flyerRef}>
              {variant === "forest" ? (
                <ForestFlyer format={format} theme={theme} treeCount={displayCount} />
              ) : variant === "qr" || variant === "qr-direct" ? (
                <QRFlyer format={format} theme={theme} direct={variant === "qr-direct"} />
              ) : (
                <Flyer format={format} theme={theme} variant={variant} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-50"
        >
          {exporting ? "Exportando..." : `Exportar PNG (${w}x${h})`}
        </button>
      </div>
    </div>
  );
}
