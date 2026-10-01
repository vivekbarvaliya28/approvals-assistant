"use client";

import { useState } from "react";
import { ApprovalList } from "@/components/assistant/ApprovalList";
import { useAssistantStore } from "@/store/assistantStore";

/** The page the assistant lives in: the operator's approvals queue. */
export function ApprovalsWorkspace() {
  const approvals = useAssistantStore((state) => state.approvals);
  // What the user typed in the search box.
  const [query, setQuery] = useState("");

  // Keep only the rows that match the search (title or person). No search = show all.
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? approvals.filter((approval) =>
        `${approval.title} ${approval.submittedBy}`.toLowerCase().includes(normalized),
      )
    : approvals;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Approvals &amp; Review</h1>
      <input
        aria-label="Search approvals"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search approvals by title or author…"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
      <ApprovalList approvals={visible} />
    </div>
  );
}
