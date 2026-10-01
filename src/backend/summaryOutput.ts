import { SummaryResultSchema, type Approval, type StreamEvent, type SummaryResult } from "@/lib/schemas";

/**
 * Pulls the "overview" text out of JSON that is still arriving.
 * This lets us show the overview while the rest of the JSON is still coming.
 */
export function previewOverview(raw: string): string {
  const match = /"overview"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw);
  if (!match?.[1]) return "";

  // Remove a half-received escape (like a lone "\\") at the end.
  const partial = match[1].replace(/\\$/, "").replace(/\\u[0-9a-fA-F]{0,3}$/, "");
  try {
    return JSON.parse(`"${partial}"`) as string;
  } catch {
    return "";
  }
}

/**
 * Reads the AI's JSON and checks it.
 * Throws if the shape is wrong, or if an item is unknown, repeated or missing.
 * Returns the items sorted by priority.
 */
export function parseSummary(raw: string, approvals: Approval[]): SummaryResult {
  // Check the shape.
  const result = SummaryResultSchema.parse(JSON.parse(raw));

  // Check that every approval appears exactly once.
  const expected = new Set(approvals.map((approval) => approval.id));
  const seen = new Set(result.items.map((item) => item.id));
  if (seen.size !== result.items.length || seen.size !== expected.size || ![...seen].every((id) => expected.has(id))) {
    throw new Error("Summary items do not match the pending approvals");
  }

  return { ...result, items: [...result.items].sort((a, b) => a.priority - b.priority) };
}

/** Wraps a summary in the event sent to the browser. */
export function summaryResultEvent(result: SummaryResult): StreamEvent {
  return { type: "result", data: result };
}
