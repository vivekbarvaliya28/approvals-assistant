import { SUMMARY_PROMPT_VERSION, buildSummaryMessages } from "@/backend/prompts/summary";
import type { StreamEvent, SummaryRequest } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { summaryFallbackResult } from "@/backend/fallbacks";
import { parseSummary, previewOverview, summaryResultEvent } from "@/backend/summaryOutput";
import { streamWithFallback } from "@/backend/streamWithFallback";

/** Handles "Present me Summary": asks the AI for a ranked JSON summary. */
export function summaryHandler(input: SummaryRequest, deps: HandlerDeps): AsyncGenerator<StreamEvent> {
  const approvals = deps.pendingApprovals;
  // Backup summary, used if the AI fails.
  const fallback = summaryFallbackResult(approvals);

  return streamWithFallback({
    llm: deps.llm,
    request: {
      messages: buildSummaryMessages(approvals, input.locale),
      temperature: 0.2,
      maxTokens: 700,
      responseFormat: "json",
    },
    // The AI must return JSON. We stream the overview text and check the full JSON at the end.
    structured: {
      preview: previewOverview,
      finalize: (raw) => summaryResultEvent(parseSummary(raw, approvals)),
    },
    fallbackText: fallback.overview,
    fallbackEvents: [summaryResultEvent(fallback)],
    promptVersion: SUMMARY_PROMPT_VERSION,
    timeoutMs: deps.timeoutMs,
  });
}
