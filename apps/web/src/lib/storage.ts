/** Typed localStorage helpers. SSR-safe — no-op on server. */

export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled — silently noop */
  }
}

export function lsRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Storage keys used across the app. Centralised so we can audit them in one place. */
export const StorageKeys = {
  theme: "ops.theme",
  sidebarCollapsed: "ops.sidebar.collapsed",
  cmdkRecents: "ops.cmdk.recents",
  lastTab: "ops.tab.last",
} as const;
