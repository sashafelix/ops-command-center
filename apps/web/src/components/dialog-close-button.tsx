"use client";

import { X } from "lucide-react";

/**
 * Absolute-positioned close affordance for modal panels.
 *
 * Place inside a `.relative` container (modal `panel` already qualifies).
 * Pins to the top-right corner with a visible resting state (panel2
 * background) so the button reads as a button rather than decoration —
 * the previous design used no background + muted-foreground colour, which
 * made the X effectively invisible on most surfaces.
 */
export function DialogCloseButton({
  onClick,
  label = "Close",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Esc"
      className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded panel2 text-fg-muted hover:text-fg hover:border-line2 transition-colors"
    >
      <X size={14} aria-hidden />
    </button>
  );
}
