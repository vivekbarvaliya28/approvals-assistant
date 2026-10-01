import { LlmNotConfiguredError, type LlmClient, type LlmRequest } from "@/backend/llm/types";
import type { FallbackReason, StreamEvent } from "@/lib/schemas";

/**
 * For answers that must be JSON (like the summary).
 * preview: gives the readable text found so far, so we can stream it.
 * finalize: checks the full JSON at the end and throws if it is wrong.
 */
export interface StructuredOutput {
  preview: (raw: string) => string;
  finalize: (raw: string) => StreamEvent;
}

// What streamWithFallback needs to run one AI call.
export interface StreamWithFallbackParams {
  llm: LlmClient;
  request: LlmRequest;
  fallbackText: string;
  // Extra events sent after the backup text (for example a backup summary).
  fallbackEvents?: StreamEvent[];
  promptVersion: string;
  timeoutMs: number;
  structured?: StructuredOutput;
}

// We try once more if the first try fails.
const MAX_RETRIES = 1;

// Thrown when the AI takes too long.
class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM call exceeded ${timeoutMs}ms`);
  }
}

/**
 * Calls the AI and streams its answer, with a time limit.
 * If the AI fails or is too slow, it sends a backup answer instead, so the user always gets a reply.
 *
 * Retry: a failed call is tried once more, but only if
 * - nothing was sent to the user yet,
 * - it was not a timeout (a retry would double the wait), and
 * - the API key exists (without a key, retrying cannot help).
 */
export async function* streamWithFallback(params: StreamWithFallbackParams): AsyncGenerator<StreamEvent> {
  const { fallbackText, fallbackEvents = [], promptVersion } = params;

  // Try up to 2 times (the first try plus one retry).
  for (let attempt = 0; ; attempt++) {
    let streamedAnything = false;
    try {
      for await (const event of streamOnce(params)) {
        streamedAnything = true;
        yield event;
      }
      return;
    } catch (error) {
      const retryable =
        attempt < MAX_RETRIES &&
        !streamedAnything &&
        !(error instanceof LlmTimeoutError) &&
        !(error instanceof LlmNotConfiguredError);
      const message = error instanceof Error ? error.message : error;

      if (retryable) {
        console.warn(`[ai] ${promptVersion} attempt ${attempt + 1} failed, retrying:`, message);
        continue;
      }

      // No more retries: send the backup answer.
      const reason: FallbackReason = error instanceof LlmTimeoutError ? "timeout" : "error";
      console.warn(`[ai] ${promptVersion} fell back (${reason}):`, message);
      yield { type: "fallback", text: fallbackText, reason };
      yield* fallbackEvents;
      yield { type: "done", fallback: true, promptVersion };
      return;
    }
  }
}

// One attempt at calling the AI. Throws if it fails or times out.
async function* streamOnce({
  llm,
  request,
  promptVersion,
  timeoutMs,
  structured,
}: StreamWithFallbackParams): AsyncGenerator<StreamEvent> {
  // Timer: after timeoutMs we cancel the call and fail with a timeout error.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  deadline.catch(() => undefined); // Stops a harmless "unhandled error" if the AI finishes first.

  let iterator: AsyncIterator<string> | undefined;
  try {
    iterator = llm.stream(request, controller.signal)[Symbol.asyncIterator]();
    let raw = ""; // All text received so far
    let previewLength = 0; // How much of the readable text we already sent


    while (true) {
      // Wait for the next piece, but give up if the time limit is reached first.
      const next = await Promise.race([iterator.next(), deadline]);
      if (next.done) break;
      raw += next.value;

      // Normal text: send each piece straight away.
      if (!structured) {
        yield { type: "token", text: next.value };
        continue;
      }
      // JSON answer: only send the readable overview text, not the raw JSON.
      const preview = structured.preview(raw);
      if (preview.length > previewLength) {
        yield { type: "token", text: preview.slice(previewLength) };
        previewLength = preview.length;
      }
    }

    // An empty answer counts as a failure.
    if (raw.length === 0) throw new Error("LLM returned an empty response");
    // For JSON answers, check the full result before sending it.
    if (structured) yield structured.finalize(raw);
    yield { type: "done", fallback: false, promptVersion };
  } finally {
    // Clean up: stop the timer and the AI call.
    controller.abort();
    clearTimeout(timer);
    void iterator?.return?.().catch?.(() => undefined);
  }
}
