import { GREETING_PROMPT_VERSION, buildGreetingMessages } from "@/backend/prompts/greeting";
import type { GreetingRequest, StreamEvent } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { greetingFallback } from "@/backend/fallbacks";
import { streamWithFallback } from "@/backend/streamWithFallback";

/** Handles "Replay Greeting": a short greeting that mentions the pending count. */
export function greetingHandler(input: GreetingRequest, deps: HandlerDeps): AsyncGenerator<StreamEvent> {
  const pendingCount = deps.pendingApprovals.length;
  // Use the user's local hour if we have it, otherwise the server's hour.
  const hour = input.localHour ?? deps.now().getHours();

  return streamWithFallback({
    llm: deps.llm,
    request: {
      messages: buildGreetingMessages(pendingCount, hour, input.previousGreeting),
      temperature: 1, // High value = more variety, so each greeting is different
      maxTokens: 400, // Some models "think" first, so we leave extra room
    },
    fallbackText: greetingFallback(pendingCount, hour),
    promptVersion: GREETING_PROMPT_VERSION,
    timeoutMs: deps.timeoutMs,
  });
}
