"use client";

import { useCallback, useEffect, useState } from "react";
import EventDrawer from "./EventDrawer";

interface EventRow {
  id: string;
  name: string;
  type: string;
  series: string | null;
  date: string;
  status: string;
  capacity: number | null;
  confirmed: number;
  waitlist: number;
  used: number;
  signupsLast7d: number;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "upcoming", label: "Próximos" },
  { key: "live", label: "En vivo" },
  { key: "past", label: "Pasados" },
  { key: "cancelled", label: "Cancelados" },
];

export default function EventosTab() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/admin/events?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      return;
    }
    const d = await res.json();
    setEvents(d.events);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pick up cross-tab deep-link from Panorama.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = window.sessionStorage.getItem("selected-event-id");
    if (pending) {
      setOpenId(pending);
      window.sessionStorage.removeItem("selected-event-id");
    }
  }, []);

  const typeOptions = Array.from(new Set((events ?? []).map((e) => e.type)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sage/20 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key || "all"}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "border-forest bg-forest text-cream"
                  : "border-sage/30 text-charcoal/60 hover:border-forest/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
        >
          <option value="">Todos los tipos</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {events === null ? (
        <p className="text-sm text-charcoal/40">Cargando…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-sage/20 bg-white p-6 text-center text-sm text-charcoal/50">
          No hay eventos para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-sage/10 text-xs uppercase tracking-wider text-charcoal/60">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Registrados</th>
                <th className="px-4 py-3 text-right">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const attendance =
                  e.confirmed > 0
                    ? Math.round((e.used / e.confirmed) * 100)
                    : null;
                return (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-t border-sage/10 hover:bg-sage/5"
                    onClick={() => setOpenId(e.id)}
                  >
                    <td className="px-4 py-3 font-medium text-forest">
                      {e.name}
                      <div className="text-[10px] font-normal text-charcoal/40">
                        {e.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-charcoal/70">
                      {e.date.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-sage/30 px-2 py-0.5 text-[11px] text-charcoal/70">
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal/80">
                      <span className="font-semibold">{e.confirmed}</span>
                      {e.capacity != null && (
                        <span className="text-charcoal/50"> / {e.capacity}</span>
                      )}
                      {e.waitlist > 0 && (
                        <span className="ml-1 text-[10px] text-charcoal/50">
                          +{e.waitlist}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal/70">
                      {attendance == null ? "—" : `${attendance}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <EventDrawer
          eventId={openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "upcoming"
      ? "bg-sage/20 text-forest"
      : status === "live"
        ? "bg-terracotta/20 text-terracotta"
        : status === "past"
          ? "bg-tan/40 text-charcoal/60"
          : "bg-sage/10 text-charcoal/50";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
