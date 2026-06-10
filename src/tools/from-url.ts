/**
 * src/tools/from-url.ts — MCP tool: `generate_from_url`.
 *
 * Accepts `{ url: string }`, fetches the page, parses it with
 * `cheerio`, and extracts three design signals:
 *
 *   1. Up to 6 dominant hex colors from inline `style` attributes and
 *      the first `<style>` block (frequency-ranked).
 *   2. A list of `font-family` declarations from the same sources.
 *   3. A density hint — `"dense"` if the page is element-rich, else
 *      `"comfortable"`.
 *
 * The signals are forwarded to `generateTokens({ colors, fontHints })`
 * and the full pipeline is run (components → layout → preview). The
 * result is wrapped in an envelope `{ ok: true, ...ToolOutput }`. If
 * the URL is unreachable, the response is `{ ok: false, error }`
 * (the tool never throws for transport-level failures).
 */
import { z } from "zod";
import * as cheerio from "cheerio";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateTokens } from "../generators/tokens";
import { generateComponents } from "../generators/components";
import { generateLayout } from "../generators/layout";
import { generatePreview } from "../generators/preview";
import type { DesignTokens, ToolOutput } from "../types";

/** Local alias for the cheerio querying function. */
type CheerioAPI = ReturnType<typeof cheerio.load>;

// ---------------------------------------------------------------------------
// Public response envelope
// ---------------------------------------------------------------------------

/** Response envelope returned by the tool. Discriminated by `ok`. */
export type FromUrlResponse =
  | ({ ok: true } & ToolOutput)
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

/** Regex that matches 3/4/6/8-digit hex colors in CSS. */
const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

/** Regex that matches a `font-family: ...` declaration value. */
const FONT_FAMILY_RE = /font-family\s*:\s*([^;}\n]+)/gi;

/** Maximum number of dominant colors to forward to `generateTokens`. */
const MAX_COLORS = 6;

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Normalize a hex color to the 6-digit lowercase form with a leading
 * `#`. `#fff` and `#ffffff` collapse to the same canonical value.
 */
function normalizeHex(hex: string): string {
  let h = hex.toLowerCase();
  if (h.length === 4) {
    // #abc -> #aabbcc
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  } else if (h.length === 5) {
    // #abcd (with alpha) -> keep but expand
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] + h[4] + h[4];
  } else if (h.length === 9) {
    // #aabbccdd (with alpha) -> strip alpha
    h = h.slice(0, 7);
  }
  return h;
}

/**
 * Extract frequency-ranked hex colors from a string of CSS / HTML.
 * Returns a list of normalized 6-digit lowercase hex colors sorted
 * by occurrence count (descending).
 */
function extractColors(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(HEX_RE)) {
    const hex = normalizeHex(m[0]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
}

/**
 * Extract font-family names from a string. Splits on commas, trims,
 * strips quotes, and deduplicates while preserving first-seen order.
 */
function extractFonts(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(FONT_FAMILY_RE)) {
    const value = m[1];
    // Split on commas; each entry may be `Name`, `'Name'`, or `"Name"`.
    for (const raw of value.split(",")) {
      const name = raw
        .trim()
        .replace(/^["']/, "")
        .replace(/["']$/, "")
        .trim();
      if (!name) continue;
      // Skip CSS keywords and generic family names.
      if (/^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong)$/i.test(name)) {
        continue;
      }
      // Skip very short / weird tokens.
      if (name.length < 2) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

/**
 * Density hint heuristic.
 *
 * We count the total number of descendant elements under `<body>`
 * (the "node weight") and the average text length per direct child
 * of `<body>` (the "spacing signal"). A page that is element-heavy
 * with short text-per-child is `dense`; a page with large
 * spacious sections is `comfortable`.
 */
function extractDensity($: CheerioAPI): "dense" | "comfortable" {
  const body = $("body");
  if (body.length === 0) return "comfortable";

  // Total descendants (excluding the body element itself).
  let totalDescendants = 0;
  body.find("*").each(() => {
    totalDescendants += 1;
  });

  // Direct children of body — proxy for "section count".
  const directChildren = body.children().length;

  // Average text length per direct child.
  let totalText = 0;
  body.children().each((_, el) => {
    totalText += $(el).text().trim().length;
  });
  const avgTextPerChild = directChildren > 0 ? totalText / directChildren : 0;

  // Thresholds chosen so a typical marketing landing page (~ 5
  // sections, ~ 100 descendants) lands on `comfortable`, while a
  // dashboard / app shell (~ 30 sections, ~ 800 descendants) lands
  // on `dense`.
  if (totalDescendants > 500 || directChildren > 25) return "dense";
  if (avgTextPerChild > 0 && avgTextPerChild < 40 && directChildren > 10) return "dense";
  return "comfortable";
}

/**
 * Extract the design signals from a parsed cheerio document. Returns
 * the raw signals — `generateFromUrl` will forward them to
 * `generateTokens`.
 */
function extractSignals($: CheerioAPI): {
  colors: string[];
  fontHints: string[];
  density: "dense" | "comfortable";
} {
  // ----- colors: gather from inline styles + the first <style> block -----
  const colorBins = new Map<string, number>();

  function ingest(text: string): void {
    for (const hex of extractColors(text)) {
      colorBins.set(hex, (colorBins.get(hex) ?? 0) + 1);
    }
  }

  // Inline `style="..."` attributes on every element.
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    ingest(style);
  });

  // The first `<style>` block (if any).
  const firstStyle = $("style").first().text();
  if (firstStyle) ingest(firstStyle);

  const colors = [...colorBins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COLORS)
    .map(([hex]) => hex);

  // ----- fonts: gather from the same sources -----
  const fontSet = new Set<string>();

  $("[style]").each((_, el) => {
    for (const f of extractFonts($(el).attr("style") ?? "")) {
      fontSet.add(f);
    }
  });
  for (const f of extractFonts(firstStyle)) {
    fontSet.add(f);
  }
  const fontHints = [...fontSet];

  // ----- density -----
  const density = extractDensity($);

  return { colors, fontHints, density };
}

// ---------------------------------------------------------------------------
// Core pipeline (tool-body)
// ---------------------------------------------------------------------------

/**
 * Fetch the URL, parse it, extract design signals, and run the full
 * pipeline. Always returns a `FromUrlResponse`; never throws for
 * transport-level failures (network errors, non-2xx HTTP status,
 * malformed URLs, etc.).
 */
export async function generateFromUrl(url: string): Promise<FromUrlResponse> {
  // ----- 1. Fetch -----
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": "skins-mcp/0.1 (+https://github.com/skins-mcp)" },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `fetch failed: ${msg}` };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
  }

  // ----- 2. Read body -----
  let html: string;
  try {
    html = await response.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `read body failed: ${msg}` };
  }

  // ----- 3. Parse + extract -----
  let signals: ReturnType<typeof extractSignals>;
  try {
    const $ = cheerio.load(html);
    signals = extractSignals($);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `parse failed: ${msg}` };
  }

  // ----- 4. Run the pipeline -----
  // `generateTokens` will be called with whatever signals we have.
  // If we extracted colors, the token override will be applied; if
  // not, the closest preset (likely cyberpunk, the first declared)
  // will be used.
  let tokens: DesignTokens;
  try {
    tokens = await generateTokens({
      colors: signals.colors,
      fontHints: signals.fontHints,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `generateTokens failed: ${msg}` };
  }

  const components = generateComponents(tokens);
  const layout = generateLayout(tokens);
  const preview = generatePreview(tokens, layout);

  return {
    ok: true,
    tokens,
    components,
    layout,
    preview,
    files: { ...components },
  };
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

/** Zod input shape for the `generate_from_url` tool. */
const urlInputShape: { url: z.ZodString } = {
  url: z
    .string()
    .min(1, "url must be a non-empty string")
    .url("url must be a valid URL")
    .describe(
      "Absolute URL of a web page to scrape for design signals. " +
        "Example: \"https://example.com\".",
    ),
};

/** Inferred input type — kept as a named alias to break a TS2589
 *  instantiation issue in the MCP SDK + Zod combo. */
export type GenerateFromUrlArgs = { url: string };

export function registerFromUrl(server: McpServer): void {
  // The MCP SDK's `server.tool(...)` overload triggers a TypeScript
  // "Type instantiation is excessively deep" error (TS2589) with the
  // installed Zod 3.25 + SDK 1.29 combo. The runtime behavior is
  // correct; the issue is purely a type-checker limitation. We cast
  // through `unknown` to bypass it. (Same workaround as from-vibe.ts.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_from_url",
    "Scrape a public web page, extract its dominant colors / fonts / " +
      "density, and generate a design system that matches. Returns the " +
      "same five-output shape as `generate_from_vibe` (tokens, components, " +
      "layout, preview, files) on success, or `{ ok: false, error }` on " +
      "transport failure (unreachable URL, non-2xx response, etc.).",
    urlInputShape,
    {
      // Read-only: the tool doesn't modify any external state.
      readOnlyHint: true,
      // Not strictly idempotent (a URL's HTML can change between calls).
      idempotentHint: false,
      // Open world: the tool does interact with the public internet.
      openWorldHint: true,
    },
    async (args: GenerateFromUrlArgs) => {
      const result = await generateFromUrl(args.url);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        // Cast through `unknown` because the schema for
        // structuredContent is `Record<string, unknown>` while our
        // payload is a typed `FromUrlResponse`.
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
