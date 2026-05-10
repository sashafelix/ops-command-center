import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Role } from "@ops/shared";
import type { Context } from "./context";
import { hasRole } from "./rbac";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Procedure that requires an authenticated session. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Procedure factory: requires `min` role or higher per RBAC hierarchy. */
function requireRole(min: Role) {
  return t.procedure.use(({ ctx, next }) => {
    if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!hasRole(ctx.session.user.role, min)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `RBAC: requires ${min}, have ${ctx.session.user.role}`,
      });
    }
    return next({ ctx: { ...ctx, session: ctx.session } });
  });
}

export const analystProcedure = requireRole("analyst");
export const sreProcedure = requireRole("sre");
export const adminProcedure = requireRole("admin");
