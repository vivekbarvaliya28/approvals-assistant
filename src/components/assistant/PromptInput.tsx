"use client";

import { useState, type FormEvent } from "react";
import { useAssistantStore, type AssistantMode } from "@/store/assistantStore";

// Text for the input box in each action.
const INPUT_COPY: Partial<Record<AssistantMode, { label: string; placeholder: string; maxLength: number }>> = {
  chat: { label: "Message", placeholder: "Ask about the approvals…", maxLength: 2000 },
  help: { label: "Policy question", placeholder: "e.g. Who can approve my own upload?", maxLength: 500 },
  teach: { label: "Follow-up question", placeholder: "Ask a follow-up, e.g. what counts as a safety-critical item?", maxLength: 2000 },
};

/** The text box and Send button. It is shown only for chat, help and teach. */
export function PromptInput() {
  const mode = useAssistantStore((state) => state.mode);
  const busy = useAssistantStore((state) => state.response.status === "loading" || state.response.status === "streaming");
  const sendTurn = useAssistantStore((state) => state.sendTurn);
  const askHelp = useAssistantStore((state) => state.askHelp);
  // What the user is typing.
  const [value, setValue] = useState("");

  // Actions without an input box (like summary) show nothing.
  const copy = mode ? INPUT_COPY[mode] : undefined;
  if (!mode || !copy) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setValue(""); // Clear the box
    void (mode === "help" ? askHelp(text) : sendTurn(text));
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        aria-label={copy.label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={copy.maxLength}
        placeholder={copy.placeholder}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={busy || value.trim().length === 0}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
