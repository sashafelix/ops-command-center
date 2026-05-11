import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { ingestHandler } from "../_runner";
import { notify } from "@/server/pg-notify";

const Input = z.object({
  id: z.string().optional(),
  session_id: z.string(),
  t_offset_ms: z.number().int().nonnegative(),
  kind: z.string(),
  name: z.string(),
  cost_usd: z.number().nonnegative().default(0),
  latency_ms: z.number().int().nonnegative().default(0),
  note: z.string().optional(),
  signed: z.boolean().default(false),
  sig_key_id: z.string().optional(),
});

export const POST = ingestHandler({
  scope: "tool-calls.write",
  input: Input,
  handle: async (i) => {
    const id = i.id ?? `tc_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    // Content hash for the tool call body — used by the evidence chain later.
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          session_id: i.session_id,
          t_offset_ms: i.t_offset_ms,
          kind: i.kind,
          name: i.name,
          note: i.note ?? "",
        }),
      )
      .digest("hex");

    const cost_usd = i.cost_usd ?? 0;
    const latency_ms = i.latency_ms ?? 0;
    const signed = i.signed ?? false;
    await db.insert(schema.tool_calls).values({
      id,
      session_id: i.session_id,
      t_offset_ms: i.t_offset_ms,
      kind: i.kind,
      name: i.name,
      cost_usd,
      latency_ms,
      note: i.note ?? null,
      signed,
      sig_key_id: i.sig_key_id ?? null,
      hash,
    });
    // Bump the session's running tool_call counter + cost
    await db
      .update(schema.sessions)
      .set({
        tool_calls: sql`${schema.sessions.tool_calls} + 1`,
        cost_usd: sql`${schema.sessions.cost_usd} + ${cost_usd}`,
        updated_at: new Date(),
      })
      .where(eq(schema.sessions.id, i.session_id));

    await notify("sessions", { kind: "tool-call", session_id: i.session_id, id });

    return { ok: true, id, hash };
  },
});
