import { GreetingRequestSchema } from "@/lib/schemas";
import { createAiRoute } from "@/backend/createAiRoute";
import { greetingHandler } from "@/backend/handlers/greetingHandler";

// Always run on the server for each request. Never cache the AI answer.
export const dynamic = "force-dynamic";

// POST /api/ai/greeting (Replay Greeting). Rate limiting, checking and streaming are done in createAiRoute.
export const POST = createAiRoute({
  name: "greeting",
  requestSchema: GreetingRequestSchema,
  handler: greetingHandler,
});
