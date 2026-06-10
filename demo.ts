/**
 * demo.ts — end-to-end driver for skins-mcp.
 *
 * Runs all three MCP tools (vibe / url / image) without requiring an API key
 * and writes the resulting tokens, components, layout, preview, and README
 * into `demo-output/{vibe,url,image}/`. Implemented in AC-13; this stub
 * keeps the documented tree complete and `npm run build` working from AC-1.
 */

async function main(): Promise<void> {
  // Intentionally a no-op for AC-1. The real driver is added in AC-13.
  process.stderr.write("skins-mcp demo: stub (AC-13 will implement the full driver)\n");
}

if (require.main === module) {
  main().catch((err: unknown) => {
    process.stderr.write(`demo failed: ${String(err)}\n`);
    process.exit(1);
  });
}
