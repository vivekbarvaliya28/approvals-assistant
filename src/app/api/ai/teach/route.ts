import { TeachRequestSchema } from "@/lib/schemas";
import { createAiRoute } from "@/backend/createAiRoute";
import { teachHandler } from "@/backend/handlers/teachHandler";

// Always run on the server for each request. Never cache the AI answer.
export const dynamic = "force-dynamic";

// POST /api/ai/teach (Teach me). Rate limiting, checking and streaming are done in createAiRoute.
export const POST = createAiRoute({
  name: "teach",
  requestSchema: TeachRequestSchema,
  handler: teachHandler,
});
