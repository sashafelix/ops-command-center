"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Modal shell for the intercepted /sessions/[id] route. Esc closes via
 * router.back(). Clicking the backdrop also closes; the inner panel swallows
 * clicks. Per HANDOFF: full-bleed, preserves the underlying tab.
 */
export function OverlayShell({ id, children }: { id: string; children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        router.back();
      }
    }
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Session ${id}`}
      className="fixed inset-0 z-40 flex items-start justify-center pt-12 px-6 pb-6 animate-appear"
      onClick={() => router.back()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden />
      <div
        className="relative w-full max-w-content panel max-h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/5 rounded z-10"
          aria-label="Close session"
          title="Esc"
        >
          <X size={16} aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
