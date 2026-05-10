import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { appendAuditEvent } from "../audit-append";
import { requireFreshAuth } from "../reauth";

export const settingsRouter = router({
  overview: protectedProcedure.query(() => mockStore.settings),

  /** Admin-only — destructive workspace config touches secrets. */
  toggleWebhook: adminProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input, ctx }) => {
      requireFreshAuth(ctx);
      const wh = mockStore.settings.webhooks.find((w) => w.id === input.id);
      if (wh) wh.status = input.enabled ? "ok" : "warn";
      appendAuditEvent({
        actor: ctx.session.user.email ?? "unknown",
        role: "admin",
        action: "webhook.toggle",
        target: `webhook/${input.id}`,
      });
      return { id: input.id, enabled: input.enabled };
    }),
});
