"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PersonSuggestion {
  id: number;
  email: string | null;
  name: string;
}

/**
 * Email input with a dropdown of existing community members that match
 * the typed prefix. Hits /api/admin/people/search (owner-only, so this
 * component should only appear in owner-gated admin surfaces).
 *
 * Controlled component — parent owns the email string. Selection from
 * the dropdown sets the email; free-typing is also allowed so the parent
 * can decide how to handle an unknown address (the link API currently
 * rejects unknown emails with a 400).
 */
export default function PersonEmailAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<PersonSuggestion[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce keystrokes so we don't fire a request per character. 200ms
  // matches what feels snappy without hammering the endpoint.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/people/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const d = (await res.json()) as { people: PersonSuggestion[] };
        setSuggestions(d.people ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  // Close the dropdown on outside click — covers both mouse and touch.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleSelect = useCallback(
    (email: string) => {
      onChange(email);
      setOpen(false);
    },
    [onChange],
  );

  const showDropdown =
    open && value.trim().length >= 2 && suggestions !== null;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="email"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={
          className ??
          "w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
        }
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-sage/30 bg-white shadow-lg">
          {loading && suggestions && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-charcoal/40">Buscando…</p>
          ) : suggestions && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-charcoal/40">
              Sin resultados — podés escribir el email igual.
            </p>
          ) : (
            <ul>
              {(suggestions ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => p.email && handleSelect(p.email)}
                    disabled={!p.email}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-sage/10 disabled:opacity-50"
                  >
                    <span className="font-medium text-charcoal">{p.name}</span>
                    <span className="text-[11px] text-charcoal/60">
                      {p.email ?? "(sin email)"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
