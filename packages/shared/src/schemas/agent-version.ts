import { z } from "zod";
import { DeployChannel } from "./deploy";

export const AgentVersion = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  channel: DeployChannel,
  trust_score: z.number().min(0).max(1),
  runs_24h: z.number().int().nonnegative(),
  signing_key_fp: z.string(),
  signed: z.boolean(),
});
export type AgentVersion = z.infer<typeof AgentVersion>;
