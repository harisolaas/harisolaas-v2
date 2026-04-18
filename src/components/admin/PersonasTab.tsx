"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PersonDrawer from "./PersonDrawer";

interface Persona {
  id: number;
  email: string | null;
  name: string;
  firstSeen: string;
  firstTouch: Record<string, unknown> | null;
  tags: string[];
  participations: {
    eventId: string;
    eventName: string;
    eventType: string;
    eventSeries: string | null;
    status: string;
    role: string;
    createdAt: string;
  }[];
  eventSummary: {
    brote: boolean;
    plant: boolean;
    sinergiaCount: number;
  };
}

export default function PersonasTab() {
  const [data, setData] = useState<Persona[] | null>(null);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (eventFilter) params.set("event", eventFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (tagFilter) params.set("tag", tagFilter);
    const res = await fetch(`/api/admin/people?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      return;
    }
    const json = await res.json();
    setData(json.people);
  }, [search, eventFilter, sourceFilter, tagFilter]);

  // Debounced refresh on filter change.
  useEffect(() => {
    const t = setTimeout(() => {
      refresh();
    }, 200);
    return () => clearTimeout(t);
  }, [refresh]);

  const { eventOptions, sourceOptions, tagOptions } = useMemo(() => {
    if (!data) return { eventOptions: [], sourceOptions: [], tagOptions: [] };
    const evt = new Map<string, string>();
    const src = new Set<string>();
    const tags = new Set<string>();
    for (const p of data) {
      for (const part of p.participations) {
        evt.set(part.eventId, part.eventName);
      }
      const ft = p.firstTouch;
      if (ft && typeof ft === "object") {
        const s = (ft as Record<string, unknown>).source;
        if (typeof s === "string" && s.length > 0) src.add(s);
      }
      for (const tag of p.tags) tags.add(tag);
    }
    return {
      eventOptions: Array.from(evt.entries()).sort(),
      sourceOptions: Array.from(src).sort(),
      tagOptions: Array.from(tags).sort(),
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sage/20 bg-white p-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email"
          className="flex-1 min-w-60 rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal placeholder-charcoal/30"
        />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
        >
          <option value="">Todos los eventos</option>
          {eventOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
        >
          <option value="">Todas las fuentes</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
        >
          <option value="">Todas las tags</option>
          {tagOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {data === null ? (
        <p className="text-sm text-charcoal/40">Cargando…</p>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-sage/20 bg-white p-6 text-center text-sm text-charcoal/50">
          Nadie coincide con los filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-sage/10 text-xs uppercase tracking-wider text-charcoal/60">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Eventos</th>
                <th className="px-4 py-3 text-left">Primera fuente</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-left">Primera vez</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t border-sage/10 hover:bg-sage/5"
                  onClick={() => setOpenId(p.id)}
                >
                  <td className="px-4 py-3 font-medium text-forest">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-charcoal/70">
                    {p.email ?? <span className="text-charcoal/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <EventChips summary={p.eventSummary} />
                  </td>
                  <td className="px-4 py-3 text-charcoal/70">
                    {formatFirstTouch(p.firstTouch)}
                  </td>
                  <td className="px-4 py-3">
                    {p.tags.length === 0 ? (
                      <span className="text-charcoal/30">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-tan/40 px-2 py-0.5 text-[10px] text-charcoal/70"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-charcoal/50">
                    {p.firstSeen.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-charcoal/40">
        {data?.length ?? 0} personas
      </p>

      {openId !== null && (
        <PersonDrawer
          personId={openId}
          onClose={() => setOpenId(null)}
          onMutated={refresh}
        />
      )}
    </div>
  );
}

function EventChips({ summary }: { summary: Persona["eventSummary"] }) {
  const chips: string[] = [];
  if (summary.brote) chips.push("BROTE");
  if (summary.plant) chips.push("Plantación");
  if (summary.sinergiaCount > 0) {
    chips.push(
      summary.sinergiaCount === 1
        ? "Sinergia"
        : `Sinergia ×${summary.sinergiaCount}`,
    );
  }
  if (chips.length === 0) return <span className="text-charcoal/30">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-sage/30 px-2 py-0.5 text-[10px] text-charcoal/70"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function formatFirstTouch(ft: Record<string, unknown> | null): string {
  if (!ft) return "—";
  const source = (ft.source as string | undefined) ?? null;
  const medium = (ft.medium as string | undefined) ?? null;
  const campaign = (ft.campaign as string | undefined) ?? null;
  if (!source && !medium && !campaign) return "—";
  const parts = [source, medium, campaign].filter(Boolean);
  return parts.join(" · ");
}
