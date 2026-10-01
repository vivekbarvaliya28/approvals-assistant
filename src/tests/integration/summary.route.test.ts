import { createServer, type Server } from "node:http";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import type { LlmClient } from "@/backend/llm/types";
import { resetRateLimits } from "@/backend/rateLimit";
import type { StreamEvent } from "@/lib/schemas";
import { decodeSseFrame } from "@/lib/sse";

// Integration test (Jest + Supertest): calls the summary route over real HTTP with a fake AI.
let mockLlm: LlmClient;
let POST: (request: Request) => Promise<Response>;

// The route is imported after the mock is registered, so it never sees the real OpenAI client.
beforeAll(async () => {
  jest.doMock("@/backend/llm/openai", () => ({ getLlmClient: () => mockLlm }));
  ({ POST } = await import("@/app/api/ai/summary/route"));
});

/**
 * Serves the Next route handler over real HTTP so Supertest can drive it.
 * (The handler takes a Fetch `Request`, so this adapts Node's request/response to it.)
 */
function serveRoute(handler: (request: Request) => Promise<Response>): Server {
  return createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);

    const response = await handler(
      new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] ?? "application/json" },
        body: Buffer.concat(chunks),
      }),
    );

    res.writeHead(response.status, Object.fromEntries(response.headers));
    const reader = response.body?.getReader();
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  });
}

// Turns the raw stream text into a list of events.
function parseEvents(body: string): StreamEvent[] {
  return body
    .split("\n\n")
    .map(decodeSseFrame)
    .filter((event): event is StreamEvent => event !== null);
}

describe("POST /api/ai/summary", () => {
  let server: Server;

  beforeEach(() => {
    resetRateLimits();
    process.env.LLM_TIMEOUT_MS = "50";
    server = serveRoute(POST);
  });
  afterEach(() => {
    delete process.env.LLM_TIMEOUT_MS;
    server.close();
  });

  it("streams SSE and ends with a validated structured result on the success path", async () => {
    const json = JSON.stringify({
      overview: "Four items pending.",
      items: ["apr-001", "apr-002", "apr-003", "apr-004"].map((id, index) => ({
        id,
        priority: index + 1,
        reason: "Because.",
      })),
    });
    mockLlm = {
      async *stream() {
        yield json.slice(0, 30);
        yield json.slice(30);
      },
    };

    const response = await request(server).post("/api/ai/summary").send({});

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    const events = parseEvents(response.text);
    expect(events.some((e) => e.type === "token")).toBe(true);
    expect(events.find((e) => e.type === "result")).toMatchObject({ data: { overview: "Four items pending." } });
    expect(events.at(-1)).toMatchObject({ type: "done", fallback: false });
  });

  it("serves the fallback when the LLM exceeds the timeout", async () => {
    mockLlm = {
      stream: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => undefined) }),
      }),
    };

    const response = await request(server).post("/api/ai/summary").send({});
    const events = parseEvents(response.text);

    expect(response.status).toBe(200); // an LLM stall is never a user-facing failure
    expect(events[0]).toMatchObject({ type: "fallback", reason: "timeout" });
    expect(events.find((e) => e.type === "result")).toBeDefined();
    expect(events.at(-1)).toMatchObject({ type: "done", fallback: true });
  });
});
