"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface CampanasRollup {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  botClicks: number;
  totalSignups: number;
  cvr: number;
}

interface ChannelRollup {
  key: string | null;
  links: number;
  clicks: number;
  signups: number;
  sticky: number;
}

export default function CampanasTab() {
  const [summary, setSummary] = useState<CampanasRollup | null>(null);
  const [byChannel, setByChannel] = useState<ChannelRollup[] | null>(null);
  const [byCampaign, setByCampaign] = useState<ChannelRollup[] | null>(null);
  const [view, setView] = useState<"channel" | "campaign">("channel");

  const refresh = useCallback(async () => {
    const [s, ch, cp] = await Promise.all([
      fetch("/api/admin/campanas").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/links/rollups?by=channel").then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/admin/links/rollups?by=campaign").then((r) =>
        r.ok ? r.json() : null,
      ),
    ]);
    if (s === null) {
      window.location.href = "/admin/login";
      return;
    }
    setSummary(s);
    setByChannel(ch?.rollups ?? []);
    setByCampaign(cp?.rollups ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rollups = view === "channel" ? byChannel : byCampaign;

  return (
    <div className="space-y-6">
      {/* Rollup cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Enlaces"
          value={summary?.totalLinks ?? "…"}
          subtitle={
            summary ? `${summary.activeLinks} activos` : undefined
          }
        />
        <StatCard
          label="Clicks"
          value={summary?.totalClicks ?? "…"}
          subtitle={
            summary && summary.botClicks > 0
              ? `+${summary.botClicks} bots`
              : undefined
          }
        />
        <StatCard
          label="Signups atribuidos"
          value={summary?.totalSignups ?? "…"}
          accent
        />
        <StatCard
          label="CVR global"
          value={summary ? `${summary.cvr}%` : "…"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <button
            onClick={() => setView("channel")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              view === "channel"
                ? "border-forest bg-forest text-cream"
                : "border-sage/30 text-charcoal/60 hover:border-forest/40"
            }`}
          >
            Por canal
          </button>
          <button
            onClick={() => setView("campaign")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              view === "campaign"
                ? "border-forest bg-forest text-cream"
                : "border-sage/30 text-charcoal/60 hover:border-forest/40"
            }`}
          >
            Por campaña
          </button>
        </div>
        <Link
          href="/admin/links"
          className="rounded-full bg-terracotta px-4 py-2 text-xs font-semibold text-cream hover:bg-terracotta/90"
        >
          Administrar enlaces →
        </Link>
      </div>

      {/* Rollup table */}
      {rollups === null ? (
        <p className="text-sm text-charcoal/40">Cargando…</p>
      ) : rollups.length === 0 ? (
        <div className="rounded-xl border border-sage/20 bg-white p-6 text-center text-sm text-charcoal/50">
          Todavía no hay enlaces con esa agrupación.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-sage/10 text-xs uppercase tracking-wider text-charcoal/60">
              <tr>
                <th className="px-4 py-3 text-left">
                  {view === "channel" ? "Canal" : "Campaña"}
                </th>
                <th className="px-4 py-3 text-right">Enlaces</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Signups</th>
                <th className="px-4 py-3 text-right">CVR</th>
                <th className="px-4 py-3 text-right">Permanencia</th>
              </tr>
            </thead>
            <tbody>
              {rollups.map((r) => {
                const cvr =
                  r.clicks > 0 ? (r.signups / r.clicks) * 100 : null;
                const stick =
                  r.signups > 0 ? (r.sticky / r.signups) * 100 : null;
                return (
                  <tr
                    key={r.key ?? "(sin)"}
                    className="border-t border-sage/10 hover:bg-sage/5"
                  >
                    <td className="px-4 py-3 font-medium text-forest">
                      {r.key ?? <span className="text-charcoal/40">(sin)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.links}</td>
                    <td className="px-4 py-3 text-right">{r.clicks}</td>
                    <td className="px-4 py-3 text-right font-semibold text-forest">
                      {r.signups}
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal/70">
                      {cvr == null ? "—" : `${cvr.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal/70">
                      {stick == null ? "—" : `${stick.toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
        {label}
      </p>
      <p
        className={`mt-1 font-serif text-3xl ${accent ? "text-terracotta" : "text-forest"}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-charcoal/50">{subtitle}</p>
      )}
    </div>
  );
}
