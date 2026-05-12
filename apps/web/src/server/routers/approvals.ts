import { TRPCError } from "@trpc/server";
import { eq, isNull, desc, sql, and, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, sreProcedure, router } from "../trpc";
import { db, schema } from "@/db/client";
import { kvGet, kvSet } from "@/db/kv";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

const Decision = z.enum(["approve", "deny", "edit", "snooze"]);

type RecentVerdict = {
  id: string;
  verdict: "approved" | "denied" | "edited" | "expired";
  by: string;
  when: string;
  what: string;
  session_id: string;
};

type ApprovalCounts = { pending: number; autoApproved24h: number; blocked24h: number };

export const approvalsRouter = router({
  /** Inbox payload — pending queue + recent verdicts + policies + counts. */
  inbox: protectedProcedure.query(async () => {
    const since24h = sql`now() - interval '24 hours'`;
    const [queueRows, policyRows, recent, pending, autoApproved24h, blocked24h] =
      await Promise.all([
        db
          .select()
          .from(schema.approvals)
          .where(isNull(schema.approvals.decided_at))
          .orderBy(desc(schema.approvals.requested_at)),
        db.select().from(schema.policies).orderBy(schema.policies.name),
        kvGet<RecentVerdict[]>("approvals.recent", []),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.approvals)
          .where(isNull(schema.approvals.decided_at)),
        // Auto-approved = decided without a human approver in the last 24h.
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.approvals)
          .where(
            and(
              eq(schema.approvals.decision, "approve"),
              isNull(schema.approvals.approver_user_id),
              gte(schema.approvals.decided_at, since24h),
            ),
          ),
        // Blocked = denied or expired in the last 24h.
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.approvals)
          .where(
            and(
              inArray(schema.approvals.decision, ["deny", "expire"]),
              gte(schema.approvals.decided_at, since24h),
            ),
          ),
      ]);

    const counts: ApprovalCounts = {
      pending: pending[0]?.c ?? 0,
      autoApproved24h: autoApproved24h[0]?.c ?? 0,
      blocked24h: blocked24h[0]?.c ?? 0,
    };

    return {
      counts,
      queue: queueRows.map((r) => {
        const extra = (r.extra ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          severity: r.severity,
          policy: r.policy_id,
          agent: (extra.agent ?? "unknown") as string,
          session_id: r.session_id,
          goal: (extra.goal ?? "") as string,
          action: (extra.action ?? "") as string,
          command: r.command,
          justification: r.justification,
          blast_radius: r.blast_radius,
          auto_deny_at: r.auto_deny_at.toISOString(),
          requested_at: r.requested_at.toISOString(),
          requires: (extra.requires ?? 1) as number,
          of: (extra.of ?? 1) as number,
        };
      }),
      recent,
      policies: policyRows.map((p) => ({
        id: p.id,
        name: p.name,
        surface: p.surface,
        mode: p.mode,
        enabled: p.enabled,
      })),
    };
  }),

  /** SRE+ only. Re-auth + chain-correct audit row. */
  decide: sreProcedure
    .input(
      z.object({
        id: z.string(),
        decision: Decision,
        edited_command: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFreshAuth(ctx);

      const [row] = await db
        .select()
        .from(schema.approvals)
        .where(eq(schema.approvals.id, input.id));
      if (!row || row.decided_at) throw new TRPCError({ code: "NOT_FOUND" });

      const decisionMap = {
        approve: { decision: "approve" as const, verdict: "approved" as const },
        deny: { decision: "deny" as const, verdict: "denied" as const },
        edit: { decision: "edit" as const, verdict: "edited" as const },
        snooze: { decision: "expire" as const, verdict: "expired" as const },
      };
      const m = decisionMap[input.decision];
      const decided_at = new Date();

      await db
        .update(schema.approvals)
        .set({
          decided_at,
          decision: m.decision,
          approver_user_id: ctx.session.user.email ?? null,
          edited_command: input.edited_command ?? null,
        })
        .where(eq(schema.approvals.id, input.id));

      const recent = await kvGet<RecentVerdict[]>("approvals.recent", []);
      recent.unshift({
        id: row.id,
        verdict: m.verdict,
        by: ctx.session.user.email ?? "unknown",
        when: "just now",
        what: input.edited_command ?? row.command.slice(0, 60),
        session_id: row.session_id,
      });
      await kvSet("approvals.recent", recent.slice(0, 8));

      await appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: `approval.${input.decision}`,
        target: `approval/${row.id}`,
      });

      return { id: row.id, decision: input.decision };
    }),
});
