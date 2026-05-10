import { z } from "zod";
import { Iso } from "./common";

export const DeployChannel = z.enum(["stable", "canary", "shadow"]);

export const Deploy = z.object({
  id: z.string(),
  service_or_agent_id: z.string(),
  version: z.string(),
  channel: DeployChannel,
  who: z.string(),
  when: Iso,
  eval_delta: z.number(),
  cost_delta: z.number(),
  rollback_candidate: z.boolean(),
});
export type Deploy = z.infer<typeof Deploy>;
