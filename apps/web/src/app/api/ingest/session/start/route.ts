import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ingestHandler } from "../../_runner";
import { notify } from "@/server/pg-notify";

const Input = z.object({
  id: z.string(),
  agent_version: z.string(),
  model: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  goal: z.string(),
  operator: z.string(),
  started_at: z.string().datetime({ offset: true }).optional(),
});

export const POST = ingestHandler({
  scope: "sessions.write",
  input: Input,
  handle: async (i) => {
    const started_at = i.started_at ? new Date(i.started_at) : new Date();
    await db
      .insert(schema.sessions)
      .values({
        id: i.id,
        agent_version: i.agent_version,
        model: i.model,
        repo: i.repo,
        branch: i.branch ?? null,
        goal: i.goal,
        operator: i.operator,
        started_at,
        runtime_s: 0,
        cost_usd: 0,
        tokens_in: 0,
        tokens_out: 0,
        tool_calls: 0,
        trust_score: 1,
        status: "ok",
        outcome: "in-progress",
      })
      .onConflictDoUpdate({
        target: schema.sessions.id,
        set: {
          agent_version: i.agent_version,
          model: i.model,
          repo: i.repo,
          branch: i.branch ?? null,
          goal: i.goal,
          operator: i.operator,
          started_at,
        },
      });

    await notify("sessions", { kind: "started", id: i.id });

    const [row] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, i.id));
    return { ok: true, session: row };
  },
});
