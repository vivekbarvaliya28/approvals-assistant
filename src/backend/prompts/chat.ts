import type { Approval, ChatMessage } from "@/lib/schemas";
import type { LlmMessage } from "@/backend/llm/types";
import { formatApprovals, PERSONA } from "@/backend/prompts/shared";

// Change this version whenever the prompt text changes.
export const CHAT_PROMPT_VERSION = "chat@1.1.0";

// Only the last 10 messages are sent. This keeps cost low and the AI focused.
const MAX_HISTORY_MESSAGES = 10;

const SYSTEM = `${PERSONA}
You are chatting with an operator about the approvals queue below. Answer only from this data and general review common sense.
You cannot approve, reject or modify anything; if asked, explain that a human Approver must do it. If a question is unrelated to approvals, politely steer back. Keep replies under 120 words.`;

/** Builds the messages for the AI: instructions, the queue, then the chat history. */
export function buildChatMessages(approvals: Approval[], history: ChatMessage[]): LlmMessage[] {
  return [
    {
      role: "system",
      content: `${SYSTEM}\n\nApprovals queue:\n${formatApprovals(approvals)}`,
    },
    ...history.slice(-MAX_HISTORY_MESSAGES),
  ];
}
