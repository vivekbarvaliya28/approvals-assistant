import type { PolicyChunk } from "@/backend/policy";
import type { Approval, SummaryResult } from "@/lib/schemas";
import { partOfDay } from "@/backend/prompts/greeting";

/**
 * Backup answers used when the AI is slow, broken or has no key.
 * They are written by us, so they are simple but always correct.
 */

// A simple guess at urgency: safety items first, then training, then the rest.
function urgencyScore(approval: Approval): number {
  const title = approval.title.toLowerCase();
  if (title.includes("safety")) return 3;
  if (approval.type === "Video" || title.includes("onboarding")) return 2;
  return 1;
}

/** Sorts approvals from most to least urgent. */
export function rankByUrgency(approvals: Approval[]): Approval[] {
  return [...approvals].sort((a, b) => urgencyScore(b) - urgencyScore(a));
}

/** Backup summary in the same shape as the AI summary. */
export function summaryFallbackResult(approvals: Approval[]): SummaryResult {
  return {
    overview: `${approvals.length} approvals are pending review, listed by estimated urgency.`,
    items: rankByUrgency(approvals).map((approval, index) => ({
      id: approval.id,
      priority: index + 1,
      reason: `${approval.type} submitted by ${approval.submittedBy} on ${approval.submittedOn}.`,
    })),
  };
}

/** Backup greeting, for example "Good morning! 4 approvals are waiting for your review." */
export function greetingFallback(pendingCount: number, hour: number): string {
  const noun = pendingCount === 1 ? "approval is" : "approvals are";
  return `Good ${partOfDay(hour)}! ${pendingCount} ${noun} waiting for your review.`;
}

/** Backup chat reply. It lists the pending items. */
export function chatFallback(approvals: Approval[]): string {
  return (
    "I can't reach the assistant right now, so I can't answer that in detail. " +
    `For reference, ${approvals.length} approvals are pending: ${approvals.map((a) => a.title).join("; ")}.`
  );
}

/** Backup help answer: shows the matching policy sections as they are. */
export function helpFallback(excerpts: PolicyChunk[]): string {
  return excerpts.map((chunk) => `${chunk.heading}\n${chunk.body}`).join("\n\n");
}

// Shown when no policy section matches the question, so the AI is not asked.
export const HELP_NO_CONTEXT_TEXT =
  "The approval policy does not appear to cover that. When unsure, escalate to the Operations Manager.";

// Fixed step-by-step guide for new operators.
const TEACH_GUIDE = [
  "How to review the approvals queue:",
  "1. Open the item and confirm you are not its submitter; you cannot approve your own upload.",
  "2. Check the content type and use its checklist: files for folders, full playback for videos, version and values for PDFs, legibility and labels for images.",
  "3. Prioritise safety-critical items; they need review within one business day.",
  "4. Approve only if every checklist item passes; there are no partial approvals.",
  "5. Otherwise reject with a written reason of at least one sentence.",
  "6. Escalate to the Operations Manager if the item has personal data, conflicts with a procedure, or you are unsure.",
].join("\n");

/** Backup for Teach me. A follow-up question just gets the guide again. */
export function teachFallback(isFollowUp: boolean): string {
  return isFollowUp
    ? `I can't answer follow-up questions right now. Here is the guide again:\n${TEACH_GUIDE}`
    : TEACH_GUIDE;
}
