import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ingestHandler } from "../../_runner";
import { recomputeLiveBoard, recomputeLiveKpi } from "@/server/kv-recompute";
import { notify } from "@/server/pg-notify";

const Input = z.object({
  id: z.string(),
  outcome: z.enum(["success", "aborted", "failed"]),
  runtime_s: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
  trust_score: z.number().min(0).max(1).optional(),
});

export const POST = ingestHandler({
  scope: "sessions.write",
  input: Input,
  handle: async (i) => {
    const set: Record<string, unknown> = {
      outcome: i.outcome,
      status: i.outcome === "success" ? "ok" : "bad",
      updated_at: new Date(),
    };
    if (i.runtime_s !== undefined) set.runtime_s = i.runtime_s;
    if (i.cost_usd !== undefined) set.cost_usd = i.cost_usd;
    if (i.trust_score !== undefined) set.trust_score = i.trust_score;

    const updated = await db
      .update(schema.sessions)
      .set(set)
      .where(eq(schema.sessions.id, i.id))
      .returning({ id: schema.sessions.id });
    if (updated.length === 0) {
      return { status: 404, body: { error: "unknown_session" } };
    }

    await Promise.all([recomputeLiveKpi(), recomputeLiveBoard()]);
    await notify("sessions", { kind: "ended", id: i.id, outcome: i.outcome });

    return { ok: true };
  },
});
