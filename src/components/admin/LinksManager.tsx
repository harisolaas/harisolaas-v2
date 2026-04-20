"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CHANNELS,
  CHANNEL_KEYS,
  KNOWN_DESTINATIONS,
  formatAutoLabel,
  type ChannelKey,
} from "@/lib/links";
import PersonEmailAutocomplete from "./PersonEmailAutocomplete";

interface LinkRow {
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
  version: number;
  createdAt: string;
  updatedAt: string;
  clicks: number;
  signups: number;
  sticky: number;
  bypassCapacity?: boolean;
  referredByPersonId?: number | null;
  referredByEmail?: string | null;
  referredByName?: string | null;
}

type StatusFilter = "all" | "active" | "archived" | "disabled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "archived", label: "Archivados" },
  { key: "disabled", label: "Deshabilitados" },
  { key: "all", label: "Todos" },
];

const BASE_URL = "https://www.harisolaas.com";

export default function LinksManager({ email }: { email: string }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [createdLink, setCreatedLink] = useState<LinkRow | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<LinkRow | null>(null);

  const fetchLinks = useCallback(async () => {
    const res = await fetch("/api/admin/links");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      return;
    }
    const data = await res.json();
    setLinks(data.links ?? []);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const filtered = useMemo(() => {
    if (!links) return null;
    return links.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (channelFilter && l.channel !== channelFilter) return false;
      if (search) {
        const n = search.toLowerCase();
        if (
          !l.label.toLowerCase().includes(n) &&
          !l.slug.toLowerCase().includes(n) &&
          !(l.campaign ?? "").toLowerCase().includes(n)
        )
          return false;
      }
      return true;
    });
  }, [links, statusFilter, channelFilter, search]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-xs text-charcoal/50 hover:text-charcoal"
            >
              ← Admin
            </Link>
            <h1 className="font-serif text-xl text-forest">Enlaces</h1>
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
        {createdLink ? (
          <CreationResult
            link={createdLink}
            onDone={() => {
              setCreatedLink(null);
              fetchLinks();
            }}
            onCreateAnother={() => {
              setCreatedLink(null);
              setDuplicateSource(null);
              setCreating(true);
              fetchLinks();
            }}
            onDuplicate={(duplicateFrom) => {
              setCreatedLink(null);
              setDuplicateSource(duplicateFrom);
              setCreating(true);
              fetchLinks();
            }}
          />
        ) : creating ? (
          <CreateLinkForm
            initial={duplicateSource ?? undefined}
            onCancel={() => {
              setCreating(false);
              setDuplicateSource(null);
            }}
            onCreated={(row) => {
              setCreating(false);
              setDuplicateSource(null);
              setCreatedLink(row);
            }}
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setStatusFilter(t.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === t.key
                        ? "border-forest bg-forest text-cream"
                        : "border-sage/30 text-charcoal/60 hover:border-forest/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCreating(true)}
                className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-terracotta/90"
              >
                + Nuevo enlace
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
              >
                <option value="">Todos los canales</option>
                {CHANNEL_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNELS[c].display}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por etiqueta, slug o campaña"
                className="flex-1 min-w-60 rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal placeholder-charcoal/30"
              />
            </div>

            <LinksTable rows={filtered} />
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Table ─── */

function LinksTable({ rows }: { rows: LinkRow[] | null }) {
  if (rows === null)
    return <p className="text-sm text-charcoal/40">Cargando…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-xl border border-sage/20 bg-white p-8 text-center text-sm text-charcoal/60">
        No hay enlaces para mostrar.
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-sage/20 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-sage/10 text-xs uppercase tracking-wider text-charcoal/60">
          <tr>
            <th className="px-4 py-3 text-left">Etiqueta</th>
            <th className="px-4 py-3 text-left">Canal</th>
            <th className="px-4 py-3 text-left">Destino</th>
            <th className="px-4 py-3 text-right">Clicks</th>
            <th className="px-4 py-3 text-right">Signups</th>
            <th className="px-4 py-3 text-right">CVR</th>
            <th className="px-4 py-3 text-right">Permanencia</th>
            <th className="px-4 py-3 text-left">Campaña</th>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cvr = r.clicks > 0 ? (r.signups / r.clicks) * 100 : null;
            const stickiness = r.signups > 0 ? (r.sticky / r.signups) * 100 : null;
            return (
              <tr
                key={r.slug}
                className="border-t border-sage/10 hover:bg-sage/5"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/links/${r.slug}`}
                    className="font-medium text-forest hover:underline"
                  >
                    {r.label}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-charcoal/40">
                    {r.slug}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full border border-sage/30 px-2 py-0.5 text-[11px] text-charcoal/70">
                    {CHANNELS[r.channel as ChannelKey]?.display ?? r.channel}
                  </span>
                </td>
                <td className="px-4 py-3 text-charcoal/70">
                  <span className="font-mono text-xs">{r.destination}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{r.clicks}</td>
                <td className="px-4 py-3 text-right font-semibold text-forest">
                  {r.signups}
                </td>
                <td className="px-4 py-3 text-right text-charcoal/70">
                  {cvr == null ? "—" : `${cvr.toFixed(1)}%`}
                </td>
                <td className="px-4 py-3 text-right text-charcoal/70">
                  {stickiness == null ? "—" : `${stickiness.toFixed(0)}%`}
                </td>
                <td className="px-4 py-3 text-charcoal/70">
                  {r.campaign ?? <span className="text-charcoal/30">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-charcoal/50">
                  {r.createdDate}
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={r.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status }: { status: LinkRow["status"] }) {
  const cls =
    status === "active"
      ? "bg-sage/20 text-forest"
      : status === "archived"
        ? "bg-tan/40 text-charcoal/60"
        : "bg-terracotta/20 text-terracotta";
  const label =
    status === "active"
      ? "Activo"
      : status === "archived"
        ? "Archivado"
        : "Deshabilitado";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Create form ─── */

function CreateLinkForm({
  onCancel,
  onCreated,
  initial,
}: {
  onCancel: () => void;
  onCreated: (row: LinkRow) => void;
  initial?: Partial<LinkRow>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [destination, setDestination] = useState<string>(
    initial?.destination ?? "/es/brote",
  );
  const [customDestination, setCustomDestination] = useState<string>("");
  const [channel, setChannel] = useState<ChannelKey>(
    (initial?.channel as ChannelKey) ?? "ig-story",
  );
  const [createdDate, setCreatedDate] = useState<string>(
    initial?.createdDate ?? today,
  );
  const [label, setLabel] = useState<string>("");
  const [campaign, setCampaign] = useState<string>(initial?.campaign ?? "");
  const [resourceUrl, setResourceUrl] = useState<string>(initial?.resourceUrl ?? "");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  // Override-link fields: let a signup past a sold-out cap and stamp a
  // referrer automatically on the resulting participation. Defaults off;
  // most links are not override links.
  const [bypassCapacity, setBypassCapacity] = useState<boolean>(
    initial?.bypassCapacity ?? false,
  );
  const [referrerEmail, setReferrerEmail] = useState<string>(
    initial?.referredByEmail ?? "",
  );
  const [showMore, setShowMore] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDestination =
    destination === "__custom__" ? customDestination : destination;

  const autoLabel = formatAutoLabel(channel, createdDate);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!effectiveDestination.trim()) {
      setError("Falta el destino");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: effectiveDestination.trim(),
          channel,
          createdDate,
          label: label.trim() || undefined,
          campaign: campaign.trim() || null,
          resourceUrl: resourceUrl.trim() || null,
          note: note.trim() || null,
          bypassCapacity,
          referrerEmail: referrerEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error creando el enlace");
        return;
      }
      // POST returns the Drizzle row (camelCase). A brand-new link has no
      // clicks or signups yet, so we zero those aggregates for the result
      // screen rather than doing a second fetch.
      const row = data.link as Omit<LinkRow, "clicks" | "signups" | "sticky">;
      onCreated({ ...row, clicks: 0, signups: 0, sticky: 0 });
    } catch {
      setError("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-sage/20 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-serif text-xl text-forest">Nuevo enlace</h2>

      <div className="space-y-4">
        <Field label="Destino">
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal"
          >
            {KNOWN_DESTINATIONS.map((d) => (
              <option key={d.path} value={d.path}>
                {d.display}
              </option>
            ))}
            <option value="__custom__">Otra página…</option>
          </select>
          {destination === "__custom__" && (
            <input
              value={customDestination}
              onChange={(e) => setCustomDestination(e.target.value)}
              placeholder="/es/otra-pagina o https://…"
              className="mt-2 w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
            />
          )}
        </Field>

        <Field label="Canal">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelKey)}
            className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal"
          >
            <optgroup label="Instagram">
              {CHANNEL_KEYS.filter((k) => CHANNELS[k].group === "instagram").map(
                (k) => (
                  <option key={k} value={k}>
                    {CHANNELS[k].display}
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="Email">
              {CHANNEL_KEYS.filter((k) => CHANNELS[k].group === "email").map(
                (k) => (
                  <option key={k} value={k}>
                    {CHANNELS[k].display}
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="WhatsApp">
              {CHANNEL_KEYS.filter((k) => CHANNELS[k].group === "whatsapp").map(
                (k) => (
                  <option key={k} value={k}>
                    {CHANNELS[k].display}
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="Otro">
              {CHANNEL_KEYS.filter((k) => CHANNELS[k].group === "otro").map(
                (k) => (
                  <option key={k} value={k}>
                    {CHANNELS[k].display}
                  </option>
                ),
              )}
            </optgroup>
          </select>
        </Field>

        <Field label="Fecha">
          <input
            type="date"
            value={createdDate}
            onChange={(e) => setCreatedDate(e.target.value)}
            className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal"
          />
          <p className="mt-1 text-[11px] text-charcoal/40">
            Etiqueta automática: <span className="italic">{autoLabel}</span>
          </p>
        </Field>

        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-charcoal/60 underline"
        >
          {showMore ? "Ocultar" : "Más detalles"}
        </button>

        {showMore && (
          <div className="space-y-4 rounded-lg bg-cream/50 p-4">
            <Field label="Etiqueta (opcional)">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={autoLabel}
                className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
              />
            </Field>
            <Field label="Campaña (opcional)">
              <input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="plant_launch"
                className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
              />
            </Field>
            <Field label="URL del recurso (opcional)">
              <input
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
              />
            </Field>
            <Field label="Nota (opcional)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
              />
            </Field>
            <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 p-3">
              <label className="flex items-start gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={bypassCapacity}
                  onChange={(e) => setBypassCapacity(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Permitir inscripción aunque esté lleno</span>
                  <span className="mt-1 block text-[11px] text-charcoal/50">
                    Los clicks de este enlace pueden reservar aunque el cupo esté completo.
                  </span>
                </span>
              </label>
              <div className="mt-3">
                <Field label="Atribuir a (email, opcional)">
                  <PersonEmailAutocomplete
                    value={referrerEmail}
                    onChange={setReferrerEmail}
                    placeholder="empezá a escribir un email…"
                  />
                </Field>
                <p className="mt-1 text-[11px] text-charcoal/50">
                  Cada inscripción vía este enlace se atribuye a esta persona.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="text-sm text-charcoal/60 hover:text-charcoal"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !effectiveDestination.trim()}
            className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest/90 disabled:opacity-50"
          >
            {submitting ? "Creando…" : "Crear enlace"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal/60">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ─── Creation result screen ─── */

function CreationResult({
  link,
  onDone,
  onCreateAnother,
  onDuplicate,
}: {
  link: LinkRow;
  onDone: () => void;
  onCreateAnother: () => void;
  onDuplicate: (from: LinkRow) => void;
}) {
  const shortUrl = `${BASE_URL}/go/${link.slug}`;
  const preview = previewDestinationUrl(link);

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-sage/20 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">✨</span>
        <h2 className="font-serif text-xl text-forest">Enlace listo</h2>
      </div>

      <div className="mb-4 rounded-lg border border-forest/20 bg-forest/5 p-4">
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

      <div className="mb-6 rounded-lg bg-cream/60 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
          Redirige a
        </p>
        <code className="break-all font-mono text-xs text-charcoal/70">
          {preview}
        </code>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={onDone}
          className="text-sm text-charcoal/60 hover:text-charcoal"
        >
          Ver todos
        </button>
        <button
          onClick={() => onDuplicate(link)}
          className="rounded-full border border-sage/30 px-4 py-2 text-sm font-medium text-charcoal/70 hover:border-forest/40"
        >
          Duplicar
        </button>
        <button
          onClick={onCreateAnother}
          className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta/90"
        >
          Crear otro
        </button>
      </div>
    </div>
  );
}

function previewDestinationUrl(link: LinkRow): string {
  const base = link.destination.startsWith("http")
    ? new URL(link.destination)
    : new URL(link.destination, BASE_URL);
  base.searchParams.set("utm_source", link.source);
  base.searchParams.set("utm_medium", link.medium);
  if (link.campaign) base.searchParams.set("utm_campaign", link.campaign);
  base.searchParams.set("utm_content", link.slug);
  return link.destination.startsWith("http")
    ? base.toString()
    : base.pathname + base.search;
}
