import { readFileSync } from "node:fs";
import path from "node:path";

/** One section of the policy document. */
export interface PolicyChunk {
  heading: string;
  body: string;
}

// Common words we ignore when matching a question.
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "how",
  "i", "in", "is", "it", "my", "of", "on", "or", "should", "that", "the", "to", "what", "when",
  "who", "with", "you", "your",
]);

/** Splits the policy text into sections, one for each "##" heading. */
export function chunkPolicy(markdown: string): PolicyChunk[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [heading = "", ...rest] = section.split("\n");
      return { heading: heading.trim(), body: rest.join("\n").trim() };
    })
    .filter((chunk) => chunk.body.length > 0);
}

// Turns text into simple lowercase words, without common words or endings like "s" or "ing".
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 3 ? word.replace(/(ing|ed|es|s)$/, "") : word));
}

/**
 * Finds the sections that best match the question.
 * Each shared word adds to the score, and a match in the heading counts double.
 * Sections with no matching word are left out.
 */
export function retrieveChunks(question: string, chunks: PolicyChunk[], topK = 3): PolicyChunk[] {
  const queryTerms = new Set(tokenize(question));
  if (queryTerms.size === 0) return [];

  return chunks
    .map((chunk) => {
      const headingTerms = new Set(tokenize(chunk.heading));
      const bodyTerms = tokenize(chunk.body);
      let score = 0;
      for (const term of queryTerms) {
        if (headingTerms.has(term)) score += 2;
        score += bodyTerms.filter((word) => word === term).length;
      }
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk }) => chunk);
}

// Read the policy file only once.
let cachedChunks: PolicyChunk[] | undefined;

/** Loads the policy file and returns its sections. */
export function loadPolicyChunks(): PolicyChunk[] {
  cachedChunks ??= chunkPolicy(
    readFileSync(path.join(process.cwd(), "src", "backend", "policy.md"), "utf-8"),
  );
  return cachedChunks;
}
