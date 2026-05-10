import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { isReauthFresh, markReauth, REAUTH_WINDOW_MS } from "../reauth";

export const authRouter = router({
  /** Returns whether the caller currently has a fresh re-auth marker. */
  reauthStatus: protectedProcedure.query(({ ctx }) => ({
    fresh: isReauthFresh(ctx.session?.user?.email),
    window_ms: REAUTH_WINDOW_MS,
  })),

  /**
   * Phase 4 mock: trusts the existing session and stamps a fresh-auth marker.
   * Phase 5 ramps this up to a real OIDC re-prompt before returning.
   */
  reauthConfirm: protectedProcedure.mutation(({ ctx }) => {
    if (!ctx.session?.user?.email) throw new TRPCError({ code: "UNAUTHORIZED" });
    markReauth(ctx.session.user.email);
    return { fresh: true };
  }),
});
