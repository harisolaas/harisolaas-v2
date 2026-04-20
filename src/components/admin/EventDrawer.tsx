"use client";

import { useCallback, useEffect, useState } from "react";

interface EventDetail {
  event: {
    id: string;
    name: string;
    type: string;
    series: string | null;
    date: string;
    status: string;
    capacity: number | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  counts: {
    confirmed: number;
    waitlist: number;
    used: number;
    cancelled: number;
    total: number;
  };
  timeline: { day: string; count: number; cumulative: number }[];
  sourceBreakdown: { source: string; count: number }[];
  linkBreakdown: {
    slug: string;
    label: string;
    channel: string;
    count: number;
  }[];
  participants: {
    participationId: string;
    personId: number;
    personName: string;
    personEmail: string | null;
    role: string;
    status: string;
    createdAt: string;
    usedAt: string | null;
    attribution: Record<string, unknown> | null;
    linkSlug: string | null;
  }[];
}

const ATTENDABLE_STATUSES = new Set(["confirmed", "used"]);

export default function EventDrawer({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Track pending toggles so the row can show a subtle "saving…" state
  // without blocking the rest of the list.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}`);
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [eventId]);

  const toggleAttendance = useCallback(
    async (participationId: string, currentStatus: string) => {
      const nextStatus = currentStatus === "used" ? "confirmed" : "used";
      setPending((p) => new Set(p).add(participationId));
      try {
        const res = await fetch(
          `/api/admin/participations/${participationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        if (!res.ok) {
          if (res.status === 401) window.location.href = "/admin/login";
          return;
        }
        await load();
      } finally {
        setPending((p) => {
          const n = new Set(p);
          n.delete(participationId);
          return n;
        });
      }
    },
    [load],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm"
      />
      <aside
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-sage/20 bg-cream shadow-xl"
        role="dialog"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-sage/20 bg-cream/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-charcoal/50">
              Evento
            </p>
            <h2 className="font-serif text-xl text-forest">
              {data?.event.name ?? "—"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-sage/30 px-3 py-1 text-xs text-charcoal/60 hover:bg-sage/10"
          >
            Cerrar
          </button>
        </header>

        {loading || !data ? (
          <p className="p-5 text-sm text-charcoal/40">Cargando…</p>
        ) : (
          <div className="space-y-6 p-5">
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatBox label="Confirmados" value={data.counts.confirmed} />
              <StatBox label="Asistieron" value={data.counts.used} />
              <StatBox label="Espera" value={data.counts.waitlist} />
              <StatBox
                label="Capacidad"
                value={data.event.capacity ?? "—"}
              />
            </div>

            {/* Timeline */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Registros por día
              </p>
              {data.timeline.length === 0 ? (
                <p className="text-sm text-charcoal/40">
                  Todavía no hay registros.
                </p>
              ) : (
                <TimelineChart rows={data.timeline} />
              )}
            </section>

            {/* Source breakdown */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Fuentes
              </p>
              {data.sourceBreakdown.length === 0 ? (
                <p className="text-sm text-charcoal/40">
                  Sin datos de atribución.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {data.sourceBreakdown.map((s) => {
                    const pct =
                      data.counts.confirmed > 0
                        ? (s.count / data.counts.confirmed) * 100
                        : 0;
                    return (
                      <li key={s.source} className="text-sm">
                        <div className="flex items-baseline justify-between text-xs text-charcoal/70">
                          <span>{s.source}</span>
                          <span>
                            {s.count} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-sage/15">
                          <div
                            className="h-full bg-forest/60"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Link breakdown */}
            {data.linkBreakdown.length > 0 && (
              <section className="rounded-xl border border-sage/20 bg-white p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                  Top enlaces
                </p>
                <ul className="space-y-2">
                  {data.linkBreakdown.map((l) => (
                    <li
                      key={l.slug}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/admin/links/${l.slug}`}
                          className="truncate font-medium text-forest hover:underline"
                        >
                          {l.label}
                        </a>
                        <div className="text-[10px] text-charcoal/40">
                          {l.channel} · {l.slug}
                        </div>
                      </div>
                      <span className="font-semibold text-forest">
                        {l.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Participants */}
            <section className="rounded-xl border border-sage/20 bg-white">
              <div className="flex items-baseline justify-between border-b border-sage/10 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                  Participantes ({data.participants.length})
                </p>
                <p className="text-[10px] text-charcoal/40">
                  Asistieron: {data.counts.used}
                </p>
              </div>
              {data.participants.length === 0 ? (
                <p className="px-4 py-6 text-sm text-charcoal/40">
                  Sin participantes.
                </p>
              ) : (
                <ul className="divide-y divide-sage/10">
                  {data.participants.map((p) => {
                    const canToggle = ATTENDABLE_STATUSES.has(p.status);
                    const attended = p.status === "used";
                    const isPending = pending.has(p.participationId);
                    return (
                      <li
                        key={p.participationId}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-forest">
                            {p.personName}
                          </p>
                          <p className="truncate text-[10px] text-charcoal/50">
                            {p.personEmail ?? "—"}
                          </p>
                          {attended && p.usedAt && (
                            <p className="mt-0.5 text-[10px] text-forest/70">
                              Asistió {formatDateTimeArg(p.usedAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {!canToggle && (
                            <span className="text-[11px] uppercase text-charcoal/50">
                              {p.status}
                            </span>
                          )}
                          {canToggle && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleAttendance(p.participationId, p.status)
                              }
                              disabled={isPending}
                              aria-pressed={attended}
                              className={
                                "min-w-[90px] rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition " +
                                (attended
                                  ? "border-forest bg-forest text-cream hover:bg-forest/90"
                                  : "border-sage/40 bg-white text-charcoal/70 hover:border-forest/40 hover:text-forest") +
                                (isPending ? " opacity-50" : "")
                              }
                            >
                              {isPending
                                ? "…"
                                : attended
                                  ? "Asistió"
                                  : "Marcar"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function formatDateTimeArg(iso: string): string {
  // The API returns UTC timestamps; render in ART so operators see the wall
  // clock they were using at the event.
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-sage/20 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/60">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-forest">{value}</p>
    </div>
  );
}

function TimelineChart({ rows }: { rows: EventDetail["timeline"] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <div className="flex h-24 items-end gap-0.5">
        {rows.map((r) => (
          <div
            key={r.day}
            className="relative flex-1 min-w-[3px]"
            title={`${r.day} — ${r.count} (acum ${r.cumulative})`}
          >
            <div
              className="w-full rounded-t bg-forest/60"
              style={{ height: `${Math.max(3, (r.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[10px] text-charcoal/50">
        <span>{rows[0]?.day}</span>
        <span>{rows[rows.length - 1]?.day}</span>
      </div>
    </div>
  );
}
