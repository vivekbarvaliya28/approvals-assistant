"use client";

import type { ReactNode } from "react";
import type { Approval, SummaryResult } from "@/lib/schemas";
import { useAssistantStore } from "@/store/assistantStore";

// Short help text shown before the user has done anything.
const HINTS = {
  summary: "",
  chat: "Ask me anything about the pending approvals.",
  help: "Ask a question about the approval policy.",
  teach: "",
} as const;

/** Shows the answer for the open action: loading, streaming text, chat bubbles, or an error. */
export function ResponsePane() {
  const mode = useAssistantStore((state) => state.mode);
  const response = useAssistantStore((state) => state.response);
  const approvals = useAssistantStore((state) => state.approvals);
  const conversations = useAssistantStore((state) => state.conversations);
  const pendingQuestion = useAssistantStore((state) => state.pendingQuestion);
  const retry = useAssistantStore((state) => state.retry);

  if (!mode) return null;

  // Chat and teach show past messages. Summary and help show one answer.
  const isConversation = mode === "chat" || mode === "teach";
  const history = isConversation ? conversations[mode] : [];
  const showHint = response.status === "idle" && history.length === 0 && !pendingQuestion;
  const hasOutput = response.status === "streaming" || response.status === "done";

  return (
    <Pane>
      {isConversation && (
        <div className="space-y-3">
          {history.map((message, index) => (
            <Bubble key={index} role={message.role}>
              {message.content}
            </Bubble>
          ))}
          {pendingQuestion && <Bubble role="user">{pendingQuestion}</Bubble>}
        </div>
      )}

      {/* Help text before anything has happened */}
      {showHint && <p className="text-slate-500">{HINTS[mode]}</p>}

      {/* Waiting for the first word of the answer */}
      {response.status === "loading" && (
        <p role="status" className="animate-pulse text-slate-500">
          Thinking…
        </p>
      )}

      {/* The answer, as it arrives */}
      {hasOutput &&
        (mode === "summary" && response.summary ? (
          <SummaryView summary={response.summary} approvals={approvals} />
        ) : isConversation ? (
          <Bubble role="assistant">{response.text}</Bubble>
        ) : (
          <p className="whitespace-pre-wrap">{response.text}</p>
        ))}

      {/* Tell the user when this is a backup answer */}
      {response.usedFallback && (
        <p className="mt-2 text-xs text-amber-700">
          {response.fallbackReason === "no_context"
            ? "No matching policy section was found, so the AI was not asked."
            : "The AI was unavailable, so this is a simplified answer."}
        </p>
      )}

      {/* Error box with a Retry button */}
      {response.status === "error" && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-red-800">
          <span>{response.error}</span>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
    </Pane>
  );
}

/** The ranked list of approvals with a short reason for each. */
function SummaryView({ summary, approvals }: { summary: SummaryResult; approvals: Approval[] }) {
  return (
    <div className="space-y-3">
      <p>{summary.overview}</p>
      <ol className="space-y-2">
        {summary.items.map((item) => {
          const approval = approvals.find((candidate) => candidate.id === item.id);
          if (!approval) return null;
          return (
            <li key={item.id} className="flex gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
              <span
                aria-label={`Priority ${item.priority}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
              >
                {item.priority}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{approval.title}</p>
                <p className="text-xs text-slate-500">
                  {approval.type} · {approval.submittedBy}
                </p>
                <p className="mt-1 text-slate-700">{item.reason}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The grey box that holds the answer. */
function Pane({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[8rem] rounded-lg bg-slate-50 p-4 text-sm leading-relaxed ring-1 ring-slate-200" aria-live="polite">
      {children}
    </div>
  );
}

/** One chat message. The user's are on the right, the assistant's on the left. */
function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
          isUser ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-200"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
