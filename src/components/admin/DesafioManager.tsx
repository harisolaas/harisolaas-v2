"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MetricCard from "./MetricCard";
import {
  DAY_BODY_MAX,
  DAY_TITLE_MAX,
  parseDesafioMedia,
  type DesafioAdminDay,
  type DesafioAdminResponse,
} from "@/lib/desafio";

// Same palette the admin already uses; kept local so each badge is one
// lookup and the list stays readable.
const BADGE = {
  locked: "bg-sage/15 text-sage",
  unlocked: "border border-forest/30 text-forest",
  published: "bg-forest text-cream",
  draft: "bg-tan/60 text-charcoal/70",
  empty: "bg-charcoal/5 text-charcoal/40",
} as const;

function isReady(day: Pick<DesafioAdminDay, "published" | "title">): boolean {
  return day.published && Boolean(day.title?.trim());
}

type LoadResult =
  | { kind: "ok"; data: DesafioAdminResponse }
  | { kind: "error"; error: string }
  | { kind: "unauthenticated" };

async function fetchDesafio(): Promise<LoadResult> {
  try {
    const res = await fetch("/api/admin/desafio", { cache: "no-store" });
    if (res.status === 401) return { kind: "unauthenticated" };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { kind: "error", error: body.error || `Error ${res.status}` };
    }
    return { kind: "ok", data: (await res.json()) as DesafioAdminResponse };
  } catch {
    return { kind: "error", error: "No se pudo cargar el desafío." };
  }
}

export default function DesafioManager({
  email,
  canWrite,
}: {
  email: string;
  canWrite: boolean;
}) {
  const [data, setData] = useState<DesafioAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((result: LoadResult) => {
    if (result.kind === "unauthenticated") {
      window.location.href = "/admin/login";
      return;
    }
    if (result.kind === "ok") setData(result.data);
    else setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDesafio().then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchDesafio().then(apply);
  }, [apply]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }, []);

  const onSaved = useCallback((day: DesafioAdminDay) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            days: prev.days.map((d) =>
              d.dayNumber === day.dayNumber ? day : d,
            ),
          }
        : prev,
    );
  }, []);

  // Recomputed from the rows so a save updates the metric without a refetch.
  const daysReady = useMemo(
    () => data?.days.filter(isReady).length ?? 0,
    [data],
  );

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-xl text-forest">Desafío 15 días</h1>
            <span className="hidden text-[11px] uppercase tracking-wider text-charcoal/40 md:inline">
              harisolaas
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-xs text-charcoal/60 hover:text-forest"
            >
              ← Comunidad
            </Link>
            <a
              href="/es/desafio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-charcoal/60 hover:text-forest"
            >
              Ver página
            </a>
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

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6 md:py-8">
        {loading && !data && (
          <p className="text-sm text-charcoal/50">Cargando…</p>
        )}
        {loadError && (
          <div className="flex items-center gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-terracotta">
            <span>{loadError}</span>
            <button
              onClick={retry}
              className="rounded-full border border-terracotta/40 px-3 py-0.5 text-xs hover:bg-terracotta/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Personas anotadas"
                value={data.counts.registered}
              />
              <MetricCard
                label="Día actual"
                value={`${data.event.unlockedDays}/${data.event.totalDays}`}
                subtitle={
                  data.event.phase === "before"
                    ? `Arranca el ${data.days[0]?.dateLabel ?? data.event.startDate}`
                    : data.event.phase === "after"
                      ? "El desafío terminó"
                      : "En curso"
                }
              />
              <MetricCard
                label="Días listos"
                value={`${daysReady}/${data.event.totalDays}`}
                subtitle="Publicados y con título"
                accent={daysReady < data.event.unlockedDays}
              />
            </div>

            <section>
              <h2 className="mb-3 font-serif text-2xl text-forest">Días</h2>
              {!canWrite && (
                <p className="mb-3 text-xs text-charcoal/50">
                  Tu acceso es de lectura: podés ver los días pero no editarlos.
                </p>
              )}
              <ol className="space-y-2">
                {data.days.map((day) => (
                  <DayEditor
                    key={day.dayNumber}
                    day={day}
                    canWrite={canWrite}
                    onSaved={onSaved}
                  />
                ))}
              </ol>
            </section>

            <RegistrantsTable registrants={data.registrants} />
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// One day
// ============================================================

interface Draft {
  title: string;
  body: string;
  mediaUrl: string;
  published: boolean;
}

function toDraft(day: DesafioAdminDay): Draft {
  return {
    title: day.title ?? "",
    body: day.body ?? "",
    mediaUrl: day.mediaUrl ?? "",
    published: day.published,
  };
}

function mediaHint(raw: string): { text: string; invalid: boolean } | null {
  if (!raw.trim()) return null;
  const media = parseDesafioMedia(raw);
  if (!media) return { text: "Link inválido", invalid: true };
  if (media.kind === "youtube") {
    return { text: "YouTube · se va a ver embebido", invalid: false };
  }
  if (media.kind === "audio") {
    return { text: "Audio · se va a reproducir en la página", invalid: false };
  }
  return { text: "Link · se abre en otra pestaña", invalid: false };
}

function DayEditor({
  day,
  canWrite,
  onSaved,
}: {
  day: DesafioAdminDay;
  canWrite: boolean;
  onSaved: (day: DesafioAdminDay) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(day));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = isReady(day);
  const hasContent = Boolean(day.title || day.body || day.mediaUrl);
  const contentBadge = ready
    ? { label: "Publicado", cls: BADGE.published }
    : hasContent
      ? { label: "Borrador", cls: BADGE.draft }
      : { label: "Vacío", cls: BADGE.empty };
  const needsAttention = day.unlocked && !ready;

  const saved0 = toDraft(day);
  const dirty =
    draft.title !== saved0.title ||
    draft.body !== saved0.body ||
    draft.mediaUrl !== saved0.mediaUrl ||
    draft.published !== saved0.published;

  const hint = mediaHint(draft.mediaUrl);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/desafio/days/${day.dayNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          body: draft.body,
          mediaUrl: draft.mediaUrl,
          published: draft.published,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok && body.day) {
        onSaved(body.day as DesafioAdminDay);
        setDraft(toDraft(body.day as DesafioAdminDay));
        setSaved(true);
      } else if (res.status === 401) {
        window.location.href = "/admin/login";
      } else if (res.status === 403 || res.status === 404) {
        setError("No tenés permiso para editar este desafío.");
      } else {
        // 400s carry a Spanish message meant to be shown as-is.
        setError(body.error || `Error ${res.status}`);
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl border border-sage/20 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
      >
        <span className="font-serif text-lg text-forest">
          Día {day.dayNumber}
        </span>
        <span className="text-xs text-charcoal/50">{day.dateLabel}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            day.unlocked ? BADGE.unlocked : BADGE.locked
          }`}
        >
          {day.unlocked ? "Abierto" : "Bloqueado"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${contentBadge.cls}`}
        >
          {contentBadge.label}
        </span>
        {day.title && (
          <span className="min-w-0 flex-1 truncate text-sm text-charcoal/70">
            {day.title}
          </span>
        )}
        <span className="ml-auto text-xs text-charcoal/40">
          {expanded ? "Cerrar" : canWrite ? "Editar" : "Ver"}
        </span>
      </button>

      {needsAttention && (
        <p className="mx-4 mb-3 rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
          Este día ya está abierto y todavía no se ve: falta cargarlo o
          publicarlo.
        </p>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-sage/15 px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/40">
              Título
            </span>
            <input
              type="text"
              value={draft.title}
              maxLength={DAY_TITLE_MAX}
              disabled={!canWrite}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full rounded-lg border border-sage/30 px-3 py-2 text-sm text-charcoal outline-none focus:border-forest/40 disabled:bg-charcoal/5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/40">
              Texto
            </span>
            <textarea
              value={draft.body}
              maxLength={DAY_BODY_MAX}
              rows={6}
              disabled={!canWrite}
              onChange={(e) => update({ body: e.target.value })}
              className="w-full rounded-lg border border-sage/30 px-3 py-2 text-sm leading-relaxed text-charcoal outline-none focus:border-forest/40 disabled:bg-charcoal/5"
            />
            <span className="mt-0.5 block text-right text-[11px] text-charcoal/40">
              {draft.body.length}/{DAY_BODY_MAX}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/40">
              Link de la práctica (YouTube, audio o página)
            </span>
            <input
              type="url"
              value={draft.mediaUrl}
              disabled={!canWrite}
              placeholder="https://"
              onChange={(e) => update({ mediaUrl: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-charcoal outline-none focus:border-forest/40 disabled:bg-charcoal/5 ${
                hint?.invalid ? "border-terracotta" : "border-sage/30"
              }`}
            />
            {hint && (
              <span
                className={`mt-1 block text-xs ${
                  hint.invalid ? "text-terracotta" : "text-charcoal/50"
                }`}
              >
                {hint.text}
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal/80">
            <input
              type="checkbox"
              checked={draft.published}
              disabled={!canWrite}
              onChange={(e) => update({ published: e.target.checked })}
              className="h-4 w-4 accent-forest"
            />
            Publicado
            <span className="text-xs text-charcoal/40">
              (se ve en la página cuando llega su fecha)
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {canWrite && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !dirty}
                className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta disabled:opacity-40"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            )}
            {saved && !dirty && (
              <span className="text-xs text-forest">Guardado ✓</span>
            )}
            {day.updatedAt && (
              <span className="text-[11px] text-charcoal/40">
                Última edición {formatDateTime(day.updatedAt)}
                {day.updatedByEmail ? ` · ${day.updatedByEmail}` : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ============================================================
// Registrants
// ============================================================

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RegistrantsTable({
  registrants,
}: {
  registrants: DesafioAdminResponse["registrants"];
}) {
  return (
    <section>
      <h2 className="mb-3 font-serif text-2xl text-forest">
        Inscripciones{" "}
        <span className="text-base text-charcoal/40">
          ({registrants.length})
        </span>
      </h2>
      {registrants.length === 0 ? (
        <p className="rounded-xl border border-sage/20 bg-white px-4 py-6 text-center text-sm text-charcoal/50">
          Todavía no hay inscripciones.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sage/20 text-xs uppercase tracking-wider text-charcoal/40">
              <tr>
                <th className="px-4 py-2 font-semibold">Nombre</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">WhatsApp</th>
                <th className="px-4 py-2 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr
                  key={r.participationId}
                  className="border-b border-sage/10 last:border-0"
                >
                  <td className="px-4 py-2 text-charcoal">{r.name}</td>
                  <td className="px-4 py-2">
                    {r.email ? (
                      <a
                        href={`mailto:${r.email}`}
                        className="text-charcoal/70 hover:text-forest"
                      >
                        {r.email}
                      </a>
                    ) : (
                      <span className="text-charcoal/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.waMe ? (
                      <a
                        href={r.waMe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-terracotta hover:text-forest"
                      >
                        {r.phone}
                      </a>
                    ) : (
                      <span className="text-charcoal/30">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-charcoal/60">
                    {formatDateTime(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
