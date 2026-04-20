"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

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
 *
 * Supports keyboard navigation: ↑/↓ move the active option, Enter
 * selects, Esc closes. Announces the listbox via ARIA combobox roles.
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
  const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Debounce keystrokes so we don't fire a request per character. 200ms
  // matches what feels snappy without hammering the endpoint. Each run
  // owns an AbortController so late-arriving responses from stale
  // queries never overwrite the current suggestion list.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/people/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const d = (await res.json()) as { people: PersonSuggestion[] };
        setSuggestions(d.people ?? []);
        setActiveIndex(-1);
      } catch (err) {
        // AbortError is expected when a newer keystroke supersedes this
        // request — leave existing suggestions as-is and let the new
        // request own the next render.
        if ((err as { name?: string }).name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
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
      setActiveIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === "ArrowDown") {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const n = suggestions.length;
          if (n === 0) return -1;
          return i < n - 1 ? i + 1 : 0;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const n = suggestions.length;
          if (n === 0) return -1;
          return i <= 0 ? n - 1 : i - 1;
        });
      } else if (e.key === "Enter" && activeIndex >= 0) {
        const picked = suggestions[activeIndex];
        if (picked?.email) {
          e.preventDefault();
          handleSelect(picked.email);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
    },
    [activeIndex, handleSelect, open, suggestions],
  );

  const showDropdown = open && value.trim().length >= 2;
  const activeDescendantId =
    activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

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
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendantId}
        className={
          className ??
          "w-full rounded-lg border border-sage/30 bg-white px-3 py-2 text-sm text-charcoal placeholder-charcoal/30"
        }
      />
      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-sage/30 bg-white shadow-lg"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-charcoal/40">Buscando…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-charcoal/40">
              Sin resultados — podés escribir el email igual.
            </p>
          ) : (
            <ul>
              {suggestions.map((p, i) => {
                const isActive = i === activeIndex;
                return (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      id={`${listboxId}-opt-${i}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(e) => {
                        // mousedown (not click) so the input's onBlur
                        // can't race the selection and close the list
                        // before the button handler runs.
                        e.preventDefault();
                      }}
                      onClick={() => p.email && handleSelect(p.email)}
                      onMouseEnter={() => setActiveIndex(i)}
                      disabled={!p.email}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm disabled:opacity-50 ${
                        isActive ? "bg-sage/15" : "hover:bg-sage/10"
                      }`}
                    >
                      <span className="font-medium text-charcoal">{p.name}</span>
                      <span className="text-[11px] text-charcoal/60">
                        {p.email ?? "(sin email)"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
