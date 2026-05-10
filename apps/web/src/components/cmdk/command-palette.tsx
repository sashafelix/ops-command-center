"use client";

import { Command } from "cmdk";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ALL_DESTINATIONS } from "@/components/shell/nav-config";
import { readRecents, pushRecent, type Recent } from "./recents-store";
import { toggleTheme } from "@/lib/theme";

type Ctx = { open: () => void; close: () => void; isOpen: boolean };
const CmdKCtx = createContext<Ctx | null>(null);

export function useCommandPalette(): Ctx {
  const ctx = useContext(CmdKCtx);
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return ctx;
}

const URL_FLAG = "cmdk";
const URL_QUERY = "q";

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setRecents(readRecents());
  }, [isOpen]);

  const setUrl = useCallback(
    (open: boolean, q = "") => {
      const url = new URL(window.location.href);
      if (open) {
        url.searchParams.set(URL_FLAG, "1");
        if (q) url.searchParams.set(URL_QUERY, q);
        else url.searchParams.delete(URL_QUERY);
      } else {
        url.searchParams.delete(URL_FLAG);
        url.searchParams.delete(URL_QUERY);
      }
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    },
    [router],
  );

  const open = useCallback(() => setUrl(true, ""), [setUrl]);
  const close = useCallback(() => setUrl(false, ""), [setUrl]);
  const ctx = useMemo<Ctx>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  const onQueryChange = useCallback(
    (next: string) => {
      setQuery(next);
      setUrl(true, next);
    },
    [setUrl],
  );

  const navigate = useCallback(
    (item: { id: string; label: string; href: string }) => {
      setRecents(pushRecent({ id: item.id, label: item.label, href: item.href }));
      close();
      router.push(item.href);
    },
    [close, router],
  );

  return (
    <CmdKCtx.Provider value={ctx}>
      {children}
      <Suspense fallback={null}>
        <UrlSync
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          setQuery={setQuery}
        />
      </Suspense>
      <KeyboardShortcuts isOpen={isOpen} open={open} close={close} pathname={pathname} />
      {isOpen && (
        <PaletteOverlay
          query={query}
          onQueryChange={onQueryChange}
          onSelect={navigate}
          onClose={close}
          recents={recents}
        />
      )}
    </CmdKCtx.Provider>
  );
}

/**
 * Reads the ?cmdk=1&q=... URL state. Isolated in its own component so it can
 * be wrapped in <Suspense>, allowing parent pages to stay statically renderable
 * (per Next 14 useSearchParams() docs).
 */
function UrlSync({
  isOpen,
  setIsOpen,
  setQuery,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  setQuery: (v: string) => void;
}) {
  const search = useSearchParams();
  useEffect(() => {
    const flag = search.get(URL_FLAG);
    if (flag === "1") {
      setIsOpen(true);
      setQuery(search.get(URL_QUERY) ?? "");
    } else if (isOpen) {
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  return null;
}

function PaletteOverlay({
  query,
  onQueryChange,
  onSelect,
  onClose,
  recents,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (item: { id: string; label: string; href: string }) => void;
  onClose: () => void;
  recents: Recent[];
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden />
      <div
        className="relative w-full max-w-xl panel animate-appear"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" loop className="w-full">
          <div className="border-b">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={onQueryChange}
              placeholder="Type a command or search…"
              className="w-full bg-transparent px-4 py-3 text-13 text-fg placeholder:text-fg-faint outline-none"
            />
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-12 text-fg-muted">
              Nothing matches. Try a destination, action, or session id.
            </Command.Empty>

            {recents.length > 0 && !query && (
              <Command.Group heading="Recent" className="text-fg-faint">
                {recents.map((r) => (
                  <Item
                    key={`recent-${r.id}`}
                    label={r.label}
                    onSelect={() => onSelect(r)}
                  />
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Navigate">
              {ALL_DESTINATIONS.map((d) => (
                <Item
                  key={`nav-${d.id}`}
                  label={`Go to ${d.label}`}
                  shortcut={d.shortcut ? String(d.shortcut) : undefined}
                  onSelect={() => onSelect({ id: d.id, label: d.label, href: d.href })}
                />
              ))}
            </Command.Group>

            <Command.Group heading="View">
              <Item
                label="Toggle theme"
                shortcut="T"
                onSelect={() => {
                  toggleTheme();
                  onClose();
                }}
              />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  label,
  shortcut,
  onSelect,
}: {
  label: string;
  shortcut?: string | undefined;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-4 py-2 text-12 text-fg-muted aria-selected:bg-white/[0.06] aria-selected:text-fg cursor-pointer"
    >
      <span className="flex-1">{label}</span>
      {shortcut && <span className="kbd">{shortcut}</span>}
    </Command.Item>
  );
}

function KeyboardShortcuts({
  isOpen,
  open,
  close,
  pathname,
}: {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  pathname: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K — open palette anywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) close();
        else open();
        return;
      }

      // Esc — close palette (also handled by overlay click)
      if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          close();
        }
        return;
      }

      // Single-key shortcuts only when not typing and palette closed
      if (isOpen) return;
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 1–8 → first 8 destinations
      if (e.key >= "1" && e.key <= "8") {
        const n = Number(e.key);
        const dest = ALL_DESTINATIONS.find((d) => d.shortcut === n);
        if (dest) {
          e.preventDefault();
          router.push(dest.href);
        }
        return;
      }

      // T → toggle theme
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // ? → help (placeholder for Phase 4 help drawer)
      if (e.key === "?") {
        e.preventDefault();
        // TODO Phase 4: open help drawer
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, open, close, router]);

  // Reset scroll on tab switch (HANDOFF acceptance)
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
