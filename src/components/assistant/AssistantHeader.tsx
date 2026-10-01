"use client";

import { useAssistantStore } from "@/store/assistantStore";

// Shared look for the small header buttons.
const iconButton =
  "rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";

/** Dark top bar with the title, an expand button and a close button. */
export function AssistantHeader() {
  const isExpanded = useAssistantStore((state) => state.isExpanded);
  const toggleExpanded = useAssistantStore((state) => state.toggleExpanded);
  const setOpen = useAssistantStore((state) => state.setOpen);

  return (
    <header className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm"
      >
        ✦
      </div>
      <h2 className="flex-1 text-sm font-semibold">Approvals</h2>
      <button
        type="button"
        aria-label={isExpanded ? "Shrink assistant" : "Expand assistant"}
        onClick={toggleExpanded}
        className={iconButton}
      >
        <span aria-hidden="true">{isExpanded ? "⤡" : "⤢"}</span>
      </button>
      <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className={iconButton}>
        <span aria-hidden="true">✕</span>
      </button>
    </header>
  );
}
