import { z } from "zod";

export const ToolCall = z.object({
  id: z.string(),
  session_id: z.string(),
  t_offset_ms: z.number().int().nonnegative(),
  kind: z.string(),
  name: z.string(),
  cost_usd: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  note: z.string().optional(),
  signed: z.boolean(),
  sig_key_id: z.string().optional(),
  hash: z.string(),
});
export type ToolCall = z.infer<typeof ToolCall>;
