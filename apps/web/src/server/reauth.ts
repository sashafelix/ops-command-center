import { TRPCError } from "@trpc/server";
import { mockStore } from "./mock/store";
import type { Context } from "./context";

export const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export function isReauthFresh(email: string | null | undefined): boolean {
  if (!email) return false;
  const ts = mockStore.reauth[email];
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < REAUTH_WINDOW_MS;
}

export function markReauth(email: string): void {
  mockStore.reauth[email] = new Date().toISOString();
}

export function requireFreshAuth(ctx: Context): asserts ctx is Context & { session: NonNullable<Context["session"]> } {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!isReauthFresh(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "REAUTH_REQUIRED",
    });
  }
}
