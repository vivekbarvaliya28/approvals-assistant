import type { z } from "zod";
import { getEnv } from "@/backend/env";
import { checkRateLimit } from "@/backend/rateLimit";
import type { StreamEvent } from "@/lib/schemas";
import { createSessionId, readSessionId, sessionCookie } from "@/backend/session";
import { encodeSseEvent } from "@/lib/sse";
import { createHandlerDeps, type HandlerDeps } from "@/backend/deps";

// What each AI route provides: a name, its input rules, and the function that does the work.
interface AiRouteConfig<TInput> {
  name: string;
  requestSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  handler: (input: TInput, deps: HandlerDeps) => AsyncGenerator<StreamEvent>;
}

// Builds a JSON error response.
function jsonError(status: number, error: string, headers: Headers): Response {
  return Response.json({ error }, { status, headers });
}

// Finds the visitor's IP address (or "local" when running on your machine).
function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * Decides who is being counted for the rate limit.
 * Visitors with a session cookie are counted by session.
 * Visitors without one are counted by IP, so deleting cookies does not reset the limit.
 */
function throttleKey(routeName: string, request: Request, sessionId: string | undefined): string {
  return `${routeName}:${sessionId ? `session:${sessionId}` : `ip:${clientKey(request)}`}`;
}

/** Reads the request body as JSON. An empty body counts as {}. Returns undefined if the JSON is broken. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Builds the POST function for an AI route. It:
 * 1. limits how often a visitor can call it,
 * 2. checks the request with Zod,
 * 3. streams the answer back to the browser as events.
 */
export function createAiRoute<TInput>({ name, requestSchema, handler }: AiRouteConfig<TInput>) {
  return async function POST(request: Request): Promise<Response> {
    const env = getEnv();
    const existingSessionId = readSessionId(request);
    const responseHeaders = new Headers();
    // New visitors get a session cookie.
    if (!existingSessionId) responseHeaders.append("Set-Cookie", sessionCookie(createSessionId()));

    // Step 1: rate limit.
    const limit = checkRateLimit(throttleKey(name, request, existingSessionId), {
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    });
    if (!limit.allowed) {
      responseHeaders.set("Retry-After", String(limit.retryAfterSeconds));
      return jsonError(429, `Too many requests. Try again in ${limit.retryAfterSeconds}s.`, responseHeaders);
    }

    // Step 2: check the request.
    const body = await readJson(request);
    if (body === undefined) return jsonError(400, "Request body must be valid JSON.", responseHeaders);

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
      return jsonError(400, `Invalid request: ${detail}`, responseHeaders);
    }

    // Step 3: run the handler and stream its events.
    const events = handler(parsed.data, createHandlerDeps());
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      // Called whenever the browser is ready for more data.
      async pull(controller) {
        try {
          const { value, done } = await events.next();
          if (done) return controller.close();
          controller.enqueue(encoder.encode(encodeSseEvent(value)));
        } catch (error) {
          // Never crash the stream. Tell the browser something went wrong.
          console.error(`[ai:${name}] unexpected failure`, error);
          controller.enqueue(encoder.encode(encodeSseEvent({ type: "error", message: "Something went wrong." })));
          controller.close();
        }
      },
      // The browser left, so stop the work.
      async cancel() {
        await events.return(undefined);
      },
    });

    // These headers tell the browser this is a live stream that must not be cached.
    responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
    responseHeaders.set("Cache-Control", "no-cache, no-transform");
    responseHeaders.set("Connection", "keep-alive");
    responseHeaders.set("X-Accel-Buffering", "no");
    return new Response(stream, { headers: responseHeaders });
  };
}
