/**
 * Verification + harness for AC-10.
 *
 * Four test groups:
 *
 *   (a) Synthetic 64×64 PNG with three solid color quadrants — verifies
 *       the k-means-lite quantizer extracts roughly the three expected
 *       colors (red / green / blue) and maps them to Tailwind tiers.
 *   (b) Full pipeline against a larger 256×256 gradient PNG — verifies
 *       the canonical five outputs are all populated.
 *   (c) Error envelope — invalid base64, empty base64, and corrupted
 *       image data all return `{ ok: false, error }` rather than
 *       throwing.
 *   (d) MCP tool registration + handler invocation.
 *   (e) Color-override contract — the first three palette colors must
 *       drive `tokens.colors.primary/secondary/accent`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import sharp from "sharp";
import {
  generateFromImage,
  registerFromImage,
  type FromImageResponse,
  type ExtractedPalette,
} from "../src/tools/from-image";
import { presets } from "../src/vibes/presets";
import { closestTailwind } from "../src/generators/tokens";
import type { ToolOutput } from "../src/types";

function checkShape(label: string, out: FromImageResponse): boolean {
  if (!out.ok) {
    process.stderr.write(`  FAIL [${label}]: tool returned ok=false: ${out.error}\n`);
    return false;
  }
  const required = ["tokens", "components", "layout", "preview", "files", "palette"];
  for (const k of required) {
    if (!(k in out)) {
      process.stderr.write(`  FAIL [${label}]: response is missing key "${k}"\n`);
      return false;
    }
    const v = (out as unknown as Record<string, unknown>)[k];
    if (v === null || v === undefined) {
      process.stderr.write(`  FAIL [${label}]: response["${k}"] is null/undefined\n`);
      return false;
    }
  }
  // components must have 5 entries.
  const comps = out.components as Record<string, string>;
  const expected = ["Button", "Card", "Input", "Navbar", "StatCard"];
  for (const name of expected) {
    if (!(name in comps)) {
      process.stderr.write(`  FAIL [${label}]: response.components is missing "${name}"\n`);
      return false;
    }
    if (typeof comps[name] !== "string" || comps[name].length < 200) {
      process.stderr.write(`  FAIL [${label}]: response.components.${name} is not a non-trivial string\n`);
      return false;
    }
  }
  // layout / preview non-trivial.
  if (typeof out.layout !== "string" || out.layout.length < 1000) {
    process.stderr.write(`  FAIL [${label}]: response.layout is too short (${out.layout.length}c)\n`);
    return false;
  }
  if (typeof out.preview !== "string" || out.preview.length < 1000) {
    process.stderr.write(`  FAIL [${label}]: response.preview is too short (${out.preview.length}c)\n`);
    return false;
  }
  // tokens must be a populated DesignTokens bundle.
  if (!out.tokens.colors || !out.tokens.typography || !out.tokens.motion) {
    process.stderr.write(`  FAIL [${label}]: response.tokens is missing colors/typography/motion\n`);
    return false;
  }
  // palette must have at least 1 entry; arrays parallel.
  const pal = out.palette as ExtractedPalette;
  if (!Array.isArray(pal.hex) || pal.hex.length === 0) {
    process.stderr.write(`  FAIL [${label}]: response.palette.hex is empty\n`);
    return false;
  }
  if (pal.hex.length !== pal.counts.length || pal.hex.length !== pal.tierNames.length) {
    process.stderr.write(`  FAIL [${label}]: response.palette arrays are not parallel (hex=${pal.hex.length}, counts=${pal.counts.length}, tierNames=${pal.tierNames.length})\n`);
    return false;
  }
  process.stdout.write(`  PASS [${label}]: all 5+1 keys populated, components has 5 entries, layout=${out.layout.length}c, preview=${out.preview.length}c, palette=[${pal.hex.join(", ")}]\n`);
  return true;
}

async function main(): Promise<void> {
  let failed = 0;
  function pass(msg: string): void { process.stdout.write(`  PASS: ${msg}\n`); }
  function fail(msg: string): void { failed += 1; process.stderr.write(`  FAIL: ${msg}\n`); }

  // ----- (a) Synthetic 64×64 PNG with three solid color quadrants -----
  process.stdout.write("[a] Synthetic 64×64 PNG (red+green+blue quadrants):\n");
  // Build the pixel buffer directly — `sharp.composite` turns out to be
  // finicky with 3-channel sources (the resulting PNG carries 4
  // channels and the composites don't always land). Raw pixel writes
  // are simpler and produce the exact RGB pattern we want.
  const W = 64, H = 64;
  const quadBuf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (y < 32 && x < 32) {
        // top-left: red
        quadBuf[i] = 220; quadBuf[i + 1] = 38; quadBuf[i + 2] = 38;
      } else if (y < 32) {
        // top-right: green
        quadBuf[i] = 22; quadBuf[i + 1] = 163; quadBuf[i + 2] = 74;
      } else {
        // bottom half: blue
        quadBuf[i] = 37; quadBuf[i + 1] = 99; quadBuf[i + 2] = 235;
      }
    }
  }
  const quad64 = await sharp(quadBuf, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
  const quad64B64 = quad64.toString("base64");
  const aResult = await generateFromImage(quad64B64, "image/png");
  if (!aResult.ok) {
    fail(`synthetic quad returned ok=false: ${aResult.error}`);
  } else {
    const pal = aResult.palette;
    pass(`extracted ${pal.hex.length} colors: [${pal.hex.join(", ")}]`);
    pass(`Tailwind tiers: [${pal.tierNames.join(", ")}]`);
    // At least 2 of the 3 expected colors should be present as tierNames.
    const expectedTiers = ["red-600", "red-700", "red-500", "red-800", "red-400"];
    const expectedGreens = ["green-600", "green-700", "green-500", "green-800", "green-400"];
    const expectedBlues = ["blue-600", "blue-700", "blue-500", "blue-800", "blue-400"];
    const has = (set: string[]) => set.some((t) => pal.tierNames.includes(t));
    if (has(expectedTiers)) pass("palette includes a red tier");
    else fail(`palette has no red tier: [${pal.tierNames.join(", ")}]`);
    if (has(expectedGreens)) pass("palette includes a green tier");
    else fail(`palette has no green tier: [${pal.tierNames.join(", ")}]`);
    if (has(expectedBlues)) pass("palette includes a blue tier");
    else fail(`palette has no blue tier: [${pal.tierNames.join(", ")}]`);
    if (checkShape("synthetic-quad", aResult)) {
      // checkShape already PASS-ed; nothing more to do.
    } else {
      failed += 1; // count the failure (checkShape doesn't bump our counter)
    }
  }

  // ----- (b) Full pipeline against a larger 256×256 gradient PNG -----
  process.stdout.write("\n[b] Full pipeline against 256×256 gradient PNG:\n");
  const grad = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{
      input: await sharp({
        create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
               <defs>
                 <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                   <stop offset="0%" stop-color="#d946ef"/>
                   <stop offset="100%" stop-color="#22d3ee"/>
                 </linearGradient>
               </defs>
               <rect width="256" height="256" fill="url(#g)"/>
             </svg>`,
          ),
          top: 0, left: 0,
        }])
        .png()
        .toBuffer(),
      top: 0, left: 0,
    }])
    .png()
    .toBuffer();
  const gradB64 = grad.toString("base64");
  const bResult = await generateFromImage(gradB64, "image/png");
  if (checkShape("gradient", bResult)) {
    pass("gradient pipeline returned all 5+1 keys populated");
  } else {
    failed += 1;
  }

  // ----- (c) Error envelope -----
  process.stdout.write("\n[c] Error envelope (invalid base64 / empty / corrupted):\n");
  // (c.1) empty base64
  const c1 = await generateFromImage("", "image/png");
  if (c1.ok === false && typeof c1.error === "string" && c1.error.length > 0) {
    pass(`empty base64 → ok=false: "${c1.error}"`);
  } else {
    fail(`empty base64 did not return ok=false envelope (got ok=${(c1 as { ok: boolean }).ok})`);
  }
  // (c.2) garbage base64 that decodes to non-image bytes
  const c2 = await generateFromImage("not-really-base64-at-all-just-text", "image/png");
  if (c2.ok === false && typeof c2.error === "string" && c2.error.length > 0) {
    pass(`garbage base64 → ok=false: "${c2.error.slice(0, 80)}..."`);
  } else {
    fail(`garbage base64 did not return ok=false envelope (got ok=${(c2 as { ok: boolean }).ok})`);
  }
  // (c.3) valid base64 of a non-image
  const nonImageB64 = Buffer.from("this is definitely not an image").toString("base64");
  const c3 = await generateFromImage(nonImageB64, "image/png");
  if (c3.ok === false && typeof c3.error === "string" && c3.error.length > 0) {
    pass(`non-image bytes → ok=false: "${c3.error.slice(0, 80)}..."`);
  } else {
    fail(`non-image bytes did not return ok=false envelope (got ok=${(c3 as { ok: boolean }).ok})`);
  }

  // ----- (d) MCP tool registration -----
  process.stdout.write("\n[d] MCP tool registration + handler invocation:\n");
  const server = new McpServer({ name: "skins-mcp-test", version: "0.0.0" });
  registerFromImage(server);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  const registered = s._registeredTools ?? s.registeredTools ?? null;
  if (!registered) {
    fail("could not find registered tools map on McpServer");
  } else {
    const tool = registered["generate_from_image"];
    if (!tool) {
      fail("tool 'generate_from_image' is not registered on the server");
    } else {
      pass(`tool 'generate_from_image' is registered (description: ${(tool.description ?? "").slice(0, 60)}...)`);
      // Invoke the handler with a real image so the full pipeline runs.
      const handler = tool.handler;
      if (typeof handler !== "function") {
        fail("registered tool has no callable handler");
      } else {
        const handlerResult = await handler(
          { imageBase64: gradB64, mimeType: "image/png" },
          { signal: new AbortController().signal } as unknown,
        );
        if (typeof handlerResult === "object" && handlerResult !== null) {
          pass(`handler returned an object`);
        } else {
          fail(`handler did not return an object (got ${typeof handlerResult})`);
        }
        if (Array.isArray((handlerResult as { content?: unknown }).content)) {
          const content = (handlerResult as { content: Array<{ type: string; text: string }> }).content;
          if (content.length > 0 && content[0].type === "text" && content[0].text.length > 100) {
            pass(`handler content[0].text is populated (${content[0].text.length} chars)`);
            const parsed = JSON.parse(content[0].text) as ToolOutput;
            if (parsed.tokens && parsed.components && parsed.layout && parsed.preview && parsed.files) {
              pass(`handler text payload parses to a complete ToolOutput`);
            } else {
              fail(`handler text payload is missing one of tokens/components/layout/preview/files`);
            }
          } else {
            fail(`handler content[0] is not a populated text block`);
          }
        } else {
          fail(`handler result.content is not an array`);
        }
      }
    }
  }

  // ----- (e) Color-override contract -----
  process.stdout.write("\n[e] Color-override contract (palette → primary/secondary/accent):\n");
  if (bResult.ok) {
    // The first three palette colors must drive the primary/secondary/accent overrides.
    const expectedHexHead = bResult.palette.hex.slice(0, 3);
    const expectedTiers = expectedHexHead.map((h) => closestTailwind(h));
    const got = [
      bResult.tokens.colors.primary,
      bResult.tokens.colors.secondary,
      bResult.tokens.colors.accent,
    ];
    if (JSON.stringify(got) === JSON.stringify(expectedTiers)) {
      pass(`palette colors correctly overrode primary/secondary/accent: [${got.join(", ")}]`);
    } else {
      fail(`color override mismatch: expected [${expectedTiers.join(", ")}], got [${got.join(", ")}]`);
    }
    // "image" is a magic-vibe string, not a real preset — primary should
    // come from the override (or, if all 3 first-palette colors happen
    // to map to the same Tailwind tier as the first preset, the
    // closest-preset fallback). Either is acceptable per AC-10.
    const firstPreset = Object.values(presets)[0];
    process.stdout.write(`  NOTE: tokens.colors.primary=${bResult.tokens.colors.primary}, first-preset(${firstPreset.name}).primary=${firstPreset.tokens.colors.primary}\n`);
  } else {
    fail("gradient pipeline failed; cannot run (e)");
  }

  // ----- Done -----
  if (failed === 0) {
    process.stdout.write("\nall checks passed\n");
  } else {
    process.stderr.write(`\n${failed} check(s) failed\n`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`harness crashed: ${String(e)}\n`);
  process.exit(1);
});
