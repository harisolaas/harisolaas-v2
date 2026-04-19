"use client";

import { useCallback, useEffect, useState } from "react";

interface PanoramaData {
  community: {
    total: number;
    newThisWeek: number;
    newPreviousWeek: number;
    returningThisWeek: number;
    returningPreviousWeek: number;
    reactivationRate: number;
    peopleWithAny: number;
    peopleWithTwoPlus: number;
  };
  activeEvents: {
    id: string;
    name: string;
    type: string;
    series: string | null;
    date: string;
    status: string;
    capacity: number | null;
    confirmed: number;
    waitlist: number;
    velocity7d: number;
    projectedFillDate: string | null;
  }[];
}

export default function PanoramaTab({
  onNavigateEvent,
}: {
  onNavigateEvent: (id: string) => void;
}) {
  const [data, setData] = useState<PanoramaData | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/panorama");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!data) {
    return <p className="text-sm text-charcoal/40">Cargando…</p>;
  }

  const c = data.community;
  const newDelta = pctDelta(c.newThisWeek, c.newPreviousWeek);
  const returningDelta = pctDelta(
    c.returningThisWeek,
    c.returningPreviousWeek,
  );

  return (
    <div className="space-y-8">
      {/* Row 1: durable metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tamaño comunidad" value={c.total} />
        <StatCard
          label="Nuevos (7d)"
          value={c.newThisWeek}
          delta={newDelta}
          subtitle={`vs. ${c.newPreviousWeek} semana anterior`}
        />
        <StatCard
          label="Vuelven (7d)"
          value={c.returningThisWeek}
          delta={returningDelta}
          subtitle={`vs. ${c.returningPreviousWeek} semana anterior`}
        />
        <StatCard
          label="Reactivación"
          value={`${c.reactivationRate}%`}
          subtitle={`${c.peopleWithTwoPlus} de ${c.peopleWithAny} con 2+`}
        />
      </div>

      {/* Row 2: active events */}
      <section>
        <h2 className="mb-3 font-serif text-lg text-forest">
          Eventos activos
        </h2>
        {data.activeEvents.length === 0 ? (
          <p className="rounded-xl border border-sage/20 bg-white p-6 text-sm text-charcoal/50">
            No hay eventos próximos activos.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.activeEvents.map((e) => (
              <ActiveEventCard
                key={e.id}
                event={e}
                onClick={() => onNavigateEvent(e.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  subtitle,
}: {
  label: string;
  value: number | string;
  delta?: DeltaInfo;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-serif text-3xl text-forest">{value}</p>
        {delta && (
          <span
            className={`text-xs font-semibold ${
              delta.direction === "up"
                ? "text-forest"
                : delta.direction === "down"
                  ? "text-terracotta"
                  : "text-charcoal/40"
            }`}
          >
            {delta.display}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-[11px] text-charcoal/50">{subtitle}</p>
      )}
    </div>
  );
}

function ActiveEventCard({
  event,
  onClick,
}: {
  event: PanoramaData["activeEvents"][number];
  onClick: () => void;
}) {
  const fillPct =
    event.capacity != null && event.capacity > 0
      ? Math.min(100, Math.round((event.confirmed / event.capacity) * 100))
      : null;

  const eventDate = new Date(event.date);
  const dateLabel = eventDate.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-sage/20 bg-white p-4 text-left shadow-sm transition-colors hover:border-forest/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-base text-forest">{event.name}</p>
          <p className="text-[11px] text-charcoal/50">{dateLabel}</p>
        </div>
        <span className="rounded-full border border-sage/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-charcoal/60">
          {event.type}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="font-serif text-2xl text-forest">{event.confirmed}</p>
        {event.capacity != null && (
          <p className="text-xs text-charcoal/50">
            de {event.capacity}
            {fillPct != null && ` · ${fillPct}%`}
          </p>
        )}
      </div>

      {event.capacity != null && fillPct != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-sage/15">
          <div
            className="h-full bg-forest transition-all"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      <div className="mt-1 flex items-center justify-between text-[11px] text-charcoal/60">
        <span>{event.velocity7d.toFixed(1)}/día</span>
        {event.projectedFillDate && event.capacity != null && (
          <span>llena ~ {event.projectedFillDate}</span>
        )}
        {event.waitlist > 0 && <span>+{event.waitlist} en espera</span>}
      </div>
    </button>
  );
}

interface DeltaInfo {
  direction: "up" | "down" | "flat";
  display: string;
}

function pctDelta(current: number, previous: number): DeltaInfo {
  if (previous === 0 && current === 0) return { direction: "flat", display: "—" };
  if (previous === 0) return { direction: "up", display: `+${current}` };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return { direction: "flat", display: "≈0%" };
  if (pct > 0)
    return { direction: "up", display: `+${Math.round(pct)}%` };
  return { direction: "down", display: `${Math.round(pct)}%` };
}
