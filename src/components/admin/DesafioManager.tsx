"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MetricCard from "./MetricCard";
import {
  DAY_LIMITS,
  isValidYouTubeUrl,
  parseYouTube,
  type DesafioAdminDay,
  type DesafioAdminResponse,
  type DesafioDayFields,
} from "@/lib/desafio";

// Same palette the admin already uses; kept local so each badge is one
// lookup and the list stays readable.
const BADGE = {
  published: "bg-forest text-cream",
  draft: "bg-tan/60 text-charcoal/70",
  empty: "bg-charcoal/5 text-charcoal/40",
} as const;

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
              d.dia === day.dia ? day : d,
            ),
          }
        : prev,
    );
  }, []);

  // Recomputed from the rows so a save updates the metric without a refetch.
  const daysVisible = useMemo(
    () => data?.days.filter((d) => d.visible).length ?? 0,
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
                label="Días publicados"
                value={`${daysVisible}/${data.event.totalDays}`}
                subtitle="Marcados como publicados y con título: se ven en la página"
                accent={daysVisible < data.event.totalDays}
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
                    key={day.dia}
                    day={day}
                    canWrite={canWrite}
                    onSaved={onSaved}
                  />
                ))}
              </ol>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// One day
// ============================================================

type Draft = DesafioDayFields & { publicado: boolean };

const FIELD_KEYS = [
  "titulo",
  "intro",
  "introVideo",
  "meditacion",
  "meditacionVideo",
  "duracion",
  "reflexion",
  "reflexionVideo",
] as const;

function toDraft(day: DesafioAdminDay): Draft {
  const draft = { publicado: day.publicado } as Draft;
  for (const k of FIELD_KEYS) draft[k] = day[k];
  return draft;
}

function videoHint(raw: string): { text: string; invalid: boolean } | null {
  if (!raw.trim()) return null;
  if (!isValidYouTubeUrl(raw.trim())) {
    return { text: "Tiene que ser un link de YouTube (https://…)", invalid: true };
  }
  const yt = parseYouTube(raw);
  return {
    text: yt?.isShort ? "YouTube Short · se ve vertical" : "YouTube · se ve embebido",
    invalid: false,
  };
}

const INPUT =
  "w-full rounded-lg border px-3 py-2 text-sm text-charcoal outline-none focus:border-forest/40 disabled:bg-charcoal/5";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/40">
      {children}
    </span>
  );
}

function TextField({
  label,
  value,
  max,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  disabled: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        maxLength={max}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} border-sage/30`}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  max,
  rows,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  rows: number;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} border-sage/30 leading-relaxed`}
      />
      <span className="mt-0.5 block text-right text-[11px] text-charcoal/40">
        {value.length}/{max}
      </span>
    </label>
  );
}

function VideoField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const hint = videoHint(value);
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="url"
        value={value}
        maxLength={DAY_LIMITS.video}
        disabled={disabled}
        placeholder="https://youtu.be/…"
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} ${hint?.invalid ? "border-terracotta" : "border-sage/30"}`}
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
  );
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

  const hasContent = FIELD_KEYS.some((k) => day[k].trim() !== "");
  const contentBadge = day.visible
    ? { label: "Publicado", cls: BADGE.published }
    : hasContent
      ? { label: "Borrador", cls: BADGE.draft }
      : { label: "Vacío", cls: BADGE.empty };

  const saved0 = toDraft(day);
  const dirty =
    draft.publicado !== saved0.publicado ||
    FIELD_KEYS.some((k) => draft[k] !== saved0[k]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
    setError(null);
  };
  const disabled = !canWrite;

  const save = async () => {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/desafio/days/${day.dia}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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
        <span className="font-serif text-lg text-forest">Día {day.dia}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${contentBadge.cls}`}
        >
          {contentBadge.label}
        </span>
        {day.titulo && (
          <span className="min-w-0 flex-1 truncate text-sm text-charcoal/70">
            {day.titulo}
            {day.duracion ? ` · ${day.duracion}` : ""}
          </span>
        )}
        <span className="ml-auto text-xs text-charcoal/40">
          {expanded ? "Cerrar" : canWrite ? "Editar" : "Ver"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-sage/15 px-4 py-4">
          <TextField
            label="Título del día"
            value={draft.titulo}
            max={DAY_LIMITS.titulo}
            disabled={disabled}
            onChange={(titulo) => update({ titulo })}
          />

          <fieldset className="space-y-3 rounded-lg bg-cream/60 p-3">
            <legend className="px-1 text-xs font-semibold text-forest">
              Para arrancar
            </legend>
            <TextArea
              label="Texto de intro"
              value={draft.intro}
              max={DAY_LIMITS.intro}
              rows={4}
              disabled={disabled}
              onChange={(intro) => update({ intro })}
            />
            <VideoField
              label="Video de intro (opcional)"
              value={draft.introVideo}
              disabled={disabled}
              onChange={(introVideo) => update({ introVideo })}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg bg-cream/60 p-3">
            <legend className="px-1 text-xs font-semibold text-forest">
              Meditación del día
            </legend>
            <TextField
              label="Título de la meditación"
              value={draft.meditacion}
              max={DAY_LIMITS.meditacion}
              disabled={disabled}
              onChange={(meditacion) => update({ meditacion })}
            />
            <VideoField
              label="Video de la meditación"
              value={draft.meditacionVideo}
              disabled={disabled}
              onChange={(meditacionVideo) => update({ meditacionVideo })}
            />
            <TextField
              label="Duración"
              value={draft.duracion}
              max={DAY_LIMITS.duracion}
              disabled={disabled}
              placeholder="20 min"
              onChange={(duracion) => update({ duracion })}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg bg-cream/60 p-3">
            <legend className="px-1 text-xs font-semibold text-forest">
              Para después de meditar (opcional: vacío = no se muestra)
            </legend>
            <TextArea
              label="Reflexión"
              value={draft.reflexion}
              max={DAY_LIMITS.reflexion}
              rows={3}
              disabled={disabled}
              onChange={(reflexion) => update({ reflexion })}
            />
            <VideoField
              label="Video de reflexión (opcional)"
              value={draft.reflexionVideo}
              disabled={disabled}
              onChange={(reflexionVideo) => update({ reflexionVideo })}
            />
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-charcoal/80">
            <input
              type="checkbox"
              checked={draft.publicado}
              disabled={disabled}
              onChange={(e) => update({ publicado: e.target.checked })}
              className="h-4 w-4 accent-forest"
            />
            Publicado
            <span className="text-xs text-charcoal/40">
              (se ve en la página apenas guardás)
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
