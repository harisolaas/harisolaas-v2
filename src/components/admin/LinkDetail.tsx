"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHANNELS, type ChannelKey } from "@/lib/links";

interface LinkData {
  slug: string;
  destination: string;
  label: string;
  channel: string;
  source: string;
  medium: string;
  campaign: string | null;
  resourceUrl: string | null;
  note: string | null;
  createdDate: string;
  createdBy: string;
  status: "active" | "archived" | "disabled";
  createdAt: string;
  updatedAt: string;
  bypassCapacity?: boolean;
  referredByPersonId?: number | null;
  referredByEmail?: string | null;
  referredByName?: string | null;
}

interface DetailStats {
  clicks: number;
  botClicks: number;
  signups: number;
  stickyPeople: number;
  firstClick: string | null;
  lastClick: string | null;
}

interface DailyClick {
  day: string;
  clicks: number;
}

interface SignupRow {
  participationId: string;
  personId: number;
  personName: string;
  personEmail: string | null;
  eventId: string;
  eventName: string;
  eventType: string;
  status: string;
  createdAt: string;
  totalParticipations: number;
}

const BASE_URL = "https://www.harisolaas.com";

export default function LinkDetail({
  slug,
  email,
}: {
  slug: string;
  email: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState<LinkData | null>(null);
  const [stats, setStats] = useState<DetailStats | null>(null);
  const [daily, setDaily] = useState<DailyClick[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // edit form state
  const [label, setLabel] = useState<string>("");
  const [campaign, setCampaign] = useState<string>("");
  const [resourceUrl, setResourceUrl] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [bypassCapacity, setBypassCapacity] = useState<boolean>(false);
  const [referrerEmail, setReferrerEmail] = useState<string>("");

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/admin/links/${slug}`);
    if (res.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (res.status === 404) {
      setError("Enlace no encontrado");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setLink(data.link);
    setStats(data.stats);
    setDaily(data.dailyClicks);
    setSignups(data.signups);
    setLabel(data.link.label);
    setCampaign(data.link.campaign ?? "");
    setResourceUrl(data.link.resourceUrl ?? "");
    setNote(data.link.note ?? "");
    setBypassCapacity(Boolean(data.link.bypassCapacity));
    setReferrerEmail(data.link.referredByEmail ?? "");
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const shortUrl = `${BASE_URL}/go/${slug}`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/links/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          campaign: campaign.trim() || null,
          resourceUrl: resourceUrl.trim() || null,
          note: note.trim() || null,
          bypassCapacity,
          // Empty string clears the referrer; undefined would leave it
          // unchanged. Always send the current value so edits reflect.
          referrerEmail: referrerEmail.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Error ${res.status}`);
        return;
      }
      setEditing(false);
      await fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: LinkData["status"]) => {
    const res = await fetch(`/api/admin/links/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) fetchDetail();
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Eliminar este enlace? Solo se puede si no tiene signups. Si tiene, archívalo.",
      )
    )
      return;
    const res = await fetch(`/api/admin/links/${slug}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push("/admin/links");
      return;
    }
    if (res.status === 409) {
      alert(
        `No se puede eliminar — el enlace tiene ${data.signups ?? "?"} signups. Archívalo en su lugar.`,
      );
    } else {
      alert(data.error ?? "No se pudo eliminar");
    }
  };

  const channelDisplay =
    link && CHANNELS[link.channel as ChannelKey]?.display ? CHANNELS[link.channel as ChannelKey].display : link?.channel;

  const cvr = useMemo(() => {
    if (!stats || stats.clicks === 0) return null;
    return (stats.signups / stats.clicks) * 100;
  }, [stats]);

  const stickiness = useMemo(() => {
    if (!stats || stats.signups === 0) return null;
    return (stats.stickyPeople / stats.signups) * 100;
  }, [stats]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/links"
              className="text-xs text-charcoal/50 hover:text-charcoal"
            >
              ← Enlaces
            </Link>
            <h1 className="font-serif text-xl text-forest">
              {link?.label ?? slug}
            </h1>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {loading ? (
          <p className="text-sm text-charcoal/40">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-terracotta">{error}</p>
        ) : !link || !stats ? null : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            {/* ── Main column ── */}
            <div className="space-y-6">
              {/* Short URL card */}
              <div className="rounded-xl border border-forest/20 bg-forest/5 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forest">
                  Short URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-sm text-forest">
                    {shortUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream"
                  >
                    {copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatBox label="Clicks" value={stats.clicks} subtitle={stats.botClicks > 0 ? `+${stats.botClicks} bots` : undefined} />
                <StatBox label="Signups" value={stats.signups} accent />
                <StatBox
                  label="CVR"
                  value={cvr == null ? "—" : `${cvr.toFixed(1)}%`}
                />
                <StatBox
                  label="Permanencia"
                  value={
                    stickiness == null ? "—" : `${stickiness.toFixed(0)}%`
                  }
                  subtitle={
                    stats.signups > 0
                      ? `${stats.stickyPeople} de ${stats.signups} con 2+ participaciones`
                      : undefined
                  }
                />
              </div>

              {/* Daily chart */}
              <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                  Clicks por día (últimos 90)
                </p>
                <DailyBars rows={daily} />
              </div>

              {/* Attributed people */}
              <div className="rounded-xl border border-sage/20 bg-white shadow-sm">
                <div className="border-b border-sage/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                    Personas atribuidas ({signups.length})
                  </p>
                </div>
                {signups.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-charcoal/50">
                    Todavía no hay signups desde este enlace.
                  </p>
                ) : (
                  <ul className="divide-y divide-sage/10">
                    {signups.map((s) => (
                      <li
                        key={s.participationId}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          {/* TODO(spec-02): link to /admin/people/[id] drilldown */}
                          <Link
                            href="#"
                            className="font-medium text-forest hover:underline"
                          >
                            {s.personName}
                          </Link>
                          <div className="text-[11px] text-charcoal/50">
                            {s.personEmail ?? "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-charcoal/70">
                            {s.eventName}
                          </div>
                          <div className="text-[11px] text-charcoal/40">
                            {s.totalParticipations} participaciones totales
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-4">
              <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                  Detalles
                </p>

                <dl className="space-y-3 text-sm">
                  <MetaRow label="Canal" value={channelDisplay ?? link.channel} />
                  <MetaRow label="Destino" value={link.destination} mono />
                  <MetaRow label="Campaña" value={link.campaign ?? "—"} />
                  <MetaRow label="Fecha" value={link.createdDate} />
                  <MetaRow label="Creado por" value={link.createdBy} />
                  {link.bypassCapacity && (
                    <MetaRow
                      label="Excepción"
                      value="Permite inscribir aunque esté lleno"
                    />
                  )}
                  {link.referredByEmail && (
                    <MetaRow
                      label="Atribuir a"
                      value={
                        link.referredByName
                          ? `${link.referredByName} (${link.referredByEmail})`
                          : link.referredByEmail
                      }
                    />
                  )}
                  <MetaRow
                    label="Primer click"
                    value={
                      stats.firstClick
                        ? new Date(stats.firstClick).toLocaleString("es-AR")
                        : "—"
                    }
                  />
                  <MetaRow
                    label="Último click"
                    value={
                      stats.lastClick
                        ? new Date(stats.lastClick).toLocaleString("es-AR")
                        : "—"
                    }
                  />
                </dl>
              </div>

              <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                  Editar
                </p>
                {!editing ? (
                  <>
                    <p className="mb-3 text-xs text-charcoal/60">
                      Etiqueta, URL del recurso, notas, campaña.
                    </p>
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full rounded-full border border-sage/40 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:border-forest/40"
                    >
                      Editar detalles
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <EditField label="Etiqueta">
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full rounded-lg border border-sage/30 bg-white px-2 py-1.5 text-sm text-charcoal"
                      />
                    </EditField>
                    <EditField label="Campaña">
                      <input
                        value={campaign}
                        onChange={(e) => setCampaign(e.target.value)}
                        className="w-full rounded-lg border border-sage/30 bg-white px-2 py-1.5 text-sm text-charcoal"
                      />
                    </EditField>
                    <EditField label="URL del recurso">
                      <input
                        value={resourceUrl}
                        onChange={(e) => setResourceUrl(e.target.value)}
                        placeholder="https://instagram.com/..."
                        className="w-full rounded-lg border border-sage/30 bg-white px-2 py-1.5 text-sm text-charcoal placeholder-charcoal/30"
                      />
                    </EditField>
                    <EditField label="Nota">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-sage/30 bg-white px-2 py-1.5 text-sm text-charcoal"
                      />
                    </EditField>
                    <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 p-2">
                      <label className="flex items-start gap-2 text-xs text-charcoal">
                        <input
                          type="checkbox"
                          checked={bypassCapacity}
                          onChange={(e) => setBypassCapacity(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>Permitir inscripción aunque esté lleno</span>
                      </label>
                      <div className="mt-2">
                        <EditField label="Atribuir a (email)">
                          <input
                            type="email"
                            value={referrerEmail}
                            onChange={(e) => setReferrerEmail(e.target.value)}
                            placeholder="connie@ejemplo.com"
                            className="w-full rounded-lg border border-sage/30 bg-white px-2 py-1.5 text-sm text-charcoal placeholder-charcoal/30"
                          />
                        </EditField>
                      </div>
                    </div>
                    {error && (
                      <p className="text-xs text-terracotta" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(false);
                          setError(null);
                          setLabel(link.label);
                          setCampaign(link.campaign ?? "");
                          setResourceUrl(link.resourceUrl ?? "");
                          setNote(link.note ?? "");
                          setBypassCapacity(Boolean(link.bypassCapacity));
                          setReferrerEmail(link.referredByEmail ?? "");
                        }}
                        className="text-xs text-charcoal/50 hover:text-charcoal"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream disabled:opacity-50"
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-sage/20 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-charcoal/60">
                  Estado · <span className="text-forest">{link.status}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {link.status !== "active" && (
                    <button
                      onClick={() => handleStatus("active")}
                      className="rounded-full bg-sage/30 px-3 py-1.5 text-xs font-medium text-forest hover:bg-sage/40"
                    >
                      Activar
                    </button>
                  )}
                  {link.status !== "archived" && (
                    <button
                      onClick={() => handleStatus("archived")}
                      className="rounded-full border border-tan/50 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:bg-tan/20"
                    >
                      Archivar
                    </button>
                  )}
                  {link.status !== "disabled" && (
                    <button
                      onClick={() => handleStatus("disabled")}
                      className="rounded-full border border-terracotta/50 px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta/10"
                    >
                      Deshabilitar
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="mt-2 text-[11px] text-terracotta/70 underline hover:text-terracotta"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatBox({
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

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/50">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-sm text-charcoal/80 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
        {label}
      </span>
      {children}
    </label>
  );
}

function DailyBars({ rows }: { rows: DailyClick[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-charcoal/40">Todavía no hay clicks.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <div className="flex h-32 items-end gap-1">
      {rows.map((r) => {
        const h = (r.clicks / max) * 100;
        return (
          <div
            key={r.day}
            className="group relative flex-1"
            title={`${r.day} — ${r.clicks} clicks`}
          >
            <div
              className="w-full rounded-t bg-forest/60"
              style={{ height: `${Math.max(2, h)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
