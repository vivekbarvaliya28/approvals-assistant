import type { Approval } from "@/lib/schemas";

/** The table of approvals shown on the main page. */
export function ApprovalList({ approvals }: { approvals: Approval[] }) {
  return (
    <section aria-label="Pending approval requests" className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pending approval requests
        <span className="rounded-full bg-slate-100 px-2 py-0.5 normal-case tracking-normal">{approvals.length} items</span>
      </div>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Content name</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Submitted by</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {approvals.map((approval) => (
            <tr key={approval.id}>
              <td className="px-4 py-3 font-medium">{approval.title}</td>
              <td className="px-4 py-3 text-slate-600">{approval.type}</td>
              <td className="px-4 py-3 text-slate-600">{approval.submittedBy}</td>
              <td className="px-4 py-3 text-slate-600">{approval.submittedOn}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{approval.status}</span>
              </td>
            </tr>
          ))}
          {/* Shown when the search finds nothing */}
          {approvals.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No approvals match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
