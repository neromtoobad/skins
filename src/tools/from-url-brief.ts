/**
 * src/tools/from-url-brief.ts — MCP tool: `generate_brief_from_url`.
 *
 * Point skins-mcp at ANY site you love. It fetches the page, extracts its
 * design DNA (palette + roles, fonts, animation libraries, glass/gradient/
 * shadow usage, dark/light, radius style, structure), and returns a rich
 * BUILD BRIEF in that site's design language — for the model to build the
 * user's own page in that style. The "pull insane designs from the web"
 * path: the web is the reference library.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { extractSiteDNA, stylesheetHrefs } from "../scrapers/site-dna";
import { buildBriefFromDNA, type BriefResult } from "../generators/brief";

const DEFAULT_TIMEOUT_MS = 12_000;
const CSS_TIMEOUT_MS = 6_000;
const MAX_CSS_BYTES = 600_000;

/** Fetch up to a few same-origin stylesheets so palette/font extraction is deep. */
async function fetchLinkedCss(html: string, url: string): Promise<string> {
  const hrefs = stylesheetHrefs(html, url, 3);
  if (!hrefs.length) return "";
  const parts = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const r = await fetch(href, { signal: AbortSignal.timeout(CSS_TIMEOUT_MS), redirect: "follow" });
        if (!r.ok) return "";
        return (await r.text()).slice(0, MAX_CSS_BYTES);
      } catch {
        return "";
      }
    }),
  );
  return parts.join("\n");
}

export type FromUrlBriefResponse =
  | ({ ok: true } & BriefResult)
  | { ok: false; error: string };

/** Fetch a URL and turn its design DNA into a build brief. Never throws. */
export async function generateBriefFromUrl(url: string): Promise<FromUrlBriefResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": "skins-mcp/0.5 (+https://github.com/neromtoobad/skins)" },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (e) {
    return { ok: false, error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (e) {
    return { ok: false, error: `read body failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  try {
    const extraCss = await fetchLinkedCss(html, url);
    const dna = extractSiteDNA(html, url, extraCss);
    const brief = buildBriefFromDNA(dna);
    return { ok: true, ...brief };
  } catch (e) {
    return { ok: false, error: `extract failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const urlBriefInputShape = {
  url: z
    .string()
    .min(1, "url must be a non-empty string")
    .url("url must be a valid URL")
    .describe(
      "URL of a site whose design you want to channel. Examples: an Awwwards winner, " +
        "\"https://linear.app\", a competitor, any page you love the look of.",
    ),
};

export type GenerateBriefFromUrlArgs = { url: string };

export function registerFromUrlBrief(server: McpServer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_brief_from_url",
    "Point at ANY website you love and get a rich DESIGN BRIEF in that site's design language — " +
      "extracted palette + fonts + animation libraries + techniques + structure, plus a build directive " +
      "and image asset plan. Use this to redesign the user's content in the style of a reference site " +
      "(Awwwards winner, competitor, favourite app). Returns instructions for YOU to build, not canned " +
      "components. Returns { ok:false, error } if the URL is unreachable.",
    urlBriefInputShape,
    {
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async (args: GenerateBriefFromUrlArgs) => {
      const result = await generateBriefFromUrl(args.url);
      return {
        content: [
          {
            type: "text" as const,
            text: result.ok ? result.brief : JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
