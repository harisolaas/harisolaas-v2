"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminRole, AdminScope } from "@/lib/admin-auth";

interface AccessUser {
  id: number;
  email: string;
  role: AdminRole;
  scope: AdminScope;
  allowedEventIds: string[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventOption {
  id: string;
  name: string;
  date: string;
}

export default function AccessShell({
  email,
  currentUserId,
}: {
  email: string;
  currentUserId: number | null;
}) {
  const [users, setUsers] = useState<AccessUser[] | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/access/users");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/admin/login";
      setError(`No se pudieron cargar los colaboradores (${res.status}).`);
      return;
    }
    const d = (await res.json()) as { users: AccessUser[] };
    setUsers(d.users);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    if (!res.ok) return;
    const d = (await res.json()) as {
      events: { id: string; name: string; date: string }[];
    };
    setEvents(
      d.events.map((e) => ({ id: e.id, name: e.name, date: e.date })),
    );
  }, []);

  useEffect(() => {
    refresh();
    loadEvents();
  }, [refresh, loadEvents]);

  const handleRemove = useCallback(
    async (id: number) => {
      if (!confirm("¿Quitar acceso a este colaborador?")) return;
      const res = await fetch(`/api/admin/access/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Error ${res.status}`);
        return;
      }
      refresh();
    },
    [refresh],
  );

  const handleRevoke = useCallback(
    async (id: number) => {
      const res = await fetch(
        `/api/admin/access/users/${id}/revoke-sessions`,
        { method: "POST" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Error ${res.status}`);
        return;
      }
      const d = (await res.json()) as { sessionsRevoked: number };
      alert(`Sesiones cerradas: ${d.sessionsRevoked}`);
    },
    [],
  );

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-sage/20 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-baseline gap-3">
            <Link
              href="/admin"
              className="text-xs text-charcoal/50 hover:text-forest"
            >
              ← Comunidad
            </Link>
            <h1 className="font-serif text-xl text-forest">Acceso</h1>
          </div>
          <span className="hidden text-xs text-charcoal/40 md:block">
            {email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <section className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-lg text-forest">Agregar colaborador</h2>
          <p className="mb-4 text-xs text-charcoal/50">
            El colaborador usa el login estándar (link mágico) con el mismo email.
          </p>
          <InviteForm
            events={events}
            onCreated={refresh}
            onError={setError}
          />
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-terracotta/40 bg-terracotta/10 px-4 py-2 text-sm text-terracotta"
          >
            {error}
          </div>
        )}

        <section className="rounded-xl border border-sage/20 bg-white shadow-sm">
          <div className="border-b border-sage/10 px-5 py-3">
            <h2 className="font-serif text-lg text-forest">Colaboradores</h2>
          </div>
          {users === null ? (
            <p className="p-5 text-sm text-charcoal/40">Cargando…</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-sm text-charcoal/40">
              Todavía no hay colaboradores.
            </p>
          ) : (
            <ul className="divide-y divide-sage/10">
              {users.map((u) => (
                <li key={u.id} className="px-5 py-4">
                  {editingId === u.id ? (
                    <EditRow
                      user={u}
                      events={events}
                      onSaved={() => {
                        setEditingId(null);
                        refresh();
                      }}
                      onCancel={() => setEditingId(null)}
                      onError={setError}
                    />
                  ) : (
                    <ViewRow
                      user={u}
                      events={events}
                      isSelf={currentUserId === u.id}
                      onEdit={() => setEditingId(u.id)}
                      onRemove={() => handleRemove(u.id)}
                      onRevoke={() => handleRevoke(u.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function ViewRow({
  user,
  events,
  isSelf,
  onEdit,
  onRemove,
  onRevoke,
}: {
  user: AccessUser;
  events: EventOption[];
  isSelf: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRevoke: () => void;
}) {
  const eventsById = useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-forest">{user.email}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-charcoal/60">
          <RoleChip role={user.role} />
          <ScopeChip scope={user.scope} count={user.allowedEventIds.length} />
        </div>
        {user.scope === "scoped" && user.allowedEventIds.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {user.allowedEventIds.map((id) => (
              <li
                key={id}
                className="rounded-full border border-sage/30 px-2 py-0.5 text-[11px] text-charcoal/70"
              >
                {eventsById.get(id)?.name ?? id}
              </li>
            ))}
          </ul>
        )}
        {user.scope === "scoped" && user.allowedEventIds.length === 0 && (
          <p className="mt-2 text-[11px] text-terracotta">
            Sin eventos asignados — este colaborador no puede ver nada todavía.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onEdit}
          className="rounded-full border border-sage/30 px-3 py-1 text-xs text-charcoal/70 hover:border-forest/40 hover:text-forest"
        >
          Editar
        </button>
        <button
          onClick={onRevoke}
          className="rounded-full border border-sage/30 px-3 py-1 text-xs text-charcoal/70 hover:border-forest/40 hover:text-forest"
        >
          Cerrar sesiones
        </button>
        {!isSelf && (
          <button
            onClick={onRemove}
            className="rounded-full border border-terracotta/40 px-3 py-1 text-xs text-terracotta hover:bg-terracotta/10"
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function EditRow({
  user,
  events,
  onSaved,
  onCancel,
  onError,
}: {
  user: AccessUser;
  events: EventOption[];
  onSaved: () => void;
  onCancel: () => void;
  onError: (msg: string | null) => void;
}) {
  const [role, setRole] = useState<AdminRole>(user.role);
  const [scope, setScope] = useState<AdminScope>(user.scope);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    user.allowedEventIds,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/access/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          scope,
          allowedEventIds: scope === "scoped" ? selectedEvents : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error ?? `Error ${res.status}`);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-medium text-forest">{user.email}</p>
      <RoleScopeControls
        role={role}
        scope={scope}
        selectedEvents={selectedEvents}
        events={events}
        onRole={setRole}
        onScope={setScope}
        onEvents={setSelectedEvents}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream hover:bg-forest/90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-sage/30 px-4 py-1.5 text-xs text-charcoal/60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function InviteForm({
  events,
  onCreated,
  onError,
}: {
  events: EventOption[];
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [scope, setScope] = useState<AdminScope>("scoped");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      onError("Email inválido");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/access/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          scope,
          allowedEventIds: scope === "scoped" ? selectedEvents : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error ?? `Error ${res.status}`);
        return;
      }
      setEmail("");
      setRole("viewer");
      setScope("scoped");
      setSelectedEvents([]);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-wider text-charcoal/60">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colaborador@ejemplo.com"
          className="rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal"
        />
      </div>
      <RoleScopeControls
        role={role}
        scope={scope}
        selectedEvents={selectedEvents}
        events={events}
        onRole={setRole}
        onScope={setScope}
        onEvents={setSelectedEvents}
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream hover:bg-forest/90 disabled:opacity-50"
      >
        {saving ? "Agregando…" : "Agregar"}
      </button>
    </form>
  );
}

function RoleScopeControls({
  role,
  scope,
  selectedEvents,
  events,
  onRole,
  onScope,
  onEvents,
}: {
  role: AdminRole;
  scope: AdminScope;
  selectedEvents: string[];
  events: EventOption[];
  onRole: (r: AdminRole) => void;
  onScope: (s: AdminScope) => void;
  onEvents: (ids: string[]) => void;
}) {
  const handleScopeChange = (next: AdminScope) => {
    onScope(next);
    // Owners can't be scoped — keep role/scope consistent.
    if (next !== "all" && role === "owner") onRole("editor");
  };
  const handleRoleChange = (next: AdminRole) => {
    onRole(next);
    if (next === "owner") onScope("all");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-charcoal/60">
            Rol
          </label>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
            className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal"
          >
            <option value="viewer">Viewer (solo lectura)</option>
            <option value="editor">Editor (lectura + escritura)</option>
            <option value="owner">Owner (acceso total + admin)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-charcoal/60">
            Alcance
          </label>
          <select
            value={scope}
            disabled={role === "owner"}
            onChange={(e) => handleScopeChange(e.target.value as AdminScope)}
            className="rounded-lg border border-sage/30 bg-white px-3 py-1.5 text-sm text-charcoal disabled:opacity-50"
          >
            <option value="all">Todos los eventos</option>
            <option value="scoped">Eventos específicos</option>
          </select>
        </div>
      </div>

      {scope === "scoped" && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-charcoal/60">
            Eventos asignados
          </label>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-sage/20 bg-white p-2">
            {events.length === 0 ? (
              <p className="text-xs text-charcoal/40">Sin eventos.</p>
            ) : (
              events.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-sage/10"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(e.id)}
                    onChange={(ev) => {
                      if (ev.target.checked) {
                        onEvents([...selectedEvents, e.id]);
                      } else {
                        onEvents(selectedEvents.filter((x) => x !== e.id));
                      }
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-charcoal/80">
                    {e.name}
                  </span>
                  <span className="text-[10px] text-charcoal/40">
                    {e.date.slice(0, 10)}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleChip({ role }: { role: AdminRole }) {
  const cls =
    role === "owner"
      ? "bg-forest text-cream"
      : role === "editor"
        ? "bg-terracotta/20 text-terracotta"
        : "bg-sage/20 text-forest";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {role}
    </span>
  );
}

function ScopeChip({ scope, count }: { scope: AdminScope; count: number }) {
  if (scope === "all") {
    return (
      <span className="rounded-full border border-sage/30 px-2 py-0.5 text-[10px] text-charcoal/60">
        Todos los eventos
      </span>
    );
  }
  return (
    <span className="rounded-full border border-sage/30 px-2 py-0.5 text-[10px] text-charcoal/60">
      {count} {count === 1 ? "evento" : "eventos"} asignado{count === 1 ? "" : "s"}
    </span>
  );
}
