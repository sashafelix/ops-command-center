import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { requireFreshAuth } from "../reauth";
import { appendAuditEvent } from "../audit-append";

const Decision = z.enum(["approve", "deny", "edit", "snooze"]);

export const approvalsRouter = router({
  /** The full Approvals tab payload. */
  inbox: protectedProcedure.query(() => mockStore.approvals),

  /**
   * Optimistic mutation entry point. Phase 2 simply removes the row from the
   * queue and prepends a verdict. Phase 4 writes a real audit event and a
   * re-auth gate per HANDOFF §4.
   */
  decide: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        decision: Decision,
        edited_command: z.string().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      requireFreshAuth(ctx);
      const idx = mockStore.approvals.queue.findIndex((a) => a.id === input.id);
      if (idx < 0) throw new TRPCError({ code: "NOT_FOUND" });
      const [row] = mockStore.approvals.queue.splice(idx, 1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const verdictByDecision = {
        approve: "approved",
        deny: "denied",
        edit: "edited",
        snooze: "expired",
      } as const;

      mockStore.approvals.recent.unshift({
        id: row.id,
        verdict: verdictByDecision[input.decision],
        by: ctx.session.user.email ?? "unknown",
        when: "just now",
        what: input.edited_command ?? row.command.slice(0, 60),
        session_id: row.session_id,
      });
      mockStore.approvals.recent = mockStore.approvals.recent.slice(0, 8);
      mockStore.approvals.counts.pending = Math.max(0, mockStore.approvals.counts.pending - 1);
      mockStore.navBadges.approvals = Math.max(0, (mockStore.navBadges.approvals ?? 0) - 1);

      appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: `approval.${input.decision}`,
        target: `approval/${row.id}`,
      });

      return { id: row.id, decision: input.decision };
    }),
});
