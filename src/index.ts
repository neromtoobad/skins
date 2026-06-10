/**
 * skins-mcp — Model Context Protocol server entry point.
 *
 * This module wires together the three MCP tools (`generate_from_vibe`,
 * `generate_from_url`, `generate_from_image`) onto a single stdio transport.
 * The substantive implementation lives in:
 *   - src/types.ts                — shared TypeScript types
 *   - src/vibes/presets.ts        — built-in design presets
 *   - src/llm.ts                  — OpenAI-compatible LLM client
 *   - src/generators/tokens.ts    — token resolution
 *   - src/generators/components.ts — TSX component generation
 *   - src/generators/layout.ts    — full-page TSX layout
 *   - src/generators/preview.ts   — self-contained HTML preview
 *   - src/tools/from-vibe.ts      — vibe tool
 *   - src/tools/from-url.ts       — url tool
 *   - src/tools/from-image.ts     — image tool
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Build the MCP server and register the three design-system tools.
 * Exported for tests and for the demo driver.
 */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: "skins-mcp",
    version: "0.1.0",
  });

  // Tools are registered in later ACs (AC-8/AC-9/AC-10). The dynamic imports
  // keep the start path free of circular concerns while still being eager
  // enough to surface tool-registration errors at startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerFromVibe } = require("./tools/from-vibe") as typeof import("./tools/from-vibe");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerFromUrl } = require("./tools/from-url") as typeof import("./tools/from-url");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerFromImage } = require("./tools/from-image") as typeof import("./tools/from-image");

  registerFromVibe(server);
  registerFromUrl(server);
  registerFromImage(server);

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Single ready line on stderr (MCP clients read stdout).
  process.stderr.write("skins-mcp ready\n");
}

if (require.main === module) {
  main().catch((err: unknown) => {
    process.stderr.write(`skins-mcp failed to start: ${String(err)}\n`);
    process.exit(1);
  });
}
