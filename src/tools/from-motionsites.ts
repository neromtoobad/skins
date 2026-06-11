/**
 * src/tools/from-motionsites.ts — MCP tool: `generate_from_motionsites`
 *
 * Browse or generate a full design system from the motionsites.ai
 * production hero section library (65+ designs bundled locally).
 *
 * Modes:
 *   closest — find best matching design, generate full system from it
 *   list    — return matching design names + categories (no generation)
 *   random  — pick a random match, generate full system
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchPrompts } from "../scrapers/motionsites";
import { extractTokensFromPrompt } from "../scrapers/motionsites-token-extractor";
import { listPresets } from "../vibes/presets";
import { generateComponents } from "../generators/components";
import { generateLayout } from "../generators/layout";
import { generatePreview } from "../generators/preview";
import type { DesignTokens, ToolOutput } from "../types";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type FromMotionsitesListResponse = {
  ok: true;
  mode: "list";
  query: string;
  total: number;
  matches: Array<{
    name: string;
    category: string;
    type: string;
    score: number;
    promptUrl: string;
  }>;
};

export type FromMotionsitesGenerateResponse = {
  ok: true;
  mode: "closest" | "random";
  source: {
    name: string;
    category: string;
    type: string;
    promptUrl: string;
    animationKeywords: string[];
  };
} & ToolOutput;

export type FromMotionsitesErrorResponse = {
  ok: false;
  error: string;
};

export type FromMotionsitesResponse =
  | FromMotionsitesListResponse
  | FromMotionsitesGenerateResponse
  | FromMotionsitesErrorResponse;

// ---------------------------------------------------------------------------
// Token merging
// ---------------------------------------------------------------------------

function mergeTokens(base: DesignTokens, overrides: Partial<DesignTokens>): DesignTokens {
  return {
    colors: overrides.colors
      ? { ...base.colors, ...overrides.colors }
      : base.colors,
    typography: overrides.typography
      ? {
          fontFamily: { ...base.typography.fontFamily, ...overrides.typography.fontFamily },
          fontSize: { ...base.typography.fontSize, ...overrides.typography.fontSize },
          fontWeight: { ...base.typography.fontWeight, ...overrides.typography.fontWeight },
        }
      : base.typography,
    spacing: overrides.spacing
      ? { ...base.spacing, ...overrides.spacing }
      : base.spacing,
    motion: overrides.motion
      ? { ...base.motion, ...overrides.motion }
      : base.motion,
    shadows: overrides.shadows
      ? { ...base.shadows, ...overrides.shadows }
      : base.shadows,
    radius: overrides.radius
      ? { ...base.radius, ...overrides.radius }
      : base.radius,
  };
}

// ---------------------------------------------------------------------------
// Base preset selection
// ---------------------------------------------------------------------------

function pickBasePreset(query: string): DesignTokens {
  const allPresets = listPresets();

  // Score each preset against the query
  const q = query.toLowerCase();
  let best = allPresets[0];
  let bestScore = 0;

  for (const preset of allPresets) {
    const score = preset.keywords.filter(kw => q.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }

  return best.tokens;
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

export async function generateFromMotionsites(
  query: string,
  mode: "closest" | "list" | "random" = "closest",
): Promise<FromMotionsitesResponse> {
  try {
    const results = searchPrompts(query);

    if (mode === "list") {
      return {
        ok: true,
        mode: "list",
        query,
        total: results.length,
        matches: results.slice(0, 20).map(r => ({
          name: r.name,
          category: r.category,
          type: r.type,
          score: r.score,
          promptUrl: r.promptUrl,
        })),
      };
    }

    // Pick a prompt
    const chosen = mode === "random"
      ? results[Math.floor(Math.random() * Math.min(results.length, 10))]
      : results[0];

    if (!chosen) {
      return { ok: false, error: `No motionsites designs found for query: "${query}"` };
    }

    // Extract tokens from the chosen prompt
    const extracted = extractTokensFromPrompt(chosen);

    // Get base preset tokens (fallback structure)
    const baseTokens = pickBasePreset(query);

    // Merge: motionsites extracted values override base preset
    const tokens = mergeTokens(baseTokens, extracted);

    // Run the standard generation pipeline
    const components = generateComponents(tokens);
    const layout = generateLayout(tokens);
    const preview = generatePreview(tokens, layout);

    return {
      ok: true,
      mode: mode === "random" ? "random" : "closest",
      source: {
        name: chosen.name,
        category: chosen.category,
        type: chosen.type,
        promptUrl: chosen.promptUrl,
        animationKeywords: chosen.animationKeywords,
      },
      tokens,
      components,
      layout,
      preview,
      files: { ...components },
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message ?? String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

const motionsitesInputShape = {
  query: z
    .string()
    .min(1, "query must be a non-empty string")
    .describe(
      'Design name, category, or keyword. Examples: "dark saas hero", "portfolio", "Apex SaaS", "neon cyberpunk", "glassmorphism agency".',
    ),
  mode: z
    .enum(["closest", "list", "random"])
    .optional()
    .describe(
      '"closest" (default) finds the best matching design and generates a full system. ' +
      '"list" returns all matches without generating (use to browse first). ' +
      '"random" picks a random match and generates.',
    ),
};

export function registerFromMotionsites(server: McpServer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_from_motionsites",
    "Generate a complete React + Tailwind + Framer Motion design system from the motionsites.ai " +
      "production hero section library (65+ real designs covering SaaS, agency, portfolio, Web3, fintech, and more). " +
      "Pass a design name like 'Apex SaaS', a category like 'portfolio', or any keyword like 'dark glassmorphism'. " +
      "Returns five outputs: tokens, components (5), layout (TSX), preview (HTML), files, plus a source field " +
      "showing which motionsites design drove the generation.",
    motionsitesInputShape,
    {
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    async (args: { query: string; mode?: "closest" | "list" | "random" }) => {
      const output = await generateFromMotionsites(args.query, args.mode ?? "closest");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );
}
