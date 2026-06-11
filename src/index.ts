/**
 * skins-mcp — Model Context Protocol server entry point.
 *
 * This module wires together the four MCP tools (`generate_from_vibe`,
 * `generate_from_url`, `generate_from_image`, `generate_from_motionsites`)
 * onto a single stdio transport. The substantive implementation lives in:
 *   - src/types.ts                — shared TypeScript types
 *   - src/vibes/presets.ts        — built-in design presets
 *   - src/llm.ts                  — OpenAI-compatible LLM client
 *   - src/generators/tokens.ts    — token resolution
 *   - src/generators/components.ts — TSX component generation
 *   - src/generators/layout.ts    — full-page TSX layout
 *   - src/generators/preview.ts   — self-contained HTML preview
 *   - src/scrapers/motionsites.ts — bundled motionsites.ai prompt library
 *   - src/tools/from-vibe.ts      — vibe tool
 *   - src/tools/from-url.ts       — url tool
 *   - src/tools/from-image.ts     — image tool
 *   - src/tools/from-motionsites.ts — motionsites tool
 *
 * Entry-point contract (AC-11):
 *   1. Build a single `McpServer` instance.
 *   2. Register all four tools on it via the per-tool `register*` helpers.
 *   3. Connect to a `StdioServerTransport` (the de-facto MCP transport for
 *      local tool servers).
 *   4. Log a single `skins-mcp ready` line to stderr — MCP clients read
 *      stdout, so this goes to stderr to keep the JSON-RPC stream clean.
 *   5. Install SIGINT / SIGTERM handlers so a `kill %1` from a smoke-test
 *      harness (`npx ts-node src/index.ts &; sleep 2; kill %1`) shuts
 *      down the transport cleanly instead of dropping the connection
 *      mid-handshake.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { writeSync } from "node:fs";
import { registerFromVibe } from "./tools/from-vibe";
import { registerFromUrl } from "./tools/from-url";
import { registerFromImage } from "./tools/from-image";
import { registerFromMotionsites } from "./tools/from-motionsites";

/**
 * Build the MCP server and register the four design-system tools.
 * Exported for tests and for the demo driver.
 */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: "skins-mcp",
    version: "0.2.0",
  });

  // Register every tool on the single server instance. The registrations
  // are synchronous (the SDK's `server.tool(...)` call appends to an
  // internal map) so any tool-registration error surfaces here.
  registerFromVibe(server);
  registerFromUrl(server);
  registerFromImage(server);
  registerFromMotionsites(server);

  return server;
}

/**
 * Connect a `McpServer` to a `StdioServerTransport` and return the
 * transport, so the caller (tests, the `main()` entry point) can
 * manage its lifecycle. The transport starts reading from stdin and
 * is ready to accept JSON-RPC messages as soon as `connect()` resolves.
 */
export async function connectStdio(
  server: McpServer,
): Promise<{ transport: StdioServerTransport }> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return { transport };
}

async function main(): Promise<void> {
  const server = buildServer();
  const { transport } = await connectStdio(server);

  // Single ready line on stderr. We use the synchronous `writeSync(2,
  // ...)` form (fd 2 = stderr) rather than the async
  // `process.stderr.write(...)` so the line is flushed immediately —
  // under ts-node, the async write is buffered, and a SIGTERM sent
  // ~2s after startup can race the write callback and lose the line.
  // The synchronous write is small (16 bytes) so the perf cost is
  // negligible, and the "no exceptions thrown" requirement of AC-11
  // is unaffected.
  writeSync(2, "skins-mcp ready\n");

  // Install clean-shutdown signal handlers. The MCP spec doesn't
  // mandate any specific shutdown choreography, but the AC-11 test
  // pattern (`npx ts-node src/index.ts &; sleep 2; kill %1`) sends
  // SIGTERM, and we want the process to exit 0 rather than die on an
  // unhandled `Transport has been closed` exception.
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    writeSync(2, `skins-mcp shutting down on ${signal}\n`);
    void transport.close().then(
      () => process.exit(0),
      (err: unknown) => {
        writeSync(
          2,
          `skins-mcp shutdown error: ${(err as Error).message ?? String(err)}\n`,
        );
        process.exit(1);
      },
    );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    process.stderr.write(`skins-mcp failed to start: ${String(err)}\n`);
    process.exit(1);
  });
}
