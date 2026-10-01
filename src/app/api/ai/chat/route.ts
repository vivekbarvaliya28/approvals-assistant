import { ChatRequestSchema } from "@/lib/schemas";
import { createAiRoute } from "@/backend/createAiRoute";
import { chatHandler } from "@/backend/handlers/chatHandler";

// Always run on the server for each request. Never cache the AI answer.
export const dynamic = "force-dynamic";

// POST /api/ai/chat (Talk to me). Rate limiting, checking and streaming are done in createAiRoute.
export const POST = createAiRoute({
  name: "chat",
  requestSchema: ChatRequestSchema,
  handler: chatHandler,
});
