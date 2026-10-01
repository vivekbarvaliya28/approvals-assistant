import type { Approval, ChatMessage } from "@/lib/schemas";
import type { LlmMessage } from "@/backend/llm/types";
import { formatApprovals, PERSONA } from "@/backend/prompts/shared";

// Change this version whenever the prompt text changes.
export const TEACH_PROMPT_VERSION = "teach@2.0.0";

// Only the last 10 messages are sent.
const MAX_HISTORY_MESSAGES = 10;

const SYSTEM = `${PERSONA}
You are teaching a brand-new operator how to review and act on items in the approvals queue (shown below).
- When asked to begin, give a step-by-step guide of 5 to 7 numbered steps, tailored to the content types actually in the queue, ending with one tip on when to escalate. Keep it under 200 words.
- When the operator asks a follow-up, answer that question specifically and simply, referring back to the relevant step. Adapt to their level: if they seem confused, explain more slowly with an example. Keep follow-up answers under 120 words.`;

// Sent when there is no chat yet, to make the AI start the guide.
export const TEACH_START_MESSAGE = "Please begin the guide.";

/** Builds the messages for the AI. With no history, it asks for the guide. */
export function buildTeachMessages(approvals: Approval[], history: ChatMessage[]): LlmMessage[] {
  const turns: LlmMessage[] =
    history.length === 0
      ? [{ role: "user", content: TEACH_START_MESSAGE }]
      : history.slice(-MAX_HISTORY_MESSAGES);
  return [
    {
      role: "system",
      content: `${SYSTEM}\n\nCurrent queue:\n${formatApprovals(approvals)}`,
    },
    ...turns,
  ];
}
