import { SummaryRequestSchema } from "@/lib/schemas";
import { createAiRoute } from "@/backend/createAiRoute";
import { summaryHandler } from "@/backend/handlers/summaryHandler";

// Always run on the server for each request. Never cache the AI answer.
export const dynamic = "force-dynamic";

// POST /api/ai/summary (Present me Summary). Rate limiting, checking and streaming are done in createAiRoute.
export const POST = createAiRoute({
  name: "summary",
  requestSchema: SummaryRequestSchema,
  handler: summaryHandler,
});
