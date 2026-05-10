import { StorageKeys } from "./storage";

export type Theme = "light" | "dark";

/**
 * Inline script run in <head> before paint to avoid FOUC.
 * Reads ops.theme, falls back to prefers-color-scheme, defaults to dark.
 */
export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var k = ${JSON.stringify(StorageKeys.theme)};
    var stored = localStorage.getItem(k);
    var t = stored;
    if (t !== 'light' && t !== 'dark') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    var html = document.documentElement;
    html.classList.remove('theme-dark','theme-light');
    html.classList.add('theme-' + t);
    html.style.colorScheme = t;
  } catch (e) {}
})();
`.trim();

export function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.classList.remove("theme-dark", "theme-light");
  html.classList.add(`theme-${theme}`);
  html.style.colorScheme = theme;
  try {
    localStorage.setItem(StorageKeys.theme, theme);
  } catch {
    /* noop */
  }
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}
