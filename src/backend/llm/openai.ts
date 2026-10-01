import OpenAI from "openai";
import { getEnv } from "@/backend/env";
import { LlmNotConfiguredError, type LlmClient, type LlmRequest } from "@/backend/llm/types";

/** Talks to OpenAI (or a provider that works the same way, like Groq). */
class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    baseURL?: string,
  ) {
    // No automatic retries here. We handle retry and timeout ourselves.
    this.client = new OpenAI({ apiKey, baseURL, maxRetries: 0 });
  }

  /** Sends the messages and yields the answer piece by piece. */
  async *stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<string> {
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 500,
        stream: true,
        // Ask for JSON only when the caller needs it.
        ...(request.responseFormat === "json" && { response_format: { type: "json_object" as const } }),
      },
      { signal },
    );

    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
  }
}

/** Used when there is no API key. It always fails, so the app shows the backup answer. */
class UnconfiguredLlmClient implements LlmClient {
  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<string> {
    throw new LlmNotConfiguredError();
  }
}

// Create the client once and reuse it.
let cached: LlmClient | undefined;

export function getLlmClient(): LlmClient {
  if (!cached) {
    const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = getEnv();
    cached = OPENAI_API_KEY
      ? new OpenAiLlmClient(OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL)
      : new UnconfiguredLlmClient();
  }
  return cached;
}
