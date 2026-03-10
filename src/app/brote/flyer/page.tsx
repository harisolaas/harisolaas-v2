"use client";

import { useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toPng } from "html-to-image";

const FORMATS: Record<string, { label: string; w: number; h: number }> = {
  square: { label: "1:1", w: 1080, h: 1080 },
  story: { label: "9:16", w: 1080, h: 1920 },
  landscape: { label: "16:9", w: 1920, h: 1080 },
  post: { label: "4:5", w: 1080, h: 1350 },
};

type Theme = "dark" | "light";
type Variant = "original" | "promo";

const ACTIVITIES = [
  { icon: "🎵", text: "Música en vivo" },
  { icon: "☕", text: "Coffee Rave" },
  { icon: "🎧", text: "DJ Set" },
  { icon: "✨", text: "Café de especialidad" },
];

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
      {/* Background texture layers */}
      <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 30% 20%, ${t.glow1}, transparent 60%)`,
      }} />
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at 80% 80%, ${t.glow2}, transparent 50%)`,
      }} />

      {/* Subtle leaf pattern overlay */}
      <div className={`absolute inset-0 ${t.leafOpacity}`} style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-5 8-15 12-15 22s10 15 15 18c5-3 15-8 15-18S35 18 30 10z' fill='${t.leafFill}' fill-opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: "80px 80px",
      }} />

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
                  Hasta el 14 de marzo
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

function useUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const f = searchParams.get("f");
  const format: keyof typeof FORMATS = f && f in FORMATS ? f : "square";
  const theme: Theme = searchParams.get("t") === "light" ? "light" : "dark";
  const variant: Variant = searchParams.get("v") === "promo" ? "promo" : "original";

  const set = useCallback((updates: Partial<{ f: string; t: string; v: string }>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) params.set(k, v);
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
  const flyerRef = useRef<HTMLDivElement>(null);
  const { w, h } = FORMATS[format];

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
      link.download = `BROTE-${FORMATS[format].label}-${theme}${variant === "promo" ? "-promo" : ""}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [format, theme, variant, w, h, exporting]);

  // Scale to fit viewport
  const maxW = 800;
  const scale = Math.min(maxW / w, (typeof window !== "undefined" ? window.innerHeight * 0.75 : 800) / h);

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
            Promo Early Bird
          </button>
        </div>
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
              <Flyer format={format} theme={theme} variant={variant} />
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
