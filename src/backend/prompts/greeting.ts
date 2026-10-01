import type { LlmMessage } from "@/backend/llm/types";
import { PERSONA } from "@/backend/prompts/shared";

// Change this version whenever the prompt text changes.
export const GREETING_PROMPT_VERSION = "greeting@1.0.0";

const SYSTEM = `${PERSONA}
Write a fresh, friendly greeting of one or two sentences for the operator. It MUST state the exact number of pending approvals as a digit. Match the time of day. Do not repeat the previous greeting's wording.`;

// Used to say "Good morning", "Good afternoon" or "Good evening".
export type PartOfDay = "morning" | "afternoon" | "evening";

/** Converts an hour (0-23) into morning, afternoon or evening. */
export function partOfDay(hour: number): PartOfDay {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Builds the messages for the AI. Passing the last greeting helps avoid repeating it. */
export function buildGreetingMessages(
  pendingCount: number,
  hour: number,
  previousGreeting?: string,
): LlmMessage[] {
  const lines = [`Pending approvals: ${pendingCount}`, `Time of day: ${partOfDay(hour)}`];
  if (previousGreeting) lines.push(`Previous greeting (do not reuse): ${previousGreeting}`);
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: lines.join("\n") },
  ];
}
