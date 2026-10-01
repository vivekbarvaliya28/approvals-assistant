"use client";

import { useAssistantStore } from "@/store/assistantStore";

/** Shows the greeting and the "Replay Greeting" link. */
export function GreetingBar() {
  const greeting = useAssistantStore((state) => state.greeting);
  const loadGreeting = useAssistantStore((state) => state.loadGreeting);
  // Disable Replay while a greeting is still loading.
  const busy = greeting.status === "loading" || greeting.status === "streaming";

  return (
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">Approvals</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadGreeting()}
          className="font-semibold text-amber-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Replay Greeting
        </button>
      </div>
      <p className="mt-1 min-h-[1.25rem] text-sm text-slate-800" aria-live="polite">
        {greeting.status === "loading" && <span className="animate-pulse text-slate-500">Preparing your greeting…</span>}
        {greeting.status === "error" && <span>Welcome back. ({greeting.error})</span>}
        {(greeting.status === "streaming" || greeting.status === "done") && greeting.text}
      </p>
    </div>
  );
}
