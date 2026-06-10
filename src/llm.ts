/**
 * src/llm.ts — OpenAI-compatible LLM client.
 *
 * The real implementation arrives in AC-12. This stub exports the exact
 * surface `src/generators/tokens.ts` (AC-4) needs to call into and lets
 * `tsc --noEmit` pass today:
 *
 *   - `LlmUnavailableError`: thrown when the LLM cannot be reached
 *   - `callLlm(prompt, schema)`: returns a JSON value matching the schema
 *
 * The stub always throws `LlmUnavailableError`, so the LLM path in
 * `generateTokens` is a no-op at runtime and callers fall back to the
 * closest-scoring preset. AC-12 replaces this file with the real
 * implementation; no callers need to change.
 */
import type { z } from "zod";

/**
 * Thrown when the LLM client cannot fulfill a request — either because
 * `OPENAI_API_KEY` is missing, the endpoint is unreachable, or the model
 * returned a response that fails Zod validation. Callers (e.g.
 * `generateTokens`) catch this and fall back to preset-based behavior.
 */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

/**
 * Issue a chat completions request against the configured OpenAI-compatible
 * endpoint, asking the model to emit JSON that satisfies the provided
 * Zod schema. The real implementation lands in AC-12.
 *
 * For now this always throws `LlmUnavailableError`.
 */
export async function callLlm(
  _prompt: string,
  _schema: z.ZodType,
): Promise<unknown> {
  throw new LlmUnavailableError(
    "src/llm.ts is a stub — real LLM client ships in AC-12",
  );
}
