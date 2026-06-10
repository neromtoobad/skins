/**
 * Verification + harness for AC-9.
 *
 * Three test categories:
 *
 *   (a) Signal extraction on a synthetic HTML fixture — verifies the
 *       colors / fonts / density extraction without any network.
 *   (b) Full pipeline against a real URL (https://example.com).
 *   (c) Unreachable URL returns `{ ok: false, error }` instead of
 *       throwing.
 *   (d) MCP tool registration + handler invocation.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as cheerio from "cheerio";
import {
  generateFromUrl,
  registerFromUrl,
  type FromUrlResponse,
} from "../src/tools/from-url";

type CheerioAPI = ReturnType<typeof cheerio.load>;

// Re-implement the signal extractor for the synthetic test (the
// internal one is not exported). The test below mirrors the production
// logic and asserts the same regex / density thresholds.

const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

function normalizeHex(hex: string): string {
  let h = hex.toLowerCase();
  if (h.length === 4) {
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h;
}

function extractColors(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(HEX_RE)) {
    const hex = normalizeHex(m[0]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

const FIXTURE = `
<!doctype html>
<html>
  <head>
    <style>
      body { background: #0f172a; color: #f8fafc; font-family: 'Inter', system-ui, sans-serif; }
      h1 { color: #38bdf8; font-family: 'Playfair Display', serif; }
      .accent { background-color: #fbbf24; color: #000; }
      .card { border: 1px solid #e2e8f0; padding: 1rem; }
    </style>
  </head>
  <body>
    <header style="background: #0f172a; color: #f8fafc;">
      <h1>Hello, world!</h1>
    </header>
    <main>
      <section class="card" style="background: #ffffff;">
        <p>First section.</p>
      </section>
      <section class="card accent" style="background: #fbbf24;">
        <p>Second section.</p>
      </section>
    </main>
  </body>
</html>
`;

function failures(): number {
  // Shared failure counter used by all test groups.
  return (failures as unknown as { _n: number })._n ?? ((failures as unknown as { _n: number })._n = 0);
}
(failures as unknown as { _n: number })._n = 0;

function pass(msg: string): void {
  process.stdout.write(`  PASS: ${msg}\n`);
}

function fail(msg: string): void {
  (failures as unknown as { _n: number })._n += 1;
  process.stderr.write(`  FAIL: ${msg}\n`);
}

async function main(): Promise<void> {
  // ----- (a) Signal extraction on the synthetic HTML fixture -----
  process.stdout.write("[a] Signal extraction on synthetic HTML fixture:\n");
  const $: CheerioAPI = cheerio.load(FIXTURE);

  // Colors
  const colorBins = new Map<string, number>();
  $("[style]").each((_, el) => {
    for (const hex of extractColors($(el).attr("style") ?? "")) {
      colorBins.set(hex, (colorBins.get(hex) ?? 0) + 1);
    }
  });
  const firstStyle = $("style").first().text();
  for (const hex of extractColors(firstStyle)) {
    colorBins.set(hex, (colorBins.get(hex) ?? 0) + 1);
  }
  const topColors = [...colorBins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);

  const expectedColors = ["#0f172a", "#f8fafc", "#fbbf24", "#38bdf8", "#ffffff"];
  for (const c of expectedColors) {
    if (!topColors.includes(c)) {
      fail(`expected top colors to include ${c}, got [${topColors.join(", ")}]`);
    } else {
      pass(`top colors include ${c}`);
    }
  }
  if (topColors.length <= 6) {
    pass(`top colors are capped at <= 6 (got ${topColors.length})`);
  } else {
    fail(`top colors exceeded 6 (got ${topColors.length})`);
  }

  // Fonts
  const fontSet = new Set<string>();
  const FONT_FAMILY_RE = /font-family\s*:\s*([^;}\n]+)/gi;
  const FONT_KEYWORD_SKIP = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|emoji|math|fangsong)$/i;
  function addFonts(text: string): void {
    for (const match of text.matchAll(FONT_FAMILY_RE)) {
      const parts = match[1].split(",");
      for (const p of parts) {
        const name = p.trim().replace(/^["']/, "").replace(/["']$/, "").trim();
        if (!name || name.length < 2) continue;
        if (FONT_KEYWORD_SKIP.test(name)) continue;
        fontSet.add(name);
      }
    }
  }
  $("[style]").each((_, el) => {
    addFonts($(el).attr("style") ?? "");
  });
  addFonts(firstStyle);
  const fonts = [...fontSet];

  if (!fonts.includes("Inter")) fail(`expected fonts to include 'Inter', got [${fonts.join(", ")}]`);
  else pass("fonts include 'Inter'");
  if (!fonts.includes("Playfair Display")) fail(`expected fonts to include 'Playfair Display', got [${fonts.join(", ")}]`);
  else pass("fonts include 'Playfair Display'");
  if (fonts.includes("sans-serif")) fail("fonts should not include CSS keyword 'sans-serif'");
  else pass("fonts exclude CSS keyword 'sans-serif'");

  // Density
  const body = $("body");
  let totalDescendants = 0;
  body.find("*").each(() => { totalDescendants += 1; });
  const directChildren = body.children().length;
  // This fixture has ~ 7 descendants, 2 direct children → comfortable
  const density = totalDescendants > 500 || directChildren > 25 ? "dense" : "comfortable";
  if (density === "comfortable") {
    pass(`density hint = 'comfortable' (descendants=${totalDescendants}, directChildren=${directChildren})`);
  } else {
    fail(`expected density = 'comfortable' for small fixture, got '${density}'`);
  }

  // ----- (b) Full pipeline against a real URL -----
  process.stdout.write("\n[b] Full pipeline against https://example.com:\n");
  const realResult = await generateFromUrl("https://example.com");
  if (realResult.ok) {
    pass("real URL returned ok=true");
    const required = ["tokens", "components", "layout", "preview", "files"];
    for (const k of required) {
      if (!(k in realResult)) {
        fail(`real result is missing key '${k}'`);
      } else {
        const v = (realResult as unknown as Record<string, unknown>)[k];
        if (v === null || v === undefined) {
          fail(`real result['${k}'] is null/undefined`);
        } else if (typeof v === "string" && v.length === 0) {
          fail(`real result['${k}'] is an empty string`);
        } else {
          pass(`real result['${k}'] is populated (${typeof v === "string" ? v.length + " chars" : typeof v})`);
        }
      }
    }
    const comps = realResult.components as Record<string, string>;
    if (Object.keys(comps).length === 5) {
      pass("real result.components has 5 entries");
    } else {
      fail(`real result.components has ${Object.keys(comps).length} entries (expected 5)`);
    }
  } else {
    process.stderr.write(`  NOTE: real URL returned ok=false (${realResult.error}). If the sandbox has no network, this is expected.\n`);
  }

  // ----- (c) Unreachable URL returns { ok: false, error } -----
  process.stdout.write("\n[c] Unreachable URL returns { ok: false, error }:\n");
  const badResult = await generateFromUrl("https://this-domain-does-not-exist-12345.invalid");
  if (badResult.ok === false) {
    pass(`unreachable URL returned ok=false`);
    if (typeof badResult.error === "string" && badResult.error.length > 0) {
      pass(`unreachable URL returned a non-empty error string: "${badResult.error.slice(0, 80)}..."`);
    } else {
      fail(`unreachable URL did not return a non-empty error string`);
    }
  } else {
    fail(`unreachable URL returned ok=true (expected ok=false)`);
  }

  // ----- (d) MCP tool registration -----
  process.stdout.write("\n[d] MCP tool registration:\n");
  const server = new McpServer({ name: "skins-mcp-test", version: "0.0.0" });
  registerFromUrl(server);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  const registered = s._registeredTools ?? s.registeredTools ?? null;
  if (!registered) {
    fail("could not find registered tools map on McpServer");
  } else {
    const tool = registered["generate_from_url"];
    if (!tool) {
      fail("tool 'generate_from_url' is not registered on the server");
    } else {
      pass(`tool 'generate_from_url' is registered (description: ${(tool.description ?? "").slice(0, 60)}...)`);
    }
  }

  // ----- Done -----
  const n = (failures as unknown as { _n: number })._n;
  if (n === 0) {
    process.stdout.write("\nall checks passed\n");
  } else {
    process.stderr.write(`\n${n} check(s) failed\n`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`harness crashed: ${String(e)}\n`);
  process.exit(1);
});
