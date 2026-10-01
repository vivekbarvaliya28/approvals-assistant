import type { Approval } from "@/lib/schemas";
import type { LlmMessage } from "@/backend/llm/types";
import { formatApprovals, languageName, PERSONA } from "@/backend/prompts/shared";

// Change this version whenever the prompt text changes.
export const SUMMARY_PROMPT_VERSION = "summary@2.1.0";

const SYSTEM = `${PERSONA}
Summarise the pending approvals for the operator and rank them from most to least urgent.
Urgency guidance: safety-critical or operator-facing material first, then training/procedural material, then reference material. All items share a submission date, so judge urgency by content, not age.

Respond with ONE JSON object and nothing else, exactly in this shape:
{"overview": string, "items": [{"id": string, "priority": number, "reason": string}]}
- "overview" is written FIRST: one or two sentences that include the total number of pending items.
- "items" contains every approval exactly once, using the id given. priority 1 is most urgent, then 2, 3, ... with no ties.
- "reason" is one short sentence explaining the priority.
Do not invent facts beyond the data.`;

/** Builds the messages for the AI. The locale sets the language of the answer. */
export function buildSummaryMessages(approvals: Approval[], locale?: string): LlmMessage[] {
  return [
    {
      role: "system",
      content: `${SYSTEM}\nWrite the "overview" and every "reason" in ${languageName(locale)}; keep the JSON keys and ids unchanged.`,
    },
    { role: "user", content: `Pending approvals:\n${formatApprovals(approvals)}` },
  ];
}
