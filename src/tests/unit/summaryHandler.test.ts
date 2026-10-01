import { describe, expect, it, jest } from "@jest/globals";
import { getApprovals, getPendingApprovals } from "@/lib/approvals";
import type { LlmClient } from "@/backend/llm/types";
import { SummaryResultSchema, type StreamEvent } from "@/lib/schemas";
import type { HandlerDeps } from "@/backend/deps";
import { summaryHandler } from "@/backend/handlers/summaryHandler";

// Unit test (Jest): checks summaryHandler with a fake AI, so no real API is called.
const approvals = getPendingApprovals(getApprovals());

// Builds the inputs summaryHandler needs, using the fake AI.
function createDeps(llm: LlmClient): HandlerDeps {
  return {
    llm,
    pendingApprovals: approvals,
    policyChunks: () => [],
    timeoutMs: 1000,
    now: () => new Date("2025-09-19T09:00:00"),
  };
}

// Reads every event from the handler into a list.
async function collect(events: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const collected: StreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

// A fake AI that sends the JSON in small pieces, like a real stream.
function llmReturning(json: string): LlmClient {
  return {
    async *stream() {
      for (let i = 0; i < json.length; i += 7) yield json.slice(i, i + 7);
    },
  };
}

describe("summaryHandler", () => {
  it("streams the overview, then emits a Zod-validated structured summary ordered by priority", async () => {
    const json = JSON.stringify({
      overview: "4 items are pending; safety specs first.",
      items: [
        { id: "apr-002", priority: 2, reason: "Training video for operators." },
        { id: "apr-003", priority: 1, reason: "Safety-critical specification." },
        { id: "apr-001", priority: 3, reason: "Onboarding material." },
        { id: "apr-004", priority: 4, reason: "Reference map." },
      ],
    });
    const stream = jest.fn(llmReturning(json).stream);

    const events = await collect(summaryHandler({ locale: "hi-IN" }, createDeps({ stream })));

    const streamedText = events.flatMap((e) => (e.type === "token" ? [e.text] : [])).join("");
    expect(streamedText).toBe("4 items are pending; safety specs first.");

    const result = events.find((e) => e.type === "result");
    expect(result?.type === "result" && SummaryResultSchema.safeParse(result.data).success).toBe(true);
    expect(result?.type === "result" && result.data.items.map((item) => item.id)).toEqual([
      "apr-003",
      "apr-002",
      "apr-001",
      "apr-004",
    ]);
    expect(events.at(-1)).toEqual({ type: "done", fallback: false, promptVersion: "summary@2.1.0" });

    const prompt = stream.mock.calls[0]?.[0].messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("Safety Equipment & Sensor Specs");
    expect(prompt).toContain("in Hindi");
    expect(stream.mock.calls[0]?.[0].responseFormat).toBe("json");
  });

  it("rejects a model answer with the wrong shape and serves the deterministic structured fallback", async () => {
    const wrongShape = JSON.stringify({ overview: "ok", items: [{ id: "apr-001", priority: 1, reason: "Only one item" }] });

    const events = await collect(summaryHandler({}, createDeps(llmReturning(wrongShape))));

    expect(events.find((e) => e.type === "fallback")).toMatchObject({ reason: "error" });
    const result = events.find((e) => e.type === "result");
    expect(result?.type === "result" && result.data.items).toHaveLength(4);
    expect(result?.type === "result" && result.data.items[0]?.id).toBe("apr-003");
    expect(events.at(-1)).toMatchObject({ type: "done", fallback: true });
  });
});
