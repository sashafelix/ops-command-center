import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";
import { appendAuditEvent } from "../audit-append";
import { requireFreshAuth } from "../reauth";

export const settingsRouter = router({
  overview: protectedProcedure.query(() => mockStore.settings),

  /** Toggle a webhook on/off. Destructive — re-auth gate + audit. */
  toggleWebhook: protectedProcedure
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
