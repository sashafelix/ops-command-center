import { z } from "zod";
import { Iso, Role } from "./common";

export const AuditEvent = z.object({
  id: z.string(),
  ts: Iso,
  actor: z.string(),
  role: Role,
  action: z.string(),
  target: z.string(),
  ip: z.string(),
  ua: z.string(),
  hash: z.string(),
  prev_hash: z.string(),
  anchored_at: Iso.optional(),
  verified: z.boolean(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;
