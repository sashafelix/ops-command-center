import { z } from "zod";

export const EvalRun = z.object({
  id: z.string(),
  pass_rate: z.number().min(0).max(1),
  ran_at: z.string(),
});

export const EvalSuite = z.object({
  id: z.string(),
  name: z.string(),
  pass_rate: z.number().min(0).max(1),
  baseline_pass_rate: z.number().min(0).max(1),
  flake_rate: z.number().min(0).max(1),
  last_runs: z.array(EvalRun),
});
export type EvalSuite = z.infer<typeof EvalSuite>;
