import type { Config } from "tailwindcss";

/**
 * Tokens are defined as CSS variables in src/styles/tokens.css and surfaced here
 * with the `<alpha-value>` modifier so Tailwind's `/opacity` syntax works.
 * Lifted verbatim from Reference_Folder/Ops Dashboard.html.
 */
const config: Config = {
  darkMode: ["class", '[class~="theme-dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "rgb(var(--ink-0) / <alpha-value>)",
          1: "rgb(var(--ink-1) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
          4: "rgb(var(--ink-4) / <alpha-value>)",
          5: "rgb(var(--ink-5) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        line2: "rgb(var(--line2) / <alpha-value>)",
        line3: "rgb(var(--line3) / <alpha-value>)",
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
          dim: "rgb(var(--fg-dim) / <alpha-value>)",
          faint: "rgb(var(--fg-faint) / <alpha-value>)",
        },
        ok: "rgb(var(--ok) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        violet: "rgb(var(--violet) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "Inter", "system-ui", "sans-serif"],
        mono: ['var(--font-geist-mono)', "Geist Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "10": ["10px", { lineHeight: "14px" }],
        "11": ["11px", { lineHeight: "16px" }],
        "12": ["12px", { lineHeight: "16px" }],
        "13": ["13px", { lineHeight: "18px" }],
      },
      maxWidth: {
        content: "1480px",
      },
      keyframes: {
        breathe: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.78)" },
        },
        ringpulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(63,183,122,0.45)" },
          "70%": { boxShadow: "0 0 0 8px rgba(63,183,122,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(63,183,122,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-300px 0" },
          "100%": { backgroundPosition: "300px 0" },
        },
        appear: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 2.6s ease-in-out infinite",
        ringpulse: "ringpulse 2.6s ease-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        appear: "appear 240ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
