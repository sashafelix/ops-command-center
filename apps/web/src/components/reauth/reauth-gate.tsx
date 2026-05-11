"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

type Resolver = (ok: boolean) => void;

type Ctx = {
  /**
   * Wraps a destructive action. Returns `true` if the action may proceed
   * (i.e. fresh auth confirmed); `false` if the user declined.
   */
  requireFreshAuth: (purpose: string) => Promise<boolean>;
};

const ReauthCtx = createContext<Ctx | null>(null);

export function useReauthGate(): Ctx {
  const ctx = useContext(ReauthCtx);
  if (!ctx) throw new Error("useReauthGate must be used inside <ReauthGate>");
  return ctx;
}

export function ReauthGate({ children }: { children: ReactNode }) {
  // The freshness window is 5 min; check at half that so we re-verify roughly
  // once per session. Stops the redundant tRPC fire on every page mount.
  const status = trpc.auth.reauthStatus.useQuery(undefined, { staleTime: 150_000 });
  const utils = trpc.useUtils();
  const confirm = trpc.auth.reauthConfirm.useMutation({
    onSuccess: () => void utils.auth.reauthStatus.invalidate(),
  });

  const [purpose, setPurpose] = useState<string | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const requireFreshAuth = useCallback(
    (p: string) => {
      if (status.data?.fresh) return Promise.resolve(true);
      setPurpose(p);
      return new Promise<boolean>((resolve) => setResolver(() => resolve));
    },
    [status.data?.fresh],
  );

  const close = (ok: boolean) => {
    resolver?.(ok);
    setResolver(null);
    setPurpose(null);
  };

  const onConfirm = async () => {
    await confirm.mutateAsync();
    close(true);
  };

  return (
    <ReauthCtx.Provider value={{ requireFreshAuth }}>
      {children}
      {purpose && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm fresh authentication"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden onClick={() => close(false)} />
          <div className="relative panel w-full max-w-sm p-6 animate-appear">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-violet" aria-hidden />
              <h2 className="text-13 font-semibold text-fg">Confirm it&apos;s you</h2>
            </div>
            <p className="text-12 text-fg-muted">
              {purpose}
            </p>
            <p className="text-11 text-fg-faint mt-2">
              Destructive actions require a fresh authentication within the last 5 minutes.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => close(false)}
                className="h-8 px-3 panel2 text-12 text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirm.isPending}
                className="h-8 px-3 ml-auto panel2 hover:border-line2 text-12 text-fg flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck size={12} aria-hidden />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ReauthCtx.Provider>
  );
}
