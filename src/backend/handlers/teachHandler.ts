import { TEACH_PROMPT_VERSION, buildTeachMessages } from "@/backend/prompts/teach";
import type { StreamEvent, TeachRequest } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { teachFallback } from "@/backend/fallbacks";
import { streamWithFallback } from "@/backend/streamWithFallback";

/** Handles "Teach me": a guide for new operators, plus follow-up questions. */
export function teachHandler(input: TeachRequest, deps: HandlerDeps): AsyncGenerator<StreamEvent> {
  return streamWithFallback({
    llm: deps.llm,
    request: {
      messages: buildTeachMessages(deps.pendingApprovals, input.messages),
      temperature: 0.3,
      maxTokens: 450,
    },
    fallbackText: teachFallback(input.messages.length > 0),
    promptVersion: TEACH_PROMPT_VERSION,
    timeoutMs: deps.timeoutMs,
  });
}
