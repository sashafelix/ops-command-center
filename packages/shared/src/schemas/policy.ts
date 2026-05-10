import { z } from "zod";
import { Iso } from "./common";

export const PolicyMode = z.enum([
  "always-ask",
  "ask-once",
  "auto-approve",
  "ask-if-unsigned",
]);

export const Policy = z.object({
  id: z.string(),
  surface: z.string(),
  mode: PolicyMode,
  enabled: z.boolean(),
  owner_user_id: z.string(),
  updated_at: Iso,
});
export type Policy = z.infer<typeof Policy>;
