import { CHAT_PROMPT_VERSION, buildChatMessages } from "@/backend/prompts/chat";
import type { ChatRequest, StreamEvent } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { chatFallback } from "@/backend/fallbacks";
import { streamWithFallback } from "@/backend/streamWithFallback";

/** Handles "Talk to me": a chat about the approvals queue. */
export function chatHandler(input: ChatRequest, deps: HandlerDeps): AsyncGenerator<StreamEvent> {
  return streamWithFallback({
    llm: deps.llm,
    request: {
      messages: buildChatMessages(deps.pendingApprovals, input.messages),
      temperature: 0.5,
    },
    fallbackText: chatFallback(deps.pendingApprovals),
    promptVersion: CHAT_PROMPT_VERSION,
    timeoutMs: deps.timeoutMs,
  });
}
