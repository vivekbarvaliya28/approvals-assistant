/** One message sent to the AI. */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Everything we send in one AI call. */
export interface LlmRequest {
  messages: LlmMessage[];
  // Higher = more creative, lower = more predictable.
  temperature?: number;
  // Maximum length of the answer.
  maxTokens?: number;
  // "json" makes the AI reply with JSON only.
  responseFormat?: "text" | "json";
}

/** Any AI provider must offer this. Tests use a fake one. */
export interface LlmClient {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<string>;
}

/** Thrown when there is no API key. Retrying will not help. */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
  }
}
