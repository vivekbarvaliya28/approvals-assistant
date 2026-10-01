import rawApprovals from "@/data/approvals.json";
import { ApprovalListSchema, type Approval } from "@/lib/schemas";

// Check the JSON file once when the app starts, so bad data stops early.
const approvals: Approval[] = ApprovalListSchema.parse(rawApprovals);

/** All approvals from the JSON file. */
export function getApprovals(): Approval[] {
  return approvals;
}

/** Only the approvals that are still waiting for review. */
export function getPendingApprovals(list: Approval[] = approvals): Approval[] {
  return list.filter((approval) => approval.status === "Pending Review");
}
