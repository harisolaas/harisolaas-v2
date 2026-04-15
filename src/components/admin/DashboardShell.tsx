"use client";

import { useState, useEffect, useCallback } from "react";
import MetricCard from "./MetricCard";
import ProgressBar from "./ProgressBar";
import RegistrationTimeline from "./RegistrationTimeline";
import GroupBreakdown from "./GroupBreakdown";
import UtmFunnel from "./UtmFunnel";

/* ─── Types ─── */

interface Metrics {
  community: {
    totalPeople: number;
    returningCount: number;
    newCount: number;
    retentionRate: number;
  };
  plantation: {
    registrations: number;
    capacity: number;
    remaining: number;
    timeline: { date: string; count: number; cumulative: number }[];
    groupBreakdown: { solo: number; conAlguien: number; grupo: number };
    carpoolOffers: number;
    messagesCount: number;
    messagesRate: number;
    waitlistCount: number;
    utmBreakdown: { source: string; count: number }[];
    projectedFillDate: string | null;
  };
  brote: {
    ticketsSold: number;
    gateEntries: number;
    attendanceRate: number;
    coffeeRedemptions: number;
    coffeeRate: number;
  };
  funnel: {
    campaigns: {
      email1: { sent: number; registrations: number };
      email2: { sent: number; registrations: number };
    };
    organic: number;
    otherSources: { source: string; count: number }[];
  };
  health: {
    messageEngagementRate: number;
    avgDaysBroteToPlant: number | null;
    projectedFillDate: string | null;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Registration { [key: string]: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Person { [key: string]: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Ticket { [key: string]: any }

type Tab = "overview" | "registrations" | "community" | "brote";

/* ─── Tabs config ─── */

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registros" },
  { key: "community", label: "Comunidad" },
  { key: "brote", label: "BROTE" },
];

/* ─── Main component ─── */

export default function DashboardShell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch helpers
  const fetchJson = useCallback(async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      return null;
    }
    return res.json();
  }, []);

  const refreshMetrics = useCallback(async () => {
    const data = await fetchJson("/api/admin/metrics");
    if (data) {
      setMetrics(data);
      setLastRefresh(new Date());
    }
  }, [fetchJson]);

  // Initial load + auto-refresh every 60s
  useEffect(() => {
    refreshMetrics();
    const t = setInterval(refreshMetrics, 60000);
    return () => clearInterval(t);
  }, [refreshMetrics]);

  // Lazy-load tab data
  useEffect(() => {
    if (tab === "registrations" && !registrations) {
      fetchJson("/api/admin/registrations").then(
        (d) => d && setRegistrations(d.registrations),
      );
    }
    if (tab === "community" && !people) {
      fetchJson("/api/admin/community").then(
        (d) => d && setPeople(d.people),
      );
    }
    if (tab === "brote" && !tickets) {
      fetchJson("/api/admin/tickets").then(
        (d) => d && setTickets(d.tickets),
      );
    }
  }, [tab, registrations, people, tickets, fetchJson]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const handleExportCsv = async () => {
    const res = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export-csv" }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="font-serif text-xl text-forest">BROTE Admin</h1>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-charcoal/40 md:block">
              {email}
            </span>
            <span className="text-[10px] text-charcoal/30">
              {lastRefresh.toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
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

      {/* Tabs */}
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

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {!metrics ? (
          <p className="text-center text-sm text-charcoal/40">Cargando...</p>
        ) : tab === "overview" ? (
          <OverviewContent
            m={metrics}
            onExportCsv={handleExportCsv}
          />
        ) : tab === "registrations" ? (
          <RegistrationsContent data={registrations} />
        ) : tab === "community" ? (
          <CommunityContent data={people} />
        ) : (
          <BroteContent data={tickets} m={metrics} />
        )}
      </main>
    </div>
  );
}

/* ─── Overview tab ─── */

function OverviewContent({
  m,
  onExportCsv,
}: {
  m: Metrics;
  onExportCsv: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Comunidad" value={m.community.totalPeople} subtitle="personas únicas" />
        <MetricCard
          label="Retención BROTE → Plantación"
          value={`${m.community.retentionRate}%`}
          subtitle={`${m.community.returningCount} vuelven`}
        />
        <MetricCard
          label="Lugares restantes"
          value={m.plantation.remaining}
          subtitle={`de ${m.plantation.capacity}`}
          accent={m.plantation.remaining <= 10}
        />
        <MetricCard
          label="En lista de espera"
          value={m.plantation.waitlistCount}
        />
      </div>

      {/* Plantation progress */}
      <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-forest">Registros plantación</h3>
          <button
            onClick={onExportCsv}
            className="rounded border border-sage/30 px-2.5 py-1 text-[11px] text-charcoal/50 hover:bg-sage/10"
          >
            Exportar CSV
          </button>
        </div>
        <div className="mt-3">
          <ProgressBar
            current={m.plantation.registrations}
            max={m.plantation.capacity}
            label={`${Math.round((m.plantation.registrations / m.plantation.capacity) * 100)}% lleno`}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-forest">Registros por día</h3>
          <div className="mt-3">
            <RegistrationTimeline
              data={m.plantation.timeline}
              capacity={m.plantation.capacity}
            />
          </div>
        </div>

        <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-forest">Tipo de grupo</h3>
          <div className="mt-3">
            <GroupBreakdown {...m.plantation.groupBreakdown} />
          </div>
        </div>
      </div>

      {/* Funnel + health */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-forest">Fuentes de registros</h3>
          <div className="mt-3">
            <UtmFunnel
              data={m.plantation.utmBreakdown}
              organic={m.funnel.organic}
            />
          </div>
        </div>

        <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-forest">Salud comunitaria</h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Carpools ofrecidos"
              value={m.plantation.carpoolOffers}
            />
            <MetricCard
              label="Mensajes de aliento"
              value={`${m.plantation.messagesRate}%`}
              subtitle={`${m.plantation.messagesCount} de ${m.plantation.registrations}`}
            />
            <MetricCard
              label="Días promedio BROTE → Plantación"
              value={m.health.avgDaysBroteToPlant ?? "—"}
            />
            <MetricCard
              label="Fecha proyectada para llenar"
              value={m.health.projectedFillDate ?? "—"}
            />
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CampaignCard
          name="Email 1 — Si le tenés miedo a la pala"
          sent={m.funnel.campaigns.email1.sent}
          attributed={m.funnel.campaigns.email1.registrations}
        />
        <CampaignCard
          name="Email 2 — Quedan X lugares"
          sent={m.funnel.campaigns.email2.sent}
          attributed={m.funnel.campaigns.email2.registrations}
        />
      </div>

      {/* BROTE recap */}
      <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-forest">BROTE — 28 de marzo (recap)</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Entradas vendidas" value={m.brote.ticketsSold} />
          <MetricCard
            label="Asistencia"
            value={`${m.brote.attendanceRate}%`}
            subtitle={`${m.brote.gateEntries} ingresaron`}
          />
          <MetricCard
            label="Café canjeado"
            value={`${m.brote.coffeeRate}%`}
            subtitle={`${m.brote.coffeeRedemptions} de ${m.brote.gateEntries}`}
          />
          <MetricCard
            label="Vuelven a la plantación"
            value={m.community.returningCount}
            subtitle={`de ${m.brote.ticketsSold} compradores`}
          />
        </div>
      </div>
    </div>
  );
}

function CampaignCard({
  name,
  sent,
  attributed,
}: {
  name: string;
  sent: number;
  attributed: number;
}) {
  const rate =
    sent > 0 ? `${Math.round((attributed / sent) * 1000) / 10}%` : "—";
  return (
    <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">
        {name}
      </p>
      <div className="mt-2 flex gap-6">
        <div>
          <p className="text-xl font-bold text-forest">{sent}</p>
          <p className="text-[10px] text-charcoal/40">enviados</p>
        </div>
        <div>
          <p className="text-xl font-bold text-terracotta">{attributed}</p>
          <p className="text-[10px] text-charcoal/40">registros</p>
        </div>
        <div>
          <p className="text-xl font-bold text-charcoal/60">{rate}</p>
          <p className="text-[10px] text-charcoal/40">conversión</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Registrations tab ─── */

function RegistrationsContent({ data }: { data: Registration[] | null }) {
  const [search, setSearch] = useState("");

  if (!data) return <p className="text-center text-sm text-charcoal/40">Cargando...</p>;

  const filtered = data.filter(
    (r) =>
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar por nombre o email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-lg border border-sage/30 bg-white px-4 py-2 text-sm outline-none focus:border-forest/40 md:max-w-xs"
      />
      <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sage/15 text-xs uppercase tracking-wider text-charcoal/40">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">Carpool</th>
              <th className="px-4 py-3">Mensaje</th>
              <th className="px-4 py-3">Fuente</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-sage/10 last:border-0 hover:bg-sage/5"
              >
                <td className="px-4 py-3 font-medium text-forest">
                  {r.name}
                </td>
                <td className="px-4 py-3 text-charcoal/60">{r.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.groupType === "solo"
                        ? "bg-forest/10 text-forest"
                        : r.groupType === "con-alguien"
                          ? "bg-terracotta/10 text-terracotta"
                          : "bg-sage/20 text-charcoal/70"
                    }`}
                  >
                    {r.groupType}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {r.carpool ? "🚗" : ""}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-xs text-charcoal/50">
                  {r.message || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-charcoal/50">
                  {r.utm?.campaign || "orgánico"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal/40">
                  {r.createdAt?.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Community tab ─── */

function CommunityContent({ data }: { data: Person[] | null }) {
  if (!data) return <p className="text-center text-sm text-charcoal/40">Cargando...</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-sage/15 text-xs uppercase tracking-wider text-charcoal/40">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Eventos</th>
            <th className="px-4 py-3">Primera vez</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr
              key={p.email}
              className="border-b border-sage/10 last:border-0 hover:bg-sage/5"
            >
              <td className="px-4 py-3 font-medium text-forest">{p.name}</td>
              <td className="px-4 py-3 text-charcoal/60">{p.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {p.hasBrote && (
                    <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                      BROTE
                    </span>
                  )}
                  {p.hasPlant && (
                    <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-semibold text-charcoal/70">
                      Plantación
                    </span>
                  )}
                  {p.hasSinergia && (
                    <span
                      title={p.lastSinergia ? `Última: ${p.lastSinergia}` : undefined}
                      className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest"
                    >
                      Sinergia{p.sinergiaCount > 1 ? ` ×${p.sinergiaCount}` : ""}
                    </span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal/40">
                {p.firstSeen?.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── BROTE tab ─── */

function BroteContent({
  data,
  m,
}: {
  data: Ticket[] | null;
  m: Metrics;
}) {
  if (!data) return <p className="text-center text-sm text-charcoal/40">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Entradas vendidas" value={m.brote.ticketsSold} />
        <MetricCard
          label="Asistencia"
          value={`${m.brote.attendanceRate}%`}
          subtitle={`${m.brote.gateEntries} ingresaron`}
        />
        <MetricCard
          label="Café canjeado"
          value={`${m.brote.coffeeRate}%`}
          subtitle={`${m.brote.coffeeRedemptions} de ${m.brote.gateEntries}`}
        />
        <MetricCard
          label="Vuelven a plantar"
          value={m.community.returningCount}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sage/15 text-xs uppercase tracking-wider text-charcoal/40">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Café</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr
                key={t.id}
                className="border-b border-sage/10 last:border-0 hover:bg-sage/5"
              >
                <td className="px-4 py-3 font-mono text-xs text-charcoal/50">
                  {t.id}
                </td>
                <td className="px-4 py-3 font-medium text-forest">
                  {t.buyerName}
                </td>
                <td className="px-4 py-3 text-charcoal/60">{t.buyerEmail}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.status === "used"
                        ? "bg-forest/10 text-forest"
                        : "bg-sage/20 text-charcoal/50"
                    }`}
                  >
                    {t.status === "used" ? "Ingresó" : "No vino"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {t.coffeeRedeemed ? "☕" : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal/40">
                  {t.createdAt?.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
