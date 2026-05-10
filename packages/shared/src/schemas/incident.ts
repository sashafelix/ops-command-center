import { z } from "zod";
import { Iso, Severity } from "./common";

export const Incident = z.object({
  id: z.string(),
  severity: Severity,
  service_id: z.string(),
  title: z.string(),
  started_at: Iso,
  ack_at: Iso.optional(),
  resolved_at: Iso.optional(),
  acked_by: z.string().optional(),
  postmortem_url: z.string().url().optional(),
});
export type Incident = z.infer<typeof Incident>;
