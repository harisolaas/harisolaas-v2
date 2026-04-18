"use client";

import { useCallback, useEffect, useState } from "react";

interface PersonDetail {
  person: {
    id: number;
    email: string | null;
    name: string;
    phone: string | null;
    instagram: string | null;
    language: string;
    tags: string[];
    notes: string | null;
    firstSeen: string;
    firstTouch: Record<string, unknown> | null;
    communicationOptIns: string[];
    optedOutAt: string | null;
  };
  participations: {
    id: string;
    eventId: string;
    role: string;
    status: string;
    createdAt: string;
    attribution: Record<string, unknown> | null;
    linkSlug: string | null;
    metadata: Record<string, unknown>;
    event: {
      id: string;
      name: string;
      type: string;
      date: string;
    };
  }[];
}

export default function PersonDrawer({
  personId,
  onClose,
  onMutated,
}: {
  personId: number;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const [data, setData] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesDraft, setNotesDraft] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/people/${personId}`);
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      setLoading(false);
      return;
    }
    const d = await res.json();
    setData(d);
    setNotesDraft(d.person.notes ?? "");
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      await load();
      onMutated?.();
    },
    [personId, load, onMutated],
  );

  const saveNotes = useCallback(async () => {
    if (!data || notesDraft === (data.person.notes ?? "")) return;
    setSavingNotes(true);
    try {
      await patch({ notes: notesDraft || null });
    } finally {
      setSavingNotes(false);
    }
  }, [data, notesDraft, patch]);

  // Fire-and-forget flush of any unsaved notes draft. Used from paths that
  // skip the textarea's onBlur (Escape key, backdrop click) so typed-but-
  // not-blurred notes don't silently vanish when the drawer unmounts.
  const closeDrawer = useCallback(() => {
    if (data && notesDraft !== (data.person.notes ?? "")) {
      void patch({ notes: notesDraft || null });
    }
    onClose();
  }, [data, notesDraft, patch, onClose]);

  // Close on Escape (flushes notes first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  const addTag = useCallback(async () => {
    const t = tagsInput.trim();
    if (!data || !t) return;
    if (data.person.tags.includes(t)) {
      setTagsInput("");
      return;
    }
    await patch({ tags: [...data.person.tags, t] });
    setTagsInput("");
  }, [data, tagsInput, patch]);

  const removeTag = useCallback(
    async (tag: string) => {
      if (!data) return;
      await patch({ tags: data.person.tags.filter((t) => t !== tag) });
    },
    [data, patch],
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        onClick={closeDrawer}
        aria-label="Cerrar"
        className="absolute inset-0 bg-charcoal/30 backdrop-blur-sm"
      />
      <aside
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-sage/20 bg-cream shadow-xl md:max-w-2xl"
        role="dialog"
        aria-label="Detalle de persona"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-sage/20 bg-cream/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-charcoal/50">
              Persona
            </p>
            <h2 className="font-serif text-xl text-forest">
              {data?.person.name ?? "—"}
            </h2>
          </div>
          <button
            onClick={closeDrawer}
            className="rounded-full border border-sage/30 px-3 py-1 text-xs text-charcoal/60 hover:bg-sage/10"
          >
            Cerrar
          </button>
        </header>

        {loading || !data ? (
          <p className="p-5 text-sm text-charcoal/40">Cargando…</p>
        ) : (
          <div className="space-y-6 p-5">
            {/* Contact */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Contacto
              </p>
              <dl className="space-y-2 text-sm">
                <Row label="Email" value={data.person.email ?? "—"} mono />
                <Row label="Teléfono" value={data.person.phone ?? "—"} />
                <Row label="Instagram" value={data.person.instagram ?? "—"} />
                <Row label="Idioma" value={data.person.language} />
                <Row
                  label="Primera vez"
                  value={data.person.firstSeen.slice(0, 10)}
                />
                {data.person.optedOutAt && (
                  <Row
                    label="Opt-out"
                    value={data.person.optedOutAt.slice(0, 10)}
                  />
                )}
              </dl>
            </section>

            {/* First touch */}
            {data.person.firstTouch && (
              <section className="rounded-xl border border-sage/20 bg-white p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                  Primer contacto
                </p>
                <pre className="overflow-x-auto rounded-lg bg-cream/60 p-3 font-mono text-[11px] text-charcoal/70">
                  {JSON.stringify(data.person.firstTouch, null, 2)}
                </pre>
              </section>
            )}

            {/* Tags */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.person.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-tan/40 px-2 py-0.5 text-[11px] text-charcoal/80"
                  >
                    {t}
                    <button
                      onClick={() => removeTag(t)}
                      aria-label={`Remove ${t}`}
                      className="text-charcoal/50 hover:text-terracotta"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {data.person.tags.length === 0 && (
                  <span className="text-xs text-charcoal/40">Sin tags</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Agregar tag"
                  className="flex-1 rounded-lg border border-sage/30 bg-white px-2 py-1 text-sm text-charcoal placeholder-charcoal/30"
                />
                <button
                  onClick={addTag}
                  disabled={!tagsInput.trim()}
                  className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Notas
              </p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                rows={4}
                className="w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal"
              />
              <p className="mt-1 text-[10px] text-charcoal/40">
                {savingNotes ? "Guardando…" : "Se guarda al salir del campo."}
              </p>
            </section>

            {/* Timeline */}
            <section className="rounded-xl border border-sage/20 bg-white p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
                Historial ({data.participations.length})
              </p>
              {data.participations.length === 0 ? (
                <p className="text-sm text-charcoal/40">
                  Aún no participó de ningún evento.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.participations
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((p) => (
                      <ParticipationEntry key={p.id} p={p} />
                    ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function ParticipationEntry({
  p,
}: {
  p: PersonDetail["participations"][number];
}) {
  const date = new Date(p.createdAt).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const attr = p.attribution;
  const attrLabel = formatAttribution(attr);
  const meta = describeMetadata(p.metadata);

  return (
    <li className="relative border-l-2 border-sage/30 pl-4">
      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-forest" />
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-forest">{p.event.name}</p>
        <span className="text-[10px] text-charcoal/50">{date}</span>
      </div>
      <p className="text-[11px] text-charcoal/60">
        {p.role} · <span className="uppercase">{p.status}</span>
      </p>
      {attrLabel && (
        <p className="mt-1 text-[11px] text-charcoal/60">Llegó por {attrLabel}</p>
      )}
      {p.linkSlug && (
        <p className="mt-0.5 text-[10px] font-mono text-charcoal/40">
          {p.linkSlug}
        </p>
      )}
      {meta && (
        <p className="mt-1 text-[11px] text-charcoal/60">{meta}</p>
      )}
    </li>
  );
}

function formatAttribution(
  attribution: Record<string, unknown> | null,
): string | null {
  if (!attribution) return null;
  const s = attribution.source as string | undefined;
  const m = attribution.medium as string | undefined;
  const c = attribution.campaign as string | undefined;
  const parts = [s, m].filter(Boolean);
  if (parts.length === 0 && !c) return null;
  const channel = parts.join(" · ");
  return c ? `${channel} (${c})` : channel;
}

function describeMetadata(meta: Record<string, unknown>): string | null {
  const bits: string[] = [];
  if (typeof meta.groupType === "string") {
    bits.push(
      meta.groupType === "con-alguien" ? "con alguien" : String(meta.groupType),
    );
  }
  if (meta.carpool === true) bits.push("carpool");
  if (typeof meta.message === "string" && meta.message.length > 0) {
    bits.push(`mensaje: "${(meta.message as string).slice(0, 60)}"`);
  }
  if (meta.staysForDinner === true) bits.push("se queda a cenar");
  if (meta.staysForDinner === false) bits.push("no cena");
  if (bits.length === 0) return null;
  return bits.join(" · ");
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] uppercase tracking-wider text-charcoal/50">
        {label}
      </dt>
      <dd
        className={`text-right text-sm text-charcoal/80 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
