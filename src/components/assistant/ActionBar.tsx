"use client";

import { useAssistantStore, type AssistantMode } from "@/store/assistantStore";

// The four action cards.
const MODES: { mode: AssistantMode; label: string; icon: string }[] = [
  { mode: "summary", label: "Present me Summary", icon: "📋" },
  { mode: "chat", label: "Talk to me", icon: "💬" },
  { mode: "help", label: "Help me", icon: "🛟" },
  { mode: "teach", label: "Teach me", icon: "🎓" },
];

/** The 2x2 grid of action cards. Clicking one opens that action. */
export function ActionBar() {
  const selectMode = useAssistantStore((state) => state.selectMode);

  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Assistant actions">
      {MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => selectMode(mode)}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:ring-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span aria-hidden="true" className="text-3xl">
            {icon}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
