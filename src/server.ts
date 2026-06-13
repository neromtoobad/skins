/**
 * src/server.ts — HTTP/SSE transport for skins-mcp.
 *
 * Exposes the six MCP tools over HTTP so any developer can connect without
 * cloning the repo. Set PORT to override 3000.
 *
 * Optional lock: when SKINS_AUTH_TOKEN is set, /sse and /messages require it
 * (Bearer header or ?token=); /health stays open. Unset → open (default).
 *
 * Endpoints:
 *   GET  /sse      — SSE connection for MCP clients
 *   POST /messages — JSON-RPC message handler
 *   GET  /health   — { ok, tools, version, locked }
 */
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerFromVibe } from "./tools/from-vibe";
import { registerFromUrl } from "./tools/from-url";
import { registerFromImage } from "./tools/from-image";
import { registerFromMotionsites } from "./tools/from-motionsites";
import { registerFromBrief } from "./tools/from-brief";
import { registerFromUrlBrief } from "./tools/from-url-brief";
import { isAuthorized } from "./auth";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const AUTH_TOKEN = process.env.SKINS_AUTH_TOKEN;

/** Express gate — thin wrapper around the pure `isAuthorized` (tested in test/auth.test.ts). */
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (isAuthorized(req.headers.authorization, req.query.token as string | undefined, AUTH_TOKEN)) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized — provide the skins-mcp auth token" });
}

const TOOLS = [
  "generate_from_vibe",
  "generate_from_url",
  "generate_from_image",
  "generate_from_motionsites",
  "generate_brief",
  "generate_brief_from_url",
];

function buildServer(): McpServer {
  const server = new McpServer({ name: "skins-mcp", version: "0.8.3" });
  registerFromVibe(server);
  registerFromUrl(server);
  registerFromImage(server);
  registerFromMotionsites(server);
  registerFromBrief(server);
  registerFromUrlBrief(server);
  return server;
}

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // One transport per SSE connection
  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", requireAuth, async (req, res) => {
    const server = buildServer();
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on("close", () => {
      transports.delete(sessionId);
    });

    await server.connect(transport);
  });

  app.post("/messages", requireAuth, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, tools: TOOLS, version: "0.8.3", locked: Boolean(AUTH_TOKEN) });
  });

  app.listen(PORT, () => {
    process.stderr.write(`skins-mcp ready at http://localhost:${PORT}/sse\n`);
    process.stderr.write(`health: http://localhost:${PORT}/health\n`);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`skins-mcp server failed: ${String(err)}\n`);
  process.exit(1);
});
