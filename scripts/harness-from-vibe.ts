/**
 * Verification + harness for AC-8.
 *
 * This script exercises `generate_from_vibe` both as:
 *
 *   (a) a direct call to the pure `generateFromVibe(vibe)` function;
 *   (b) a registered MCP tool — by building a real McpServer, looking
 *       up the registered tool by name, and invoking its handler.
 *
 * In both cases the response must be non-null and contain all five
 * canonical keys: tokens, components, layout, preview, files.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateFromVibe, registerFromVibe } from "../src/tools/from-vibe";
import { presets } from "../src/vibes/presets";
import type { ToolOutput } from "../src/types";

const VIBE = "dark luxury crypto dashboard";

function checkShape(label: string, out: ToolOutput | null | undefined): void {
  if (out === null || out === undefined) {
    process.stderr.write(`  FAIL [${label}]: response is null/undefined\n`);
    process.exitCode = 1;
    return;
  }
  const required = ["tokens", "components", "layout", "preview", "files"];
  for (const key of required) {
    if (!(key in out)) {
      process.stderr.write(`  FAIL [${label}]: response is missing key "${key}"\n`);
      process.exitCode = 1;
      return;
    }
    const v = (out as unknown as Record<string, unknown>)[key];
    if (v === null || v === undefined) {
      process.stderr.write(`  FAIL [${label}]: response["${key}"] is null/undefined\n`);
      process.exitCode = 1;
      return;
    }
    if (typeof v === "string" && v.length === 0) {
      process.stderr.write(`  FAIL [${label}]: response["${key}"] is an empty string\n`);
      process.exitCode = 1;
      return;
    }
  }
  // components must have exactly 5 entries (Button, Card, Input, Navbar, StatCard)
  const comps = out.components as Record<string, string>;
  const expectedComponents = ["Button", "Card", "Input", "Navbar", "StatCard"];
  for (const name of expectedComponents) {
    if (!(name in comps)) {
      process.stderr.write(`  FAIL [${label}]: response.components is missing "${name}"\n`);
      process.exitCode = 1;
      return;
    }
    if (typeof comps[name] !== "string" || comps[name].length < 200) {
      process.stderr.write(`  FAIL [${label}]: response.components.${name} is not a non-trivial string\n`);
      process.exitCode = 1;
      return;
    }
  }
  // files is an alias of components
  const files = out.files as Record<string, string>;
  if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify(expectedComponents.slice().sort())) {
    process.stderr.write(`  FAIL [${label}]: response.files does not have the same keys as components\n`);
    process.exitCode = 1;
    return;
  }
  // tokens must be a populated DesignTokens bundle
  const tokens = out.tokens;
  if (!tokens.colors || !tokens.typography || !tokens.motion) {
    process.stderr.write(`  FAIL [${label}]: response.tokens is missing colors/typography/motion\n`);
    process.exitCode = 1;
    return;
  }
  // layout + preview are non-trivial strings
  if (typeof out.layout !== "string" || out.layout.length < 1000) {
    process.stderr.write(`  FAIL [${label}]: response.layout is not a non-trivial string (got ${typeof out.layout} of length ${(out.layout as unknown as { length: number })?.length})\n`);
    process.exitCode = 1;
    return;
  }
  if (typeof out.preview !== "string" || out.preview.length < 1000) {
    process.stderr.write(`  FAIL [${label}]: response.preview is not a non-trivial string (got ${typeof out.preview} of length ${(out.preview as unknown as { length: number })?.length})\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`  PASS [${label}]: all 5 keys populated, components has 5 entries, layout=${out.layout.length}c, preview=${out.preview.length}c\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`Running AC-8 harness with vibe: "${VIBE}"\n`);

  // ----- (a) direct call to the pure function -----
  process.stdout.write("\n[a] Direct call to generateFromVibe:\n");
  const direct = await generateFromVibe(VIBE);
  checkShape("direct", direct);

  // ----- (b) call through the registered MCP tool handler -----
  process.stdout.write("\n[b] Call via McpServer.registerFromVibe handler:\n");
  const server = new McpServer({ name: "skins-mcp-test", version: "0.0.0" });
  registerFromVibe(server);

  // The MCP SDK exposes registered tools via its internal map. The
  // public API is to start the server + send JSON-RPC, but for the
  // purpose of an in-process harness we walk the map and invoke the
  // handler directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  const registered = s._registeredTools ?? s.registeredTools ?? null;
  if (!registered) {
    process.stderr.write("  FAIL: could not find registered tools on McpServer (internal map name changed?)\n");
    process.exitCode = 1;
    return;
  }
  const tool = registered["generate_from_vibe"];
  if (!tool) {
    process.stderr.write("  FAIL: tool 'generate_from_vibe' is not registered on the server\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`  PASS: tool 'generate_from_vibe' is registered (description starts: ${(tool.description ?? "").slice(0, 60)}...)\n`);

  // The handler signature is (args, extra) → CallToolResult. We pass
  // a minimal `extra` object because we don't need any of its fields.
  const handler = tool.handler;
  if (typeof handler !== "function") {
    process.stderr.write("  FAIL: registered tool has no callable handler\n");
    process.exitCode = 1;
    return;
  }
  const result = await handler({ vibe: VIBE }, { signal: new AbortController().signal } as unknown);
  // The handler returns a CallToolResult with content[].text being the
  // JSON-stringified ToolOutput AND structuredContent being the raw
  // object. We verify the structuredContent (typed payload).
  if (typeof result !== "object" || result === null) {
    process.stderr.write(`  FAIL: handler returned a non-object result (${typeof result})\n`);
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray((result as { content?: unknown }).content)) {
    process.stderr.write("  FAIL: handler result.content is not an array\n");
    process.exitCode = 1;
    return;
  }
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  if (content.length === 0 || content[0].type !== "text") {
    process.stderr.write("  FAIL: handler result.content[0] is not a text block\n");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`  PASS: handler returned a CallToolResult with ${content.length} content block(s), text length = ${content[0].text.length} chars\n`);

  // Parse the text content and verify the shape
  const parsed = JSON.parse(content[0].text) as ToolOutput;
  checkShape("via-handler-text", parsed);

  // structuredContent (typed payload)
  const sc = (result as { structuredContent?: unknown }).structuredContent;
  if (sc === undefined) {
    process.stdout.write("  NOTE: handler did not include structuredContent (still passes AC-8 spec — content[0].text is the canonical payload)\n");
  } else {
    checkShape("via-handler-structured", sc as ToolOutput);
  }

  // ----- Vibe scoring sanity check -----
  // "dark luxury crypto dashboard" should match the "luxury" preset
  // (keywords: "luxury", "luxurious", "elegant", "premium", "high-end",
  // "jewel", "serif", "rich", "opulent", "sophisticated", "champagne",
  // "velvet", "haute", "couture", "gilded"). Let's confirm.
  process.stdout.write("\n[c] Vibe scoring sanity check:\n");
  const primary = direct.tokens.colors.primary;
  const luxuryPrimary = presets.luxury.tokens.colors.primary;
  if (primary === luxuryPrimary) {
    process.stdout.write(`  PASS: vibe matched luxury preset (primary = ${primary}, expected ${luxuryPrimary})\n`);
  } else {
    process.stdout.write(`  NOTE: vibe primary = ${primary}, luxury primary = ${luxuryPrimary} (still passes AC-8 — only the 5-key shape is required)\n`);
  }

  if (process.exitCode !== 1) {
    process.stdout.write("\nall checks passed\n");
  } else {
    process.stderr.write("\none or more checks failed\n");
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`harness crashed: ${String(e)}\n`);
  process.exit(1);
});
