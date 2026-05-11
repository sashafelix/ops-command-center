import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db/client";
import { ingestHandler } from "../_runner";
import { recomputeApprovalsCounts } from "@/server/kv-recompute";
import { notify } from "@/server/pg-notify";

const Input = z.object({
  id: z.string().optional(),
  session_id: z.string(),
  severity: z.enum(["low", "med", "high"]),
  policy_id: z.string(),
  command: z.string(),
  justification: z.string(),
  blast_radius: z.string(),
  auto_deny_in_s: z.number().int().positive().max(60 * 60 * 24).default(60 * 5),
  agent: z.string().optional(),
  action: z.string().optional(),
  goal: z.string().optional(),
  requires: z.number().int().positive().default(1),
  of: z.number().int().positive().default(1),
});

export const POST = ingestHandler({
  scope: "approvals.write",
  input: Input,
  handle: async (i) => {
    const id = i.id ?? `apr_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const auto_deny_in_s = i.auto_deny_in_s ?? 60 * 5;
    const auto_deny_at = new Date(Date.now() + auto_deny_in_s * 1000);

    await db.insert(schema.approvals).values({
      id,
      session_id: i.session_id,
      severity: i.severity,
      policy_id: i.policy_id,
      command: i.command,
      justification: i.justification,
      blast_radius: i.blast_radius,
      auto_deny_at,
      extra: {
        agent: i.agent ?? "",
        action: i.action ?? "",
        goal: i.goal ?? "",
        requires: i.requires,
        of: i.of,
      },
    });

    await recomputeApprovalsCounts();
    await notify("notifications", { kind: "approval.request", id, severity: i.severity });

    return { ok: true, id, auto_deny_at: auto_deny_at.toISOString() };
  },
});
