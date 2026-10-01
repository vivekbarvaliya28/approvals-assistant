import type { PolicyChunk } from "@/backend/policy";
import type { LlmMessage } from "@/backend/llm/types";
import { PERSONA } from "@/backend/prompts/shared";

// Change this version whenever the prompt text changes.
export const HELP_PROMPT_VERSION = "help@1.1.0";

const SYSTEM = `${PERSONA}
Answer the operator's question using ONLY the policy excerpts provided. Mention the section name you relied on.
If the excerpts do not contain the answer, say the policy does not cover it and suggest escalating to the Operations Manager. Never use outside knowledge. Keep replies under 120 words.`;

/** Builds the messages for the AI: the policy sections we found, then the question. */
export function buildHelpMessages(question: string, excerpts: PolicyChunk[]): LlmMessage[] {
  const context = excerpts.map((chunk) => `[${chunk.heading}]\n${chunk.body}`).join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Policy excerpts:\n${context}\n\nQuestion: ${question}` },
  ];
}
