/**
 * src/tools/from-brief.ts — MCP tool: `generate_brief`.
 *
 * The "make it cook" tool. Unlike the other four tools, this does NOT
 * return canned components — it returns a rich DESIGN BRIEF + build
 * directive that instructs the calling model (Claude / Codex) to build a
 * complete, ambitious, heavily-animated page, adapting a curated
 * motionsites.ai direction to the user's own content.
 *
 * The brief text is the primary payload: it lands in the model's context
 * as an instruction. `structuredContent` carries the machine-readable
 * source / palette / techniques for programmatic callers.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildBrief, type BriefResult } from "../generators/brief";

export type GenerateBriefArgs = {
  query: string;
  target?: string;
};

const briefInputShape = {
  query: z
    .string()
    .min(1, "query must be a non-empty string")
    .describe(
      "Design direction / vibe / category. Examples: \"bold sports broadcast\", " +
        "\"dark luxury fintech dashboard\", \"editorial 3d portfolio\", \"neon web3 landing\".",
    ),
  target: z
    .string()
    .optional()
    .describe(
      "Optional: what you're redesigning — paste the page's purpose, sections, and key " +
        "content/data so the brief adapts to it. If omitted, the brief is generic to the vibe.",
    ),
};

/** Pure entry point (shared by the MCP wrapper and any in-process caller). */
export function generateBrief(query: string, target?: string): BriefResult {
  return buildBrief(query, target);
}

export function registerFromBrief(server: McpServer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_brief",
    "Return a rich DESIGN BRIEF + build directive that instructs YOU (the assistant) to build a " +
      "complete, production-grade, heavily-animated page — adapting a curated motionsites.ai design " +
      "direction to the user's content. Use this when the user wants an ambitious or \"insane\" UI, a " +
      "full redesign, or a landing/hero page, and you intend to write the code yourself. Unlike the " +
      "other tools, this returns INSTRUCTIONS to build (palette, motion, technique toolkit, quality " +
      "bar), not finished components. After calling it, build the page following the brief.",
    briefInputShape,
    {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    async (args: GenerateBriefArgs) => {
      const result = generateBrief(args.query, args.target);
      return {
        content: [
          {
            type: "text" as const,
            text: result.brief,
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
