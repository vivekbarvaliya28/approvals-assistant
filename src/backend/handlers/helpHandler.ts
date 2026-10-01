import { retrieveChunks } from "@/backend/policy";
import { HELP_PROMPT_VERSION, buildHelpMessages } from "@/backend/prompts/help";
import type { HelpRequest, StreamEvent } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { HELP_NO_CONTEXT_TEXT, helpFallback } from "@/backend/fallbacks";
import { streamWithFallback } from "@/backend/streamWithFallback";

/** Handles "Help me": answers a question using the policy document. */
export async function* helpHandler(input: HelpRequest, deps: HandlerDeps): AsyncGenerator<StreamEvent> {
  // Find the policy sections that match the question.
  const excerpts = retrieveChunks(input.question, deps.policyChunks());

  // No matching section: do not ask the AI (it might make up an answer).
  if (excerpts.length === 0) {
    yield { type: "fallback", text: HELP_NO_CONTEXT_TEXT, reason: "no_context" };
    yield { type: "done", fallback: true, promptVersion: HELP_PROMPT_VERSION };
    return;
  }

  yield* streamWithFallback({
    llm: deps.llm,
    request: { messages: buildHelpMessages(input.question, excerpts), temperature: 0.1 },
    fallbackText: helpFallback(excerpts),
    promptVersion: HELP_PROMPT_VERSION,
    timeoutMs: deps.timeoutMs,
  });
}
