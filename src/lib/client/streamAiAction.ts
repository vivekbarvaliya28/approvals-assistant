import { ApiErrorSchema, type StreamEvent } from "@/lib/schemas";
import { decodeSseFrame } from "@/lib/sse";

/** Error for failed requests, like a rate limit or bad input. */
export class AiRequestError extends Error {}

// signal: lets the caller cancel. onEvent: called for every event received.
interface StreamAiActionOptions {
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
}

/**
 * Sends a request to an AI route and passes each event to onEvent as it arrives.
 * Throws AiRequestError if the server rejects the request.
 */
export async function streamAiAction(
  endpoint: string,
  body: unknown,
  { signal, onEvent }: StreamAiActionOptions,
): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new AiRequestError(parsed.success ? parsed.data.error : `Request failed (${response.status}).`);
  }
  if (!response.body) throw new AiRequestError("The server sent an empty response.");

  // Read the streamed answer piece by piece.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Messages end with a blank line. Keep any unfinished message for the next read.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = decodeSseFrame(frame);
      if (event) onEvent(event);
    }
  }

  // Handle a last message that had no blank line after it.
  const trailing = decodeSseFrame(buffer);
  if (trailing) onEvent(trailing);
}
