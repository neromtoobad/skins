/**
 * src/tools/from-vibe.ts — MCP tool: `generate_from_vibe`.
 *
 * Accepts a natural-language `vibe` string and returns a complete
 * design system in the canonical five-output shape:
 *
 *   { tokens, components, layout, preview, files }
 *
 * Pipeline:
 *   vibe  →  generateTokens()            → DesignTokens
 *         →  generateComponents(tokens)   → Record<ComponentName, tsx>
 *         →  generateLayout(tokens)       → DemoPage tsx
 *         →  generatePreview(tokens, layout) → self-contained HTML
 *
 * `components` and `files` contain the same component-name → TSX
 * mapping (the two keys are aliases for callers that want to splat
 * files to disk vs. inline them).
 *
 * The actual work is factored into the exported `generateFromVibe`
 * function so the MCP-tool wrapper and the in-process harness share
 * one code path. The harness script (used by AC-8 verification) calls
 * `generateFromVibe` directly.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateTokens, pickClosestPreset } from "../generators/tokens";
import { generateComponents } from "../generators/components";
import { generateLayout } from "../generators/layout";
import { generatePreview } from "../generators/preview";
import { searchPrompts } from "../scrapers/motionsites";
import { extractTokensFromPrompt } from "../scrapers/motionsites-token-extractor";
import type { DesignTokens, ToolOutput } from "../types";

/**
 * Which design source drove the generation, surfaced on the vibe tool's
 * output (documented in the README's canonical output shape). Exactly one
 * of `preset` / `motionsites` is populated: a strong motionsites match
 * (score >= 2) wins, otherwise the closest built-in preset is reported.
 */
export type VibeSource = {
  preset?: string;
  motionsites?: { name: string; category: string; promptUrl: string };
};

/** The vibe tool returns the canonical five outputs plus a `source`. */
export type VibeOutput = ToolOutput & { source: VibeSource };

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

/**
 * Inferred output type of the `generate_from_vibe` input schema.
 * Explicit type alias to break the deep-instantiation issue that
 * Zod 4 + the MCP SDK's compatibility layer triggers when the
 * schema is referenced inside `server.tool(...)` directly.
 */
export type GenerateFromVibeArgs = {
  vibe: string;
};

/** Zod raw shape for the `generate_from_vibe` input. */
const vibeInputShape: { vibe: z.ZodString } = {
  vibe: z
    .string()
    .min(1, "vibe must be a non-empty string")
    .describe(
      "Natural-language description of the desired design system. " +
        "Example: \"neon cyberpunk terminal aesthetic with magenta accents\".",
    ),
};

// ---------------------------------------------------------------------------
// Core pipeline (tool-body)
// ---------------------------------------------------------------------------

/**
 * Run the full pipeline: vibe → tokens → components → layout → preview,
 * and bundle the five outputs. This is the pure (no-MCP) entry point
 * used by both the MCP tool wrapper and the in-process harness.
 */
export async function generateFromVibe(vibe: string): Promise<VibeOutput> {
  // Check if a motionsites design matches the vibe (score >= 2 = strong match)
  const motionsitesResults = searchPrompts(vibe);
  const topMatch = motionsitesResults[0];
  const topScore = topMatch?.score ?? 0;

  let tokens: DesignTokens;
  let source: VibeSource;

  if (topScore >= 2) {
    // Strong motionsites match — derive tokens from the production design spec
    const extracted = extractTokensFromPrompt(topMatch);
    const baseTokens = await generateTokens({ vibe });
    // Merge: motionsites extracted values override the preset base
    tokens = {
      colors: extracted.colors ? { ...baseTokens.colors, ...extracted.colors } : baseTokens.colors,
      typography: extracted.typography
        ? {
            fontFamily: { ...baseTokens.typography.fontFamily, ...extracted.typography.fontFamily },
            fontSize: baseTokens.typography.fontSize,
            fontWeight: baseTokens.typography.fontWeight,
          }
        : baseTokens.typography,
      spacing: baseTokens.spacing,
      motion: extracted.motion ? { ...baseTokens.motion, ...extracted.motion } : baseTokens.motion,
      shadows: extracted.shadows ? { ...baseTokens.shadows, ...extracted.shadows } : baseTokens.shadows,
      radius: baseTokens.radius,
    };
    source = {
      motionsites: {
        name: topMatch.name,
        category: topMatch.category,
        promptUrl: topMatch.promptUrl,
      },
    };
  } else {
    // No strong motionsites match — use local preset
    tokens = await generateTokens({ vibe });
    source = { preset: pickClosestPreset(vibe).preset.name };
  }

  const components = generateComponents(tokens);
  const layout = generateLayout(tokens);
  const preview = generatePreview(tokens, layout);
  return {
    tokens,
    components,
    layout,
    preview,
    files: { ...components },
    source,
  };
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

/**
 * Register the `generate_from_vibe` tool on the supplied `McpServer`.
 *
 * The handler is intentionally thin: it parses `args.vibe` (already
 * validated by the Zod input schema), calls the pure `generateFromVibe`
 * pipeline, and wraps the result in a `CallToolResult` with both
 * `content` (a JSON-stringified `text` block) and `structuredContent`
 * (the raw object for clients that prefer typed payloads).
 */
export function registerFromVibe(server: McpServer): void {
  // The MCP SDK's `server.tool(...)` overload triggers a TypeScript
  // "Type instantiation is excessively deep" error (TS2589) with the
  // installed Zod 3.25 + SDK 1.29 combo, because the SDK's Zod
  // compatibility layer (z3 + z4 unions) blows up the generic
  // resolution. The runtime behavior is correct; the issue is purely
  // a type-checker limitation. We cast through `unknown` to bypass it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_from_vibe",
    "Convert a natural-language vibe (e.g. \"dark luxury crypto dashboard\") " +
      "into a complete React + Tailwind + Framer Motion design system. " +
      "Returns five outputs: tokens, components (5), layout (TSX), " +
      "preview (HTML), and files (component-name → TSX).",
    vibeInputShape,
    {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    async (args: GenerateFromVibeArgs) => {
      const vibe: string = args.vibe;
      const output = await generateFromVibe(vibe);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
        // Provide the raw object for clients that surface structured
        // tool output. Cast through `unknown` because the schema for
        // structuredContent is `Record<string, unknown>` while our
        // payload is a fully-typed `ToolOutput`.
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );
}
