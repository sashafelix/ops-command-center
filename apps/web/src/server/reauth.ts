import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Context } from "./context";

export const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export async function isReauthFresh(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const [row] = await db
    .select({ fresh_until: schema.reauth_markers.fresh_until })
    .from(schema.reauth_markers)
    .where(eq(schema.reauth_markers.email, email));
  if (!row) return false;
  return row.fresh_until.getTime() > Date.now();
}

export async function markReauth(email: string): Promise<void> {
  const fresh_until = new Date(Date.now() + REAUTH_WINDOW_MS);
  await db
    .insert(schema.reauth_markers)
    .values({ email, fresh_until })
    .onConflictDoUpdate({
      target: schema.reauth_markers.email,
      set: { fresh_until },
    });
}

/**
 * Authenticated context — returned by `requireFreshAuth` so callers get the
 * narrowed session without having to repeat the null check.
 */
export type AuthedContext = Context & { session: NonNullable<Context["session"]> };

/**
 * Throws UNAUTHORIZED if no session, FORBIDDEN/REAUTH_REQUIRED if the
 * fresh-auth marker has expired. Returns the narrowed context so the caller
 * can use `ctx.session.user` without further checks.
 *
 * Async assertion signatures aren't supported by TypeScript yet — we return
 * the narrowed value instead.
 */
export async function requireFreshAuth(ctx: Context): Promise<AuthedContext> {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!(await isReauthFresh(ctx.session.user.email))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "REAUTH_REQUIRED" });
  }
  return ctx as AuthedContext;
}
