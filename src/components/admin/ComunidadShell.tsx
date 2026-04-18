"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PanoramaTab from "./PanoramaTab";
import PersonasTab from "./PersonasTab";
import EventosTab from "./EventosTab";
import CampanasTab from "./CampanasTab";

type Tab = "panorama" | "personas" | "eventos" | "campanas";

const TABS: { key: Tab; label: string }[] = [
  { key: "panorama", label: "Panorama" },
  { key: "personas", label: "Personas" },
  { key: "eventos", label: "Eventos" },
  { key: "campanas", label: "Campañas" },
];

export default function ComunidadShell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>(readTabFromHash() ?? "panorama");

  // Keep the URL hash in sync so refreshes + deep links land on the same tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.location.hash = tab;
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const next = readTabFromHash();
      if (next && next !== tab) setTab(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [tab]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-xl text-forest">Comunidad</h1>
            <span className="hidden text-[11px] uppercase tracking-wider text-charcoal/40 md:inline">
              harisolaas
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/links"
              className="text-xs text-charcoal/60 hover:text-forest"
            >
              Enlaces
            </Link>
            <span className="hidden text-xs text-charcoal/40 md:block">
              {email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-full border border-sage/30 px-3 py-1 text-xs text-charcoal/60 transition-colors hover:bg-sage/10"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-sage/20 bg-white/50">
        <div className="mx-auto flex max-w-6xl gap-1 px-4 md:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-forest text-forest"
                  : "border-transparent text-charcoal/40 hover:text-charcoal/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {tab === "panorama" && <PanoramaTab onNavigateEvent={(id) => {
          setTab("eventos");
          // Hacky cross-tab deep-link: stash in sessionStorage so EventosTab
          // picks it up on mount. Good enough for v1.
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("selected-event-id", id);
          }
        }} />}
        {tab === "personas" && <PersonasTab />}
        {tab === "eventos" && <EventosTab />}
        {tab === "campanas" && <CampanasTab />}
      </main>
    </div>
  );
}

function readTabFromHash(): Tab | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace("#", "");
  if (["panorama", "personas", "eventos", "campanas"].includes(h)) {
    return h as Tab;
  }
  return null;
}
