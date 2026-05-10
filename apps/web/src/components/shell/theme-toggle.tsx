"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  // Mount-only — bootstrap script already set the class.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => setTheme(currentTheme()), []);

  return (
    <button
      type="button"
      title="Toggle theme (T)"
      aria-label="Toggle theme"
      onClick={() => setTheme(toggleTheme())}
      className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-[var(--hover)] rounded"
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
