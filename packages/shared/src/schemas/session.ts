import { z } from "zod";
import { Iso } from "./common";

export const SessionStatus = z.enum(["ok", "warn", "bad", "idle"]);
export const SessionOutcome = z.enum(["in-progress", "success", "aborted", "failed"]);

export const ToolCallRef = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
});

export const Session = z.object({
  id: z.string(),
  agent_version: z.string(),
  model: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  goal: z.string(),
  operator: z.string(),
  started_at: Iso,
  runtime_s: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  tool_calls: z.number().int().nonnegative(),
  trust_score: z.number().min(0).max(1),
  status: SessionStatus,
  outcome: SessionOutcome,
  current_step: ToolCallRef.optional(),
});
export type Session = z.infer<typeof Session>;
