import type { Approval } from "@/lib/schemas";

// Shared instructions that give the AI its role and writing style.
export const PERSONA =
  "You are the Approvals Assistant inside a security-patrol operations console. " +
  "Be concise, calm and practical. Use plain text only (no markdown symbols like ** or #); " +
  "short numbered or dashed lists are fine.";

/** Turns a language code like "hi-IN" into a name like "Hindi". Unknown codes become "English". */
export function languageName(locale?: string): string {
  if (!locale) return "English";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? "English";
  } catch {
    return "English";
  }
}

/** Writes the approvals as short text lines that the AI can read. */
export function formatApprovals(approvals: Approval[]): string {
  return approvals
    .map(
      (a, i) =>
        `${i + 1}. id: ${a.id} | "${a.title}" | type: ${a.type} | submitted by: ${a.submittedBy} | status: ${a.status} | submitted: ${a.submittedOn}`,
    )
    .join("\n");
}
