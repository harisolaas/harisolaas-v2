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
    priceCents: number | null;
    currency: string | null;
    metadata: Record<string, unknown>;
  }[];
  contributions: {
    currency: string;
    contributors: number;
    totalCents: number;
    avgCents: number;
    maxCents: number;
  }[];
}

// Statuses where it makes sense to toggle attendance from the drawer.
// `no_show` is included so operators can reverse a mistake. Waitlist,
// cancelled, and pending are excluded — you wouldn't mark someone
// attended if they weren't confirmed in the first place.
const ATTENDABLE_STATUSES = new Set(["confirmed", "used", "no_show"]);

// Statuses that count as "still on the guest list" — the same
// population used by the headline `confirmed` count and by every
// metadata-derived aggregate (Sinergia "Cena", contributions panel).
// Per-row metadata badges (e.g. "Se queda a cenar") gate on this so
// they don't show on cancelled / waitlist rows where the answer is
// either irrelevant or not actionable.
const ACTIVE_RSVP_STATUSES = new Set(["confirmed", "used"]);

export default function EventDrawer({
  eventId,
  canWrite = true,
  onClose,
}: {
  eventId: string;
  canWrite?: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Track pending toggles so the row can show a subtle "saving…" state
  // without blocking the rest of the list.
  const [pending, setPending] = useState<Set<string>>(new Set());
  // Per-row error message, cleared on next successful toggle or close.
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Track which rows have their JSON dump expanded so we can avoid
  // running JSON.stringify on every row on every render — only
  // expanded rows pay the cost.
  const [expandedJson, setExpandedJson] = useState<Set<string>>(new Set());

  // Shared write helper for the row-level actions (attendance toggle,
  // cancel/uncancel, hard delete). Manages the per-row pending flag and
  // error state so each button site can stay focused on its happy path.
  const runRowAction = useCallback(
    async (
      participationId: string,
      action: () => Promise<Response>,
    ): Promise<boolean> => {
      setPending((p) => new Set(p).add(participationId));
      setErrors((e) => {
        if (!e[participationId]) return e;
        const n = { ...e };
        delete n[participationId];
        return n;
      });
      try {
        const res = await action();
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/admin/login";
            return false;
          }
          setErrors((e) => ({
            ...e,
            [participationId]: `No se pudo completar la acción (${res.status}). Reintentá.`,
          }));
          return false;
        }
        await load();
        return true;
      } catch (err) {
        setErrors((e) => ({
          ...e,
          [participationId]:
            err instanceof Error ? err.message : "Error de red. Reintentá.",
        }));
        return false;
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

  const toggleAttendance = useCallback(
    (participationId: string, currentStatus: string) => {
      const nextStatus = currentStatus === "used" ? "confirmed" : "used";
      return runRowAction(participationId, () =>
        fetch(`/api/admin/participations/${participationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
    },
    [runRowAction],
  );

  const toggleCancelled = useCallback(
    (participationId: string, currentStatus: string) => {
      // Strictly the confirmed ↔ cancelled axis. We don't try to
      // reverse other statuses because we don't store the prior
      // status anywhere — a "Reactivar" on a once-waitlisted row
      // would silently promote them to confirmed, which is wrong.
      // The UI gates the button to `confirmed`/`cancelled` so this
      // branch only fires on those.
      const nextStatus =
        currentStatus === "cancelled" ? "confirmed" : "cancelled";
      return runRowAction(participationId, () =>
        fetch(`/api/admin/participations/${participationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
    },
    [runRowAction],
  );

  const deleteParticipation = useCallback(
    (participationId: string, personName: string) => {
      // Hard delete is irreversible — gate it behind a native confirm.
      // For "won't come" use the cancel button, which keeps the row.
      const ok = window.confirm(
        `¿Eliminar a ${personName} del evento?\n\n` +
          `Esto borra la participación por completo. Si solo no va a venir, ` +
          `usá "No vendrá" en su lugar (queda registrada como cancelada).`,
      );
      if (!ok) return Promise.resolve(false);
      return runRowAction(participationId, () =>
        fetch(`/api/admin/participations/${participationId}`, {
          method: "DELETE",
        }),
      );
    },
    [runRowAction],
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

            {/* Event-type-specific summaries. Each block is gated on
                `event.type` so the drawer adapts to the registration
                fields each landing collects. Add a new block here when
                you add a new metadata field that the operator needs
                aggregated; don't try to make this generic. */}
            {data.event.type === "sinergia" && (
              <SinergiaDinnerSummary
                participants={data.participants}
                confirmed={data.counts.confirmed}
              />
            )}

            {/* Contributions (BROTE tickets, Sinergia donations, etc.) */}
            {data.contributions.length > 0 && (
              <section className="rounded-xl border border-sage/20 bg-white p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                  Aportes recaudados
                </p>
                <div className="space-y-4">
                  {data.contributions.map((c) => (
                    <div key={c.currency}>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <StatBox
                          label="Total"
                          value={formatMoney(c.totalCents, c.currency)}
                        />
                        <StatBox label="Aportantes" value={c.contributors} />
                        <StatBox
                          label="Promedio"
                          value={formatMoney(c.avgCents, c.currency)}
                        />
                        <StatBox
                          label="Máximo"
                          value={formatMoney(c.maxCents, c.currency)}
                        />
                      </div>
                      {data.counts.confirmed > 0 && (
                        <p className="mt-2 text-[11px] text-charcoal/50">
                          {c.contributors} de {data.counts.confirmed}{" "}
                          confirmados aportaron (
                          {Math.round(
                            (c.contributors / data.counts.confirmed) * 100,
                          )}
                          %)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

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
                    const staysForDinner =
                      data.event.type === "sinergia" &&
                      ACTIVE_RSVP_STATUSES.has(p.status) &&
                      p.metadata?.staysForDinner === true;
                    return (
                      <li key={p.participationId} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
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
                          {p.priceCents != null &&
                            p.priceCents > 0 &&
                            p.status !== "cancelled" && (
                              <p className="mt-0.5 text-[10px] text-terracotta">
                                Aportó{" "}
                                {formatMoney(
                                  p.priceCents,
                                  p.currency ?? "ARS",
                                )}
                              </p>
                            )}
                          {staysForDinner && (
                            <p className="mt-0.5 text-[10px] text-forest/70">
                              Se queda a cenar
                            </p>
                          )}
                          {errors[p.participationId] && (
                            <p
                              role="alert"
                              className="mt-0.5 text-[10px] text-terracotta"
                            >
                              {errors[p.participationId]}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                          {/* Status chip when no toggle applies (waitlist,
                              pending, cancelled) so the operator can still
                              see the state at a glance. */}
                          {(!canToggle || !canWrite) && (
                            <span className="text-[11px] uppercase text-charcoal/50">
                              {p.status}
                            </span>
                          )}
                          {canToggle && canWrite && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleAttendance(p.participationId, p.status)
                              }
                              disabled={isPending}
                              aria-pressed={attended}
                              aria-busy={isPending}
                              className={
                                "min-w-[110px] rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition " +
                                (attended
                                  ? "border-forest bg-forest text-cream hover:bg-forest/90"
                                  : "border-sage/40 bg-white text-charcoal/70 hover:border-forest/40 hover:text-forest") +
                                (isPending ? " opacity-50" : "")
                              }
                            >
                              {isPending
                                ? "Guardando…"
                                : attended
                                  ? "Asistió"
                                  : "Marcar"}
                            </button>
                          )}
                          {canWrite && (
                            <div className="flex items-center gap-2 text-[10px]">
                              {/* Cancel/reactivate is strictly
                                  confirmed ↔ cancelled — those are the
                                  only states where the round trip is
                                  unambiguous (waitlist/pending/no_show
                                  would lose their prior status on
                                  reactivate, since we don't store it).
                                  For other states use Eliminar. */}
                              {(p.status === "confirmed" ||
                                p.status === "cancelled") && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleCancelled(
                                        p.participationId,
                                        p.status,
                                      )
                                    }
                                    disabled={isPending}
                                    className="rounded text-charcoal/50 transition hover:text-forest disabled:opacity-50"
                                  >
                                    {p.status === "cancelled"
                                      ? "Reactivar"
                                      : "No vendrá"}
                                  </button>
                                  <span className="text-charcoal/20">·</span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  deleteParticipation(
                                    p.participationId,
                                    p.personName,
                                  )
                                }
                                disabled={isPending}
                                className="rounded text-charcoal/40 transition hover:text-terracotta disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                        </div>
                        {/* Pretty-JSON dump for power-user inspection.
                            Collapsed by default so it doesn't bloat
                            the list; surfaces every field on the
                            participation including raw metadata, so
                            new registration fields are always at
                            least viewable while we wire up dedicated
                            UI. */}
                        <details
                          className="mt-2 text-[10px]"
                          onToggle={(e) => {
                            const open = e.currentTarget.open;
                            setExpandedJson((prev) => {
                              const next = new Set(prev);
                              if (open) next.add(p.participationId);
                              else next.delete(p.participationId);
                              return next;
                            });
                          }}
                        >
                          <summary className="cursor-pointer select-none text-charcoal/40 transition hover:text-charcoal/70">
                            Ver datos completos (JSON)
                          </summary>
                          {expandedJson.has(p.participationId) && (
                            <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-sage/20 bg-cream/50 p-2 text-[10px] leading-tight text-charcoal/70">
                              {JSON.stringify(p, null, 2)}
                            </pre>
                          )}
                        </details>
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

function SinergiaDinnerSummary({
  participants,
  confirmed,
}: {
  participants: EventDetail["participants"];
  confirmed: number;
}) {
  // Count over confirmed/used so the denominator matches the same
  // population as the contributions panel and the headline
  // "Confirmados" stat. Cancelled / waitlist / pending are excluded.
  const stayCount = participants.filter(
    (p) =>
      ACTIVE_RSVP_STATUSES.has(p.status) &&
      p.metadata?.staysForDinner === true,
  ).length;
  if (stayCount === 0 && confirmed === 0) return null;
  const pct = confirmed > 0 ? Math.round((stayCount / confirmed) * 100) : 0;
  return (
    <section className="rounded-xl border border-sage/20 bg-white p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
        Cena
      </p>
      <p className="text-sm text-charcoal/80">
        <span className="font-serif text-2xl text-forest">{stayCount}</span>{" "}
        de {confirmed} se quedan a cenar
        {confirmed > 0 && (
          <span className="text-charcoal/50"> ({pct}%)</span>
        )}
      </p>
    </section>
  );
}

function formatDateTimeArg(iso: string): string {
  // The API returns UTC timestamps; render in ART so operators see the wall
  // clock they were using at the event. Include the year so stamps are
  // unambiguous across repeated event editions (e.g. plantación 2026 vs 2027).
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(cents: number, currency: string): string {
  // ARS is whole pesos in practice (Sinergia chips, BROTE prices) — drop
  // decimals to keep the StatBox from wrapping. Other currencies keep up
  // to 2 decimals so cent-level amounts (e.g. 1050¢ → $10.50) aren't
  // rounded to a misleading whole unit.
  const fractionDigits =
    currency === "ARS"
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      ...fractionDigits,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("es-AR", fractionDigits)}`;
  }
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
