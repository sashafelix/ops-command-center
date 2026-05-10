import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Some happy-dom / jsdom builds expose `window.localStorage` without a
 * functioning `clear()` — replace with a clean in-memory store before each test.
 */
function installMemoryStorage(): void {
  if (typeof window === "undefined") return;
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage,
  });
}

beforeEach(installMemoryStorage);

afterEach(() => {
  cleanup();
  installMemoryStorage();
});
