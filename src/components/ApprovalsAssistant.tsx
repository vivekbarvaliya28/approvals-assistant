"use client";

import { useEffect } from "react";
import { ActionBar } from "@/components/assistant/ActionBar";
import { AssistantHeader } from "@/components/assistant/AssistantHeader";
import { GreetingBar } from "@/components/assistant/GreetingBar";
import { PromptInput } from "@/components/assistant/PromptInput";
import { ResponsePane } from "@/components/assistant/ResponsePane";
import { selectPendingCount, useAssistantStore } from "@/store/assistantStore";

/** The floating assistant in the lower-right corner: header, greeting, action cards, and a round button to open or close it. */
export function ApprovalsAssistant() {
  const loadGreeting = useAssistantStore((state) => state.loadGreeting);
  const isOpen = useAssistantStore((state) => state.isOpen);
  const isExpanded = useAssistantStore((state) => state.isExpanded);
  const mode = useAssistantStore((state) => state.mode);
  const goHome = useAssistantStore((state) => state.goHome);
  const setOpen = useAssistantStore((state) => state.setOpen);
  const pendingCount = useAssistantStore(selectPendingCount);

  // Say hello once when the page loads.
  useEffect(() => {
    void loadGreeting();
  }, [loadGreeting]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <section
          aria-label="Approvals Assistant"
          className={`flex max-h-[calc(100vh-6.5rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 ${
            isExpanded ? "w-[34rem]" : "w-[22rem]"
          }`}
        >
          <AssistantHeader />
          <GreetingBar />
          {/* Body: the action cards, or the chosen action once one is picked */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {mode ? (
              <>
                <button
                  type="button"
                  onClick={goHome}
                  className="text-xs font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ← Back to actions
                </button>
                <ResponsePane />
                <PromptInput />
              </>
            ) : (
              <ActionBar />
            )}
          </div>
          <footer className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            {pendingCount} items pending review
          </footer>
        </section>
      )}

      {/* Round button: opens or closes the widget */}
      <button
        type="button"
        aria-label={isOpen ? "Collapse assistant" : "Open Approvals Assistant"}
        onClick={() => setOpen(!isOpen)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg text-white shadow-lg hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span aria-hidden="true">{isOpen ? "✕" : "✦"}</span>
      </button>
    </div>
  );
}
