import { create } from "zustand";
import { getApprovals, getPendingApprovals } from "@/lib/approvals";
import { AiRequestError, streamAiAction } from "@/lib/client/streamAiAction";
import type { Approval, ChatMessage, FallbackReason, StreamEvent, SummaryResult } from "@/lib/schemas";

// Which action is open in the widget.
export type AssistantMode = "summary" | "chat" | "help" | "teach";
// Actions that remember the conversation.
export type ConversationMode = "chat" | "teach";
// Where a request is: not started, waiting, receiving, finished, or failed.
export type StreamStatus = "idle" | "loading" | "streaming" | "done" | "error";

// The current state of one AI answer.
export interface StreamState {
  status: StreamStatus;
  text: string;
  // The checked summary, set when the server finishes.
  summary: SummaryResult | null;
  error: string | null;
  usedFallback: boolean;
  fallbackReason: FallbackReason | null;
}

// Ready-made starting states.
const idleStream: StreamState = { status: "idle", text: "", summary: null, error: null, usedFallback: false, fallbackReason: null };
const loadingStream: StreamState = { ...idleStream, status: "loading" };

// The API address for each conversation action.
const CONVERSATION_ENDPOINTS: Record<ConversationMode, string> = {
  chat: "/api/ai/chat",
  teach: "/api/ai/teach",
};

// Everything the widget remembers, plus the actions that change it.
interface AssistantState {
  approvals: Approval[];
  isOpen: boolean;
  isExpanded: boolean;
  mode: AssistantMode | null;
  greeting: StreamState;
  response: StreamState;
  conversations: Record<ConversationMode, ChatMessage[]>;
  // The message being answered (or that failed). It moves into the conversation after the reply.
  pendingQuestion: string | null;
  lastHelpQuestion: string | null;

  setOpen: (isOpen: boolean) => void;
  toggleExpanded: () => void;
  // Go back to the action cards.
  goHome: () => void;
  loadGreeting: () => Promise<void>;
  selectMode: (mode: AssistantMode) => void;
  askHelp: (question: string) => Promise<void>;
  // Send a message in chat or teach mode.
  sendTurn: (message: string) => Promise<void>;
  retry: () => void;
  isBusy: () => boolean;
}

/** The starting values of the store. Tests use this to reset it. */
export function createInitialState(): Pick<
  AssistantState,
  | "approvals"
  | "isOpen"
  | "isExpanded"
  | "mode"
  | "greeting"
  | "response"
  | "conversations"
  | "pendingQuestion"
  | "lastHelpQuestion"
> {
  return {
    approvals: getApprovals(),
    isOpen: true,
    isExpanded: false,
    mode: null,
    greeting: idleStream,
    response: idleStream,
    conversations: { chat: [], teach: [] },
    pendingQuestion: null,
    lastHelpQuestion: null,
  };
}

// Greeting and response are separate, so one does not cancel the other.
type Channel = "greeting" | "response";

// Lets us cancel the request that is running on each channel.
const controllers: Partial<Record<Channel, AbortController>> = {};

// Updates the state for each event from the server.
function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  switch (event.type) {
    case "token":
      return { ...state, status: "streaming", text: state.text + event.text };
    case "fallback":
      return { ...state, status: "streaming", text: event.text, summary: null, usedFallback: true, fallbackReason: event.reason };
    case "result":
      return { ...state, status: "streaming", summary: event.data };
    case "error":
      return { ...state, status: "error", error: event.message };
    case "done":
      return state.status === "error" ? state : { ...state, status: "done" };
  }
}

// Turns an error into text the user can read.
function toErrorMessage(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  return "Could not reach the assistant. Check your connection and try again.";
}

// True for the actions that keep a conversation (chat, teach).
function isConversationMode(mode: AssistantMode | null): mode is ConversationMode {
  return mode === "chat" || mode === "teach";
}

export const useAssistantStore = create<AssistantState>()((set, get) => {
  /**
   * Sends one request and updates the state as the answer arrives.
   * A new request cancels the old one on the same channel.
   * Returns true only if it finished without an error.
   */
  async function run(channel: Channel, endpoint: string, body: object): Promise<boolean> {
    controllers[channel]?.abort();
    const controller = new AbortController();
    controllers[channel] = controller;

    const update = (fn: (state: StreamState) => StreamState) =>
      set((state) => ({ [channel]: fn(state[channel]) }) as Pick<AssistantState, Channel>);

    // Show the loading state first.
    update(() => loadingStream);

    try {
      await streamAiAction(endpoint, body, {
        signal: controller.signal,
        onEvent: (event) => update((state) => applyEvent(state, event)),
      });
      // The stream ended without a "done" event, so something went wrong.
      if (get()[channel].status !== "done" && get()[channel].status !== "error") {
        update((state) => ({ ...state, status: "error", error: "The connection ended unexpectedly." }));
      }
    } catch (error) {
      if (controller.signal.aborted) return false; // A newer request replaced this one
      update((state) => ({ ...state, status: "error", error: toErrorMessage(error) }));
    }
    return get()[channel].status === "done";
  }

  /** One chat turn. userText is null when the assistant speaks first (the Teach guide). */
  async function converse(mode: ConversationMode, userText: string | null): Promise<void> {
    const history = get().conversations[mode];
    const messages: ChatMessage[] = userText ? [...history, { role: "user", content: userText }] : history;

    // Show the user's message right away, before the reply comes.
    set({ pendingQuestion: userText });
    const succeeded = await run("response", CONVERSATION_ENDPOINTS[mode], {
      messages,
    });

    // Save the finished exchange into the conversation.
    if (succeeded) {
      const { text, usedFallback, fallbackReason } = get().response;
      const answer: ChatMessage = { role: "assistant", content: text };
      set((state) => ({
        conversations: { ...state.conversations, [mode]: [...messages, answer] },
        pendingQuestion: null,
        // Keep the "AI unavailable" notice visible under the answer.
        response: { ...idleStream, usedFallback, fallbackReason },
      }));
    }
  }

  return {
    ...createInitialState(),

    setOpen: (isOpen) => set({ isOpen }),

    toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),

    goHome: () => {
      controllers.response?.abort();
      set({ mode: null, response: idleStream, pendingQuestion: null });
    },

    loadGreeting: async () => {
      // Send the last greeting so the new one is different.
      const previousGreeting = get().greeting.text || undefined;
      await run("greeting", "/api/ai/greeting", {
        localHour: new Date().getHours(),
        previousGreeting,
      });
    },

    selectMode: (mode) => {
      controllers.response?.abort();
      set((state) => ({
        mode,
        response: idleStream,
        pendingQuestion: state.mode === mode ? state.pendingQuestion : null,
      }));

      // Summary starts right away, in the browser's language.
      if (mode === "summary") void run("response", "/api/ai/summary", { locale: typeof navigator === "undefined" ? undefined : navigator.language });
      // Teach starts with the guide. Opening it again keeps the old conversation.
      if (mode === "teach" && get().conversations.teach.length === 0) void converse("teach", null);
    },

    askHelp: async (question) => {
      const trimmed = question.trim();
      if (!trimmed || get().isBusy()) return;
      set({ lastHelpQuestion: trimmed });
      await run("response", "/api/ai/help", { question: trimmed });
    },

    sendTurn: async (message) => {
      const { mode } = get();
      const trimmed = message.trim();
      if (!isConversationMode(mode) || !trimmed || get().isBusy()) return;
      await converse(mode, trimmed);
    },

    retry: () => {
      const { mode, pendingQuestion, lastHelpQuestion } = get();
      if (mode === "summary") get().selectMode("summary");
      else if (mode === "help" && lastHelpQuestion) void get().askHelp(lastHelpQuestion);
      else if (isConversationMode(mode)) void converse(mode, pendingQuestion);
    },

    isBusy: () => {
      const { status } = get().response;
      return status === "loading" || status === "streaming";
    },
  };
});

export function selectPendingCount(state: Pick<AssistantState, "approvals">): number {
  return getPendingApprovals(state.approvals).length;
}
