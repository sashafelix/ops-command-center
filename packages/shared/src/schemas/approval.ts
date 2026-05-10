import { z } from "zod";
import { Iso, Severity } from "./common";

export const ApprovalDecision = z.enum(["approve", "deny", "edit", "expire"]);

export const Approval = z.object({
  id: z.string(),
  session_id: z.string(),
  severity: Severity,
  policy_id: z.string(),
  command: z.string(),
  justification: z.string(),
  blast_radius: z.string(),
  requested_at: Iso,
  auto_deny_at: Iso,
  decided_at: Iso.optional(),
  decision: ApprovalDecision.optional(),
  approver_user_id: z.string().optional(),
  edited_command: z.string().optional(),
});
export type Approval = z.infer<typeof Approval>;
