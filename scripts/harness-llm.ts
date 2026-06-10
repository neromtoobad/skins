/**
 * Verification + harness for AC-12.
 *
 * Test groups:
 *
 *   (a) Module surface — `LlmUnavailableError` is an `Error` subclass
 *       and `callLlm` + `readLlmEnv` are exported functions.
 *
 *   (b) Env-var contract — `readLlmEnv` honors `OPENAI_API_KEY`,
 *       `OPENAI_BASE_URL`, and `OPENAI_MODEL`, and falls back to
 *       documented defaults when they're unset.
 *
 *   (c) Missing-key path — `callLlm` throws `LlmUnavailableError`
 *       immediately when `OPENAI_API_KEY` is missing, without making
 *       a network call.
 *
 *   (d) Happy path via a local mock HTTP server. The mock server
 *       asserts that the request includes the right path
 *       (`/v1/chat/completions`), the right HTTP method (POST), the
 *       right body shape (model, messages with system + user roles,
 *       `response_format: { type: "json_object" }`, the
 *       `Authorization: Bearer ...` header), and returns a fake
 *       OpenAI response so we can verify the JSON-parsing branch.
 *
 *   (e) Failure modes via the same mock — invalid JSON content,
 *       empty content, and HTTP 500 all surface as
 *       `LlmUnavailableError` (not raw SDK errors or other types).
 *
 *   (f) End-to-end with the real `generateTokens` LLM-refine path —
 *       a vibe that doesn't match any preset (score 0) and a
 *       reachable mock server should produce a successful fallback
 *       when the LLM is unavailable, and (in theory) a refined
 *       design when the mock returns valid tokens. We assert the
 *       unavailable branch here to keep the test deterministic.
 */
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import {
  callLlm,
  LlmUnavailableError,
  readLlmEnv,
  createOpenAIClient,
} from "../src/llm";
import { generateTokens } from "../src/generators/tokens";

let failed = 0;
function pass(msg: string): void { process.stdout.write(`  PASS: ${msg}\n`); }
function fail(msg: string): void { failed += 1; process.stderr.write(`  FAIL: ${msg}\n`); }

interface CapturedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
  parsedBody: Record<string, unknown> | null;
}

interface MockResponse {
  status: number;
  contentType: string;
  body: string;
}

type MockHandler = (req: CapturedRequest) => MockResponse;

/**
 * Start a local HTTP server on a random port that pretends to be an
 * OpenAI-compatible chat completions endpoint. The supplied handler
 * decides the response based on the captured request. Returns the
 * port, a request-capture array, and a `close()` function.
 */
function startMockOpenAI(handler: MockHandler): Promise<{
  port: number;
  requests: CapturedRequest[];
  baseURL: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolveStart, rejectStart) => {
    const requests: CapturedRequest[] = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        let parsed: Record<string, unknown> | null = null;
        try { parsed = JSON.parse(body); } catch { /* ignore */ }
        const captured: CapturedRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
          parsedBody: parsed,
        };
        requests.push(captured);
        let response: MockResponse;
        try {
          response = handler(captured);
        } catch (e) {
          response = { status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: (e as Error).message } }) };
        }
        res.writeHead(response.status, { "Content-Type": response.contentType });
        res.end(response.body);
      });
    });
    server.on("error", rejectStart);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      const baseURL = `http://127.0.0.1:${port}/v1`;
      resolveStart({
        port,
        requests,
        baseURL,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

/** Build a minimal but valid OpenAI chat completion response body. */
function fakeCompletion(content: string, model = "test-model"): string {
  return JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1_700_000_000,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, refusal: null },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

async function main(): Promise<void> {
  // ----- (a) Module surface -----
  process.stdout.write("[a] Module surface (LlmUnavailableError + callLlm + readLlmEnv):\n");
  if (typeof callLlm === "function") pass("callLlm is a function");
  else fail("callLlm is not a function");
  if (typeof readLlmEnv === "function") pass("readLlmEnv is a function");
  else fail("readLlmEnv is not a function");
  if (typeof createOpenAIClient === "function") pass("createOpenAIClient is a function");
  else fail("createOpenAIClient is not a function");
  if (typeof LlmUnavailableError === "function") pass("LlmUnavailableError is a class");
  else fail("LlmUnavailableError is not a class");

  const sampleError = new LlmUnavailableError("test");
  if (sampleError instanceof Error) pass("LlmUnavailableError extends Error");
  else fail("LlmUnavailableError does not extend Error");
  if (sampleError.name === "LlmUnavailableError") pass("LlmUnavailableError.name is 'LlmUnavailableError'");
  else fail(`LlmUnavailableError.name is ${JSON.stringify(sampleError.name)} (expected 'LlmUnavailableError')`);
  if (sampleError instanceof LlmUnavailableError) pass("instanceof LlmUnavailableError works");
  else fail("instanceof LlmUnavailableError fails");

  // ----- (b) Env-var contract -----
  process.stdout.write("\n[b] readLlmEnv honors env vars and defaults:\n");
  const allUnset = readLlmEnv({});
  if (allUnset.apiKey === null) pass("readLlmEnv returns apiKey=null when OPENAI_API_KEY is unset");
  else fail(`readLlmEnv.apiKey = ${JSON.stringify(allUnset.apiKey)} (expected null)`);
  if (allUnset.baseURL === "https://api.openai.com/v1") pass(`readLlmEnv.baseURL defaults to 'https://api.openai.com/v1'`);
  else fail(`readLlmEnv.baseURL = ${JSON.stringify(allUnset.baseURL)} (expected default)`);
  if (allUnset.model === "gpt-4o-mini") pass(`readLlmEnv.model defaults to 'gpt-4o-mini'`);
  else fail(`readLlmEnv.model = ${JSON.stringify(allUnset.model)} (expected default)`);

  const allSet = readLlmEnv({
    OPENAI_API_KEY: "sk-test-123",
    OPENAI_BASE_URL: "https://api.example.com/v1",
    OPENAI_MODEL: "gpt-4o",
  });
  if (allSet.apiKey === "sk-test-123") pass("readLlmEnv returns apiKey when OPENAI_API_KEY is set");
  else fail(`readLlmEnv.apiKey = ${JSON.stringify(allSet.apiKey)} (expected 'sk-test-123')`);
  if (allSet.baseURL === "https://api.example.com/v1") pass("readLlmEnv.baseURL honors OPENAI_BASE_URL");
  else fail(`readLlmEnv.baseURL = ${JSON.stringify(allSet.baseURL)}`);
  if (allSet.model === "gpt-4o") pass("readLlmEnv.model honors OPENAI_MODEL");
  else fail(`readLlmEnv.model = ${JSON.stringify(allSet.model)}`);

  // createOpenAIClient throws when apiKey is null
  try {
    createOpenAIClient({ apiKey: null, baseURL: "x", model: "y" });
    fail("createOpenAIClient did not throw when apiKey is null");
  } catch (e) {
    if (e instanceof LlmUnavailableError) pass("createOpenAIClient throws LlmUnavailableError when apiKey is null");
    else fail(`createOpenAIClient threw ${(e as Error).constructor.name}, not LlmUnavailableError`);
  }

  // ----- (c) callLlm throws when OPENAI_API_KEY is missing -----
  process.stdout.write("\n[c] callLlm throws LlmUnavailableError when OPENAI_API_KEY is missing:\n");
  const savedKey = process.env.OPENAI_API_KEY;
  const savedBase = process.env.OPENAI_BASE_URL;
  const savedModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;

  try {
    await callLlm("test prompt", z.object({ foo: z.string() }));
    fail("callLlm did not throw when OPENAI_API_KEY is missing");
  } catch (e) {
    if (e instanceof LlmUnavailableError) {
      pass(`callLlm threw LlmUnavailableError: "${e.message.slice(0, 60)}..."`);
    } else {
      fail(`callLlm threw ${(e as Error).constructor.name}, not LlmUnavailableError`);
    }
  }

  // ----- (d) Happy path via local mock -----
  process.stdout.write("\n[d] Happy path via local mock OpenAI server:\n");
  process.env.OPENAI_API_KEY = "sk-test-123";
  process.env.OPENAI_MODEL = "gpt-4o-test";

  let capturedBodyForTest = "";
  const mock = await startMockOpenAI((req) => {
    capturedBodyForTest = req.body;
    return {
      status: 200,
      contentType: "application/json",
      body: fakeCompletion('{"primary":"red-500","secondary":"blue-500"}', "gpt-4o-test"),
    };
  });
  process.env.OPENAI_BASE_URL = mock.baseURL;

  try {
    const testSchema = z.object({
      primary: z.string(),
      secondary: z.string(),
    }).describe("Two-color palette");
    const result = await callLlm("Generate colors", testSchema);
    if (typeof result === "object" && result !== null) {
      pass(`callLlm returned an object: ${JSON.stringify(result)}`);
    } else {
      fail(`callLlm did not return an object (got ${typeof result})`);
    }
    if ((result as Record<string, unknown>).primary === "red-500" && (result as Record<string, unknown>).secondary === "blue-500") {
      pass("callLlm correctly parsed the JSON content");
    } else {
      fail(`callLlm returned the wrong values: ${JSON.stringify(result)}`);
    }

    // Verify the request body sent by the SDK.
    if (mock.requests.length === 1) pass(`mock server received exactly 1 request`);
    else fail(`mock server received ${mock.requests.length} requests (expected 1)`);
    const sent = mock.requests[0];
    if (sent.method === "POST") pass(`request method is POST`);
    else fail(`request method is ${sent.method} (expected POST)`);
    if (sent.url && sent.url.includes("/chat/completions")) pass(`request path includes /chat/completions (got ${sent.url})`);
    else fail(`request path does not include /chat/completions (got ${sent.url})`);
    const auth = sent.headers.authorization;
    if (auth === "Bearer sk-test-123") pass(`Authorization header is 'Bearer sk-test-123'`);
    else fail(`Authorization header is ${JSON.stringify(auth)}`);
    if (sent.parsedBody) {
      if (sent.parsedBody.model === "gpt-4o-test") pass(`body.model = 'gpt-4o-test' (from OPENAI_MODEL)`);
      else fail(`body.model = ${JSON.stringify(sent.parsedBody.model)} (expected 'gpt-4o-test')`);
      if (sent.parsedBody.response_format &&
          typeof sent.parsedBody.response_format === "object" &&
          (sent.parsedBody.response_format as Record<string, unknown>).type === "json_object") {
        pass(`body.response_format = { type: 'json_object' }`);
      } else {
        fail(`body.response_format = ${JSON.stringify(sent.parsedBody.response_format)} (expected { type: 'json_object' })`);
      }
      const messages = sent.parsedBody.messages as Array<{ role: string; content: string }> | undefined;
      if (Array.isArray(messages) && messages.length === 2) {
        pass(`body.messages has 2 entries`);
        if (messages[0].role === "system" && messages[0].content.toLowerCase().includes("json")) {
          pass(`messages[0] is a system message instructing JSON output`);
        } else {
          fail(`messages[0] is ${JSON.stringify(messages[0])} (expected system message with JSON instruction)`);
        }
        if (messages[1].role === "user" && messages[1].content === "Generate colors") {
          pass(`messages[1] is the user prompt verbatim`);
        } else {
          fail(`messages[1] is ${JSON.stringify(messages[1])}`);
        }
      } else {
        fail(`body.messages has ${Array.isArray(messages) ? messages.length : "non-array"} entries (expected 2)`);
      }
      if (typeof sent.parsedBody.temperature === "number") {
        pass(`body.temperature is a number (${sent.parsedBody.temperature})`);
      } else {
        fail(`body.temperature is ${JSON.stringify(sent.parsedBody.temperature)}`);
      }
      if (typeof sent.parsedBody.max_tokens === "number") {
        pass(`body.max_tokens is a number (${sent.parsedBody.max_tokens})`);
      } else {
        fail(`body.max_tokens is ${JSON.stringify(sent.parsedBody.max_tokens)}`);
      }
    } else {
      fail("request body is not valid JSON");
    }
  } finally {
    await mock.close();
  }

  // ----- (e) Failure modes -----
  process.stdout.write("\n[e] Failure modes (invalid JSON / empty content / HTTP 500):\n");

  // (e.1) Non-JSON content
  const mockInvalid = await startMockOpenAI(() => ({
    status: 200,
    contentType: "application/json",
    body: fakeCompletion("this is not valid json at all"),
  }));
  process.env.OPENAI_BASE_URL = mockInvalid.baseURL;
  try {
    await callLlm("test", z.object({}));
    fail("callLlm did not throw on invalid JSON content");
  } catch (e) {
    if (e instanceof LlmUnavailableError && e.message.toLowerCase().includes("invalid json")) {
      pass(`invalid JSON → LlmUnavailableError: "${e.message.slice(0, 80)}..."`);
    } else {
      fail(`invalid JSON → wrong error: ${(e as Error).message}`);
    }
  }
  await mockInvalid.close();

  // (e.2) Empty content
  const mockEmpty = await startMockOpenAI(() => ({
    status: 200,
    contentType: "application/json",
    body: fakeCompletion(""),
  }));
  process.env.OPENAI_BASE_URL = mockEmpty.baseURL;
  try {
    await callLlm("test", z.object({}));
    fail("callLlm did not throw on empty content");
  } catch (e) {
    if (e instanceof LlmUnavailableError && e.message.toLowerCase().includes("empty")) {
      pass(`empty content → LlmUnavailableError: "${e.message}"`);
    } else {
      fail(`empty content → wrong error: ${(e as Error).message}`);
    }
  }
  await mockEmpty.close();

  // (e.3) HTTP 500
  const mock500 = await startMockOpenAI(() => ({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({
      error: { message: "Internal server error", type: "server_error", code: "internal_error" },
    }),
  }));
  process.env.OPENAI_BASE_URL = mock500.baseURL;
  try {
    await callLlm("test", z.object({}));
    fail("callLlm did not throw on HTTP 500");
  } catch (e) {
    if (e instanceof LlmUnavailableError) {
      pass(`HTTP 500 → LlmUnavailableError: "${e.message.slice(0, 80)}..."`);
    } else {
      fail(`HTTP 500 → wrong error: ${(e as Error).message}`);
    }
  }
  await mock500.close();

  // ----- (f) End-to-end with generateTokens (unavailable path) -----
  process.stdout.write("\n[f] End-to-end with generateTokens (LLM unavailable → preset fallback):\n");
  // Force the unavailable path by clearing the API key.
  delete process.env.OPENAI_API_KEY;
  // Use a vibe that doesn't match any preset (score 0) to ensure the
  // LLM refine path is actually exercised.
  const tokens = await generateTokens({ vibe: "an exotic vibe that matches no preset at all xyzzy" });
  if (tokens && tokens.colors && tokens.typography && tokens.motion) {
    pass(`generateTokens returned a populated DesignTokens bundle (primary=${tokens.colors.primary})`);
  } else {
    fail("generateTokens returned a malformed bundle");
  }
  if (tokens.colors.primary && tokens.colors.primary.includes("-")) {
    pass(`fallback primary is a Tailwind tier name: ${tokens.colors.primary}`);
  } else {
    fail(`fallback primary is not a Tailwind tier: ${JSON.stringify(tokens.colors.primary)}`);
  }

  // ----- Done -----
  // Restore env vars
  if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  if (savedBase !== undefined) process.env.OPENAI_BASE_URL = savedBase;
  if (savedModel !== undefined) process.env.OPENAI_MODEL = savedModel;

  if (failed === 0) {
    process.stdout.write("\nall checks passed\n");
  } else {
    process.stderr.write(`\n${failed} check(s) failed\n`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`harness crashed: ${String(e)}\n`);
  process.exit(1);
});
