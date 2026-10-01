import { z } from "zod";

// Treats an empty value (like "KEY=") as "not set".
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value : undefined));

const EnvSchema = z.object({
  // Optional: with no key, every AI action shows its backup answer.
  OPENAI_API_KEY: optionalString,
  // Optional: use another provider that works like OpenAI (for example Groq).
  OPENAI_BASE_URL: optionalString,
  OPENAI_MODEL: z.string().min(1).default("gpt-4o"),
  // Maximum wait for the AI, in milliseconds.
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  // Rate limit: max requests allowed in one time window.
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof EnvSchema>;

/** Reads and checks the settings from the environment. */
export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}
