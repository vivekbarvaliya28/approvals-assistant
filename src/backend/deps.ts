import { getPendingApprovals, getApprovals } from "@/lib/approvals";
import { getEnv } from "@/backend/env";
import { getLlmClient } from "@/backend/llm/openai";
import type { LlmClient } from "@/backend/llm/types";
import { loadPolicyChunks, type PolicyChunk } from "@/backend/policy";
import type { Approval } from "@/lib/schemas";

/** Everything a handler needs. Tests can pass fake versions of these. */
export interface HandlerDeps {
  llm: LlmClient;
  pendingApprovals: Approval[];
  policyChunks: () => PolicyChunk[];
  timeoutMs: number;
  now: () => Date;
}

/** Builds the real dependencies for a request. */
export function createHandlerDeps(): HandlerDeps {
  return {
    llm: getLlmClient(),
    pendingApprovals: getPendingApprovals(getApprovals()),
    policyChunks: loadPolicyChunks,
    timeoutMs: getEnv().LLM_TIMEOUT_MS,
    now: () => new Date(),
  };
}
