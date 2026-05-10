import { z } from "zod";
import { StatusTone } from "./common";

export const SLO = z.object({
  id: z.string(),
  service_id: z.string(),
  name: z.string(),
  target: z.number().min(0).max(1),
  window_d: z.number().int().positive(),
  actual: z.number().min(0).max(1),
  burn_rate: z.number(),
  state: StatusTone,
});
export type SLO = z.infer<typeof SLO>;
