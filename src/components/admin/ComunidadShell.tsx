"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PanoramaTab from "./PanoramaTab";
import PersonasTab from "./PersonasTab";
import EventosTab from "./EventosTab";
import CampanasTab from "./CampanasTab";
import type { AdminRole, AdminScope } from "@/lib/admin-auth";

type Tab = "panorama" | "personas" | "eventos" | "campanas";

const ALL_TABS: { key: Tab; label: string }[] = [
  { key: "panorama", label: "Panorama" },
  { key: "personas", label: "Personas" },
  { key: "eventos", label: "Eventos" },
  { key: "campanas", label: "Campañas" },
];

export default function ComunidadShell({
  email,
  role,
  scope,
}: {
  email: string;
  role: AdminRole;
  scope: AdminScope;
}) {
  // Scoped collaborators see only the Eventos tab — their events list is
  // pre-filtered server-side. All cross-event surfaces (Panorama, Personas,
  // Campañas) 403 in the API, so we also hide them here to match.
  const visibleTabs = useMemo(
    () => (scope === "all" ? ALL_TABS : ALL_TABS.filter((t) => t.key === "eventos")),
    [scope],
  );

  const defaultTab: Tab = scope === "all" ? "panorama" : "eventos";

  // Always start from the default so SSR + first client render match.
  // The URL hash is read in a post-mount effect to avoid a hydration mismatch.
  const [tab, setTab] = useState<Tab>(defaultTab);

  const selectTab = useCallback(
    (next: Tab) => {
      // Guard against deep-linking into a hidden tab (e.g. scoped user
      // with #panorama in the URL).
      if (!visibleTabs.some((t) => t.key === next)) return;
      setTab(next);
      if (typeof window !== "undefined") {
        window.location.hash = next;
      }
    },
    [visibleTabs],
  );

  useEffect(() => {
    const initial = readTabFromHash();
    if (initial && visibleTabs.some((t) => t.key === initial)) setTab(initial);
  }, [visibleTabs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const next = readTabFromHash();
      if (next && next !== tab && visibleTabs.some((t) => t.key === next)) {
        setTab(next);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [tab, visibleTabs]);

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
            {scope === "all" && (
              <Link
                href="/admin/links"
                className="text-xs text-charcoal/60 hover:text-forest"
              >
                Enlaces
              </Link>
            )}
            {role === "owner" && (
              <Link
                href="/admin/access"
                className="text-xs text-charcoal/60 hover:text-forest"
              >
                Acceso
              </Link>
            )}
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

      {visibleTabs.length > 1 && (
        <nav className="border-b border-sage/20 bg-white/50">
          <div className="mx-auto flex max-w-6xl gap-1 px-4 md:px-6">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
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
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {tab === "panorama" && scope === "all" && (
          <PanoramaTab
            onNavigateEvent={(id) => {
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("selected-event-id", id);
              }
              selectTab("eventos");
            }}
          />
        )}
        {tab === "personas" && scope === "all" && <PersonasTab />}
        {tab === "eventos" && <EventosTab canWrite={role !== "viewer"} />}
        {tab === "campanas" && scope === "all" && <CampanasTab />}
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
