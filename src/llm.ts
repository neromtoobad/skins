/**
 * src/llm.ts — OpenAI-compatible LLM client for skins-mcp.
 *
 * The LLM path is *optional* — every generator falls back to a built-in
 * preset when the LLM is unavailable or fails. This module is the
 * single point of contact with the model provider.
 *
 * Exports
 * -------
 *   - `LlmUnavailableError`: thrown when the LLM cannot fulfill a
 *     request. Callers (e.g. `generateTokens`) catch this and fall
 *     back to the closest-scoring preset. Other failure modes (HTTP
 *     4xx/5xx, malformed JSON, empty content) are also wrapped in
 *     this error so the fallback path is uniform.
 *
 *   - `callLlm(prompt, schema)`: issues a chat completions request
 *     against the configured OpenAI-compatible endpoint, asking the
 *     model to emit a single JSON object that satisfies the supplied
 *     Zod schema. Returns the parsed JSON. The caller is expected to
 *     validate the result against `schema` (this module does not do
 *     the Zod parse — it just guarantees the LLM emitted *parseable*
 *     JSON, not that it matches the caller's schema).
 *
 * Environment
 * -----------
 *   - `OPENAI_API_KEY`   (required): the bearer token used by the
 *                        client. If missing, `callLlm` throws
 *                        `LlmUnavailableError` immediately.
 *   - `OPENAI_BASE_URL`  (optional, default `https://api.openai.com/v1`):
 *                        override the base URL to point at any
 *                        OpenAI-compatible endpoint (LM Studio, Ollama
 *                        with the OpenAI shim, Azure, Together, etc.).
 *   - `OPENAI_MODEL`     (optional, default `gpt-4o-mini`): the model
 *                        name passed to `chat.completions.create`.
 *
 * The client is created lazily on first use and not cached across
 * calls — the construction cost is negligible compared to a network
 * round-trip, and avoiding the cache makes test isolation trivial.
 */
import OpenAI from "openai";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Public error type
// ---------------------------------------------------------------------------

/**
 * Thrown when the LLM cannot fulfill a request — either because
 * `OPENAI_API_KEY` is missing, the endpoint is unreachable, the model
 * returned an empty response, or the model's content was not valid
 * JSON. Callers (e.g. `generateTokens`) catch this and fall back to
 * preset-based behavior.
 */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
    // Restore the prototype chain — when targeting ES5, `class`
    // inheritance can lose the `instanceof` link otherwise.
    Object.setPrototypeOf(this, LlmUnavailableError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default base URL when `OPENAI_BASE_URL` is unset. */
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/** Default model when `OPENAI_MODEL` is unset. */
const DEFAULT_MODEL = "gpt-4o-mini";

/** Per-request timeout. The OpenAI SDK uses milliseconds here. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Sampling temperature for design-system generation. */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Hard cap on the response size. The full `DesignTokens` payload is
 * well under 1 KiB of JSON, so 4096 tokens is plenty of headroom and
 * prevents a runaway model from burning the caller's quota.
 */
const DEFAULT_MAX_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Environment helpers (exposed for tests)
// ---------------------------------------------------------------------------

/**
 * Read the LLM configuration from the environment. Returns `null`
 * for `apiKey` when the variable is missing or empty. Exported so
 * the harness can assert on the env-var contract without poking
 * `process.env` directly.
 */
export interface LlmEnvConfig {
  apiKey: string | null;
  baseURL: string;
  model: string;
}

export function readLlmEnv(env: NodeJS.ProcessEnv = process.env): LlmEnvConfig {
  const apiKeyRaw = env.OPENAI_API_KEY;
  const apiKey = typeof apiKeyRaw === "string" && apiKeyRaw.length > 0 ? apiKeyRaw : null;
  const baseURLRaw = env.OPENAI_BASE_URL;
  const baseURL = typeof baseURLRaw === "string" && baseURLRaw.length > 0
    ? baseURLRaw
    : DEFAULT_BASE_URL;
  const modelRaw = env.OPENAI_MODEL;
  const model = typeof modelRaw === "string" && modelRaw.length > 0
    ? modelRaw
    : DEFAULT_MODEL;
  return { apiKey, baseURL, model };
}

// ---------------------------------------------------------------------------
// Client construction
// ---------------------------------------------------------------------------

/**
 * Build an `OpenAI` SDK client. Throws `LlmUnavailableError` when
 * the API key is missing — every other configuration choice has a
 * default.
 *
 * Exported (named `createOpenAIClient`) so the test harness can
 * construct a client pointing at a local mock HTTP server without
 * mutating the env vars it has to clean up afterwards.
 */
export function createOpenAIClient(config: LlmEnvConfig): OpenAI {
  if (!config.apiKey) {
    throw new LlmUnavailableError(
      "OPENAI_API_KEY is not set — LLM features require an API key. " +
        "Set OPENAI_API_KEY in the environment, or rely on the built-in " +
        "design presets (no API key required).",
    );
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
  });
}

// ---------------------------------------------------------------------------
// System-message construction
// ---------------------------------------------------------------------------

/**
 * Build the system message that primes the model to emit JSON
 * matching the supplied Zod schema. We rely on the Zod type's
 * `.description` (if set) for a short hint; the detailed schema
 * itself is the caller's responsibility to describe in the user
 * prompt — see `buildLlmPrompt` in `src/generators/tokens.ts`.
 */
function buildSystemMessage(schema: z.ZodType): string {
  const hint = schema.description && schema.description.length > 0
    ? schema.description
    : "(shape details are in the user prompt)";
  return [
    "You are a design-system generator.",
    "You MUST respond with a single valid JSON object that conforms to the schema described in the user's message.",
    "Do not include any commentary, markdown, or code fences — only the raw JSON object.",
    "Do not include any keys not present in the schema.",
    `Schema description: ${hint}`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Issue a chat completions request against the configured OpenAI-
 * compatible endpoint, asking the model to emit JSON that satisfies
 * the supplied Zod schema. Returns the parsed JSON value (the caller
 * is responsible for the final Zod validation).
 *
 * Throws `LlmUnavailableError` when:
 *   - `OPENAI_API_KEY` is missing
 *   - the HTTP request fails (network error, non-2xx response, etc.)
 *   - the model returns an empty `content` field
 *   - the model's `content` is not valid JSON
 */
export async function callLlm(
  prompt: string,
  schema: z.ZodType,
): Promise<unknown> {
  const envConfig = readLlmEnv();
  // Construction throws `LlmUnavailableError` if the API key is
  // missing; the throw propagates directly.
  const client = createOpenAIClient(envConfig);

  // ----- 1. Issue the chat completion -----
  let completionContent: string | null | undefined;
  try {
    const completion = await client.chat.completions.create({
      model: envConfig.model,
      messages: [
        { role: "system", content: buildSystemMessage(schema) },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: DEFAULT_MAX_TOKENS,
    });
    completionContent = completion.choices?.[0]?.message?.content;
  } catch (e) {
    // Re-throw our own errors unchanged so the message stays clean.
    if (e instanceof LlmUnavailableError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new LlmUnavailableError(`LLM request failed: ${msg}`);
  }

  // ----- 2. Validate the response has content -----
  if (typeof completionContent !== "string" || completionContent.length === 0) {
    throw new LlmUnavailableError("LLM returned an empty response");
  }

  // ----- 3. Parse the JSON content -----
  try {
    return JSON.parse(completionContent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new LlmUnavailableError(
      `LLM returned invalid JSON: ${msg} (content starts with: ${JSON.stringify(completionContent.slice(0, 80))})`,
    );
  }
}
