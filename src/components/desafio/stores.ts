"use client";

/**
 * Browser-only state of the desafío page, read with useSyncExternalStore so
 * the server render and the first client render agree (no progress, inicio)
 * and the real values arrive right after hydration — no mismatch, no
 * setState-in-effect.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  COMPLETADOS_STORAGE_KEY,
  parseCompletados,
  parseRouteHash,
  routeHash,
  type DesafioRoute,
} from "@/lib/desafio-progress";

// ============================================================
// Progress (localStorage)
// ============================================================

const progressListeners = new Set<() => void>();
/**
 * What this tab last wrote. Wins over storage so progress still works for
 * the session when storage is unavailable (blocked, private mode, quota).
 */
let memoryValue: string | null = null;

function readProgress(): string {
  if (memoryValue !== null) return memoryValue;
  try {
    return window.localStorage.getItem(COMPLETADOS_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeProgress(cb: () => void): () => void {
  progressListeners.add(cb);
  // Another tab marked a day: forget our copy and re-read.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== COMPLETADOS_STORAGE_KEY) return;
    memoryValue = null;
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    progressListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompletados(): [number[], (next: number[]) => void] {
  const raw = useSyncExternalStore(subscribeProgress, readProgress, () => "[]");
  const done = useMemo(() => parseCompletados(raw), [raw]);
  const setDone = useCallback((next: number[]) => {
    memoryValue = JSON.stringify(next);
    try {
      window.localStorage.setItem(COMPLETADOS_STORAGE_KEY, memoryValue);
    } catch {
      // Storage unavailable: memoryValue keeps it for this session.
    }
    progressListeners.forEach((l) => l());
  }, []);
  return [done, setDone];
}

// ============================================================
// Route (location.hash)
// ============================================================

const routeListeners = new Set<() => void>();

function subscribeRoute(cb: () => void): () => void {
  routeListeners.add(cb);
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    routeListeners.delete(cb);
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

function urlFor(route: DesafioRoute): string {
  return window.location.pathname + window.location.search + routeHash(route);
}

/** Push a route as a history entry (so the back button walks the screens). */
export function navigate(route: DesafioRoute): void {
  window.history.pushState(window.history.state, "", urlFor(route));
  routeListeners.forEach((l) => l());
}

/** Rewrite the current entry, e.g. to drop a hash that can't be shown. */
export function replaceRoute(route: DesafioRoute): void {
  window.history.replaceState(window.history.state, "", urlFor(route));
  routeListeners.forEach((l) => l());
}

export function useRequestedRoute(): DesafioRoute {
  const hash = useSyncExternalStore(
    subscribeRoute,
    () => window.location.hash,
    () => "",
  );
  return useMemo(() => parseRouteHash(hash), [hash]);
}
