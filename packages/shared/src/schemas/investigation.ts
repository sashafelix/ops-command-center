import { z } from "zod";
import { Iso, Severity } from "./common";

export const InvestigationStatus = z.enum(["open", "triage", "closed"]);
export const EvidenceStatus = z.enum(["pending", "verified", "tampered"]);

export const Investigation = z.object({
  id: z.string(),
  severity: Severity,
  title: z.string(),
  session_id: z.string(),
  opened_at: Iso,
  evidence_status: EvidenceStatus,
  status: InvestigationStatus,
});
export type Investigation = z.infer<typeof Investigation>;
