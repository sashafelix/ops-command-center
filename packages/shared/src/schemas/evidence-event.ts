import { z } from "zod";
import { Iso } from "./common";

export const EvidenceEvent = z.object({
  id: z.string(),
  session_id: z.string(),
  kind: z.string(),
  hash: z.string(),
  signed: z.boolean(),
  signed_by: z.string().optional(),
  signed_at: Iso.optional(),
});
export type EvidenceEvent = z.infer<typeof EvidenceEvent>;
