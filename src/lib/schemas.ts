import { z } from "zod";

/**
 * All data rules live here, using Zod.
 * They check the JSON data, the API requests and the events sent to the browser.
 */

// ---------- Domain ----------

// The kinds of content and the review states we allow.
export const ApprovalTypeSchema = z.enum(["Folder", "Video", "PDF", "Image"]);
export const ApprovalStatusSchema = z.enum(["Pending Review", "Approved", "Rejected"]);

// One item in the approvals queue.
export const ApprovalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: ApprovalTypeSchema,
  submittedBy: z.string().min(1),
  status: ApprovalStatusSchema,
  submittedOn: z.string().min(1),
});
export const ApprovalListSchema = z.array(ApprovalSchema);

export type Approval = z.infer<typeof ApprovalSchema>;

// ---------- Requests ----------

// One chat message. Limited to 2000 characters.
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// True if the chat is empty or the newest message is from the user.
const lastMessageIsFromUser = (messages: ChatMessage[]) =>
  messages.length === 0 || messages[messages.length - 1]?.role === "user";

// Browser language code, for example "hi-IN". If missing, we use English.
export const LocaleSchema = z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/);

export const SummaryRequestSchema = z.object({ locale: LocaleSchema.optional() }).strict();

// Chat needs at least one message, and the last one must be from the user.
export const ChatRequestSchema = z
  .object({ messages: z.array(ChatMessageSchema).min(1).max(30) })
  .refine((body) => lastMessageIsFromUser(body.messages), {
    message: "The last message must come from the user",
    path: ["messages"],
  });

export const HelpRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

// No messages = start the guide. Otherwise the last message is a follow-up question.
export const TeachRequestSchema = z
  .object({ messages: z.array(ChatMessageSchema).max(30).default([]) })
  .refine((body) => lastMessageIsFromUser(body.messages), {
    message: "The last message must come from the user",
    path: ["messages"],
  });

// Optional extras that help write a fresh greeting.
export const GreetingRequestSchema = z.object({
  localHour: z.number().int().min(0).max(23).optional(),
  previousGreeting: z.string().max(500).optional(),
});

export type SummaryRequest = z.output<typeof SummaryRequestSchema>;
export type ChatRequest = z.output<typeof ChatRequestSchema>;
export type HelpRequest = z.output<typeof HelpRequestSchema>;
export type TeachRequest = z.output<typeof TeachRequestSchema>;
export type GreetingRequest = z.infer<typeof GreetingRequestSchema>;

// ---------- Structured LLM output ----------

export const SummaryItemSchema = z.object({
  id: z.string().min(1),
  // 1 = most urgent.
  priority: z.number().int().min(1).max(10),
  reason: z.string().trim().min(1).max(240),
});

// The summary the AI must return: a short overview and a ranked list.
export const SummaryResultSchema = z.object({
  overview: z.string().trim().min(1).max(500),
  items: z.array(SummaryItemSchema).min(1).max(20),
});
export type SummaryResult = z.infer<typeof SummaryResultSchema>;

// ---------- Responses (SSE events) ----------

// Why the backup answer was used.
export const FallbackReasonSchema = z.enum(["timeout", "error", "no_context"]);
export type FallbackReason = z.infer<typeof FallbackReasonSchema>;

// The messages the server sends to the browser while streaming.
export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), text: z.string() }),
  // Backup answer. It replaces any text streamed so far.
  z.object({ type: z.literal("fallback"), text: z.string(), reason: FallbackReasonSchema }),
  // The checked summary, sent after the AI finishes.
  z.object({ type: z.literal("result"), data: SummaryResultSchema }),
  // The stream is finished.
  z.object({ type: z.literal("done"), fallback: z.boolean(), promptVersion: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });
