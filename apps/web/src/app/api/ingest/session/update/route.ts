import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ingestHandler } from "../../_runner";
import { notify } from "@/server/pg-notify";

const Input = z.object({
  id: z.string(),
  runtime_s: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
  tokens_in: z.number().int().nonnegative().optional(),
  tokens_out: z.number().int().nonnegative().optional(),
  tool_calls: z.number().int().nonnegative().optional(),
  trust_score: z.number().min(0).max(1).optional(),
  status: z.enum(["ok", "warn", "bad", "idle"]).optional(),
  step: z.string().optional(),
});

export const POST = ingestHandler({
  scope: "sessions.write",
  input: Input,
  handle: async (i) => {
    const set: Record<string, unknown> = { updated_at: new Date() };
    if (i.runtime_s !== undefined) set.runtime_s = i.runtime_s;
    if (i.cost_usd !== undefined) set.cost_usd = i.cost_usd;
    if (i.tokens_in !== undefined) set.tokens_in = i.tokens_in;
    if (i.tokens_out !== undefined) set.tokens_out = i.tokens_out;
    if (i.tool_calls !== undefined) set.tool_calls = i.tool_calls;
    if (i.trust_score !== undefined) set.trust_score = i.trust_score;
    if (i.status !== undefined) set.status = i.status;
    if (i.step !== undefined) {
      // Patch the step into the extra blob without clobbering siblings.
      set.extra = (
        await db.select({ e: schema.sessions.extra }).from(schema.sessions).where(eq(schema.sessions.id, i.id))
      )[0]?.e ?? {};
      (set.extra as Record<string, unknown>).step = i.step;
    }

    const updated = await db
      .update(schema.sessions)
      .set(set)
      .where(eq(schema.sessions.id, i.id))
      .returning({ id: schema.sessions.id });
    if (updated.length === 0) {
      return { status: 404, body: { error: "unknown_session" } };
    }

    // Lightweight tick payload for the live-board WS subscribers
    await notify("sessions", {
      kind: "updated",
      id: i.id,
      runtime_s: i.runtime_s,
      cost_usd: i.cost_usd,
      trust_score: i.trust_score,
      status: i.status,
    });

    return { ok: true };
  },
});
