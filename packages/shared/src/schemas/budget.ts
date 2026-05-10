import { z } from "zod";

export const Budget = z.object({
  id: z.string(),
  team_id: z.string(),
  daily_cap: z.number().nonnegative(),
  mtd_actual: z.number().nonnegative(),
  forecast_eom: z.number().nonnegative(),
});
export type Budget = z.infer<typeof Budget>;
