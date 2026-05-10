import { z } from "zod";
import { StatusTone } from "./common";

export const Service = z.object({
  id: z.string(),
  name: z.string(),
  stack: z.string(),
  region: z.string(),
  replicas: z.string(),
  cpu_pct: z.number().min(0).max(1),
  mem_pct: z.number().min(0).max(1),
  rps: z.number().nonnegative(),
  error_pct: z.number().min(0).max(1),
  p95_ms: z.number().nonnegative(),
  status: StatusTone,
  reason: z.string().optional(),
});
export type Service = z.infer<typeof Service>;
