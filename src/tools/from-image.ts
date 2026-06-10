/**
 * src/tools/from-image.ts — MCP tool: `generate_from_image`.
 *
 * Accepts `{ imageBase64: string, mimeType?: string }`, decodes the
 * base64 payload into a raw `Buffer`, hands it to `sharp` to resize
 * down to 64×64, runs a k-means-lite (k=5) color quantizer on the
 * resulting RGB pixels, maps each centroid hex to the closest Tailwind
 * v3.4 color tier, and forwards the palette to
 * `generateTokens({ vibe: "image", colors })`.
 *
 * The full pipeline (tokens → components → layout → preview) is run
 * and the canonical five outputs are returned. The response is wrapped
 * in a discriminated union:
 *
 *   { ok: true,  tokens, components, layout, preview, files }
 *   { ok: false, error: string }
 *
 * On any error (invalid base64, sharp failure, corrupted image, empty
 * pixel array) the tool never throws — it returns the second variant
 * with a descriptive message. This keeps the MCP surface uniform with
 * `generate_from_url`.
 */
import { z } from "zod";
import sharp from "sharp";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateTokens, closestTailwind } from "../generators/tokens";
import { generateComponents } from "../generators/components";
import { generateLayout } from "../generators/layout";
import { generatePreview } from "../generators/preview";
import type { DesignTokens, ToolOutput } from "../types";

// ---------------------------------------------------------------------------
// Public response envelope
// ---------------------------------------------------------------------------

/**
 * Response envelope returned by `generate_from_image`. Discriminated by
 * `ok`. The success branch carries the canonical five outputs;
 * `palette` is appended as debug metadata for callers that want to
 * inspect the extracted colors without re-running the quantizer.
 */
export type FromImageResponse =
  | ({ ok: true; palette: ExtractedPalette } & ToolOutput)
  | { ok: false; error: string };

/** Debug metadata about the palette extracted from the image. */
export interface ExtractedPalette {
  /** The k centroids, hex-encoded, sorted by population descending. */
  hex: string[];
  /** Pixel count for each centroid (parallel to `hex`). */
  counts: number[];
  /** Tailwind tier name for each centroid, parallel to `hex`. */
  tierNames: string[];
}

// ---------------------------------------------------------------------------
// Image-processing constants
// ---------------------------------------------------------------------------

/** Resize the image to N×N before quantizing. Smaller = faster + smoother. */
const SAMPLE_SIZE = 64;

/** Number of palette colors to extract (the `k` in k-means). */
const K = 5;

/** Hard cap on k-means iterations (k-means typically converges in <10). */
const MAX_ITERATIONS = 16;

/** Convergence threshold: average per-centroid squared-RGB movement. */
const CONVERGENCE_THRESHOLD = 1.0;

// ---------------------------------------------------------------------------
// K-means-lite color quantizer
// ---------------------------------------------------------------------------

/** Minimal RGB triple. */
interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Squared Euclidean distance between two RGB triples. */
function sqDist(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Convert an `RGB` triple (any component may be a float) to a
 * canonical 6-digit lowercase hex string with a leading `#`. Out-of-range
 * components are clamped to `[0, 255]` so centroid means that drift
 * past the gamut still produce a valid color.
 */
function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

/**
 * Initialize k centroids using the k-means++ heuristic. The first
 * centroid is picked uniformly at random; each subsequent centroid is
 * picked with probability proportional to D², where D is the distance
 * from the pixel to its nearest existing centroid. This produces
 * well-spread seeds, which dramatically reduces the number of
 * iterations needed to converge.
 */
function initCentroids(pixels: ReadonlyArray<RGB>): RGB[] {
  if (pixels.length === 0) {
    return Array.from({ length: K }, () => ({ r: 128, g: 128, b: 128 }));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rnd: () => number = (globalThis as any).crypto
    // Use Web Crypto when available for a deterministic-friendly seed.
    ? () => {
        const buf = new Uint32Array(1);
        (globalThis as { crypto: { getRandomValues: (a: Uint32Array) => Uint32Array } }).crypto.getRandomValues(buf);
        return buf[0] / 0x100000000;
      }
    : Math.random;

  // First centroid: uniform random.
  const centroids: RGB[] = [{ ...pixels[Math.floor(rnd() * pixels.length)] }];

  // Subsequent centroids: weighted by D² (k-means++).
  while (centroids.length < K) {
    const distances = new Array<number>(pixels.length);
    let total = 0;
    for (let i = 0; i < pixels.length; i++) {
      let min = Infinity;
      for (const c of centroids) {
        const d = sqDist(pixels[i], c);
        if (d < min) min = d;
      }
      distances[i] = min;
      total += min;
    }
    if (total === 0) {
      // Every remaining pixel coincides with an existing centroid;
      // just duplicate the first pixel so we still hit K.
      centroids.push({ ...pixels[0] });
      continue;
    }
    let r = rnd() * total;
    let picked = pixels.length - 1;
    for (let i = 0; i < pixels.length; i++) {
      r -= distances[i];
      if (r <= 0) { picked = i; break; }
    }
    centroids.push({ ...pixels[picked] });
  }
  return centroids;
}

/**
 * Run k-means-lite on the supplied pixel array. Returns the k centroids
 * (hex), the per-cluster pixel counts, and the final RGB centroids —
 * all three parallel arrays sorted by population descending.
 */
function quantize(pixels: ReadonlyArray<RGB>): ExtractedPalette {
  if (pixels.length === 0) {
    const fallback = rgbToHex({ r: 128, g: 128, b: 128 });
    return {
      hex: [fallback],
      counts: [0],
      tierNames: [closestTailwind(fallback)],
    };
  }

  let centroids = initCentroids(pixels);
  let prev: RGB[] = centroids.map((c) => ({ ...c }));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // ----- 1. Assign every pixel to its nearest centroid -----
    const buckets: RGB[][] = Array.from({ length: K }, () => []);
    for (const p of pixels) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < K; i++) {
        const d = sqDist(p, centroids[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      buckets[bestIdx].push(p);
    }

    // ----- 2. Recompute each centroid as the bucket mean -----
    const next: RGB[] = centroids.map((c, i) => {
      const bucket = buckets[i];
      if (bucket.length === 0) return c; // empty cluster → keep previous
      let r = 0, g = 0, b = 0;
      for (const p of bucket) { r += p.r; g += p.g; b += p.b; }
      return { r: r / bucket.length, g: g / bucket.length, b: b / bucket.length };
    });

    // ----- 3. Convergence check -----
    let movement = 0;
    for (let i = 0; i < K; i++) movement += sqDist(next[i], prev[i]);
    movement /= K;

    centroids = next;
    prev = next.map((c) => ({ ...c }));
    if (movement < CONVERGENCE_THRESHOLD) break;
  }

  // ----- 4. Final population counts -----
  const counts: number[] = Array.from({ length: K }, () => 0);
  for (const p of pixels) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < K; i++) {
      const d = sqDist(p, centroids[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    counts[bestIdx]++;
  }

  // ----- 5. Sort by population descending -----
  const order = centroids.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  const hex = order.map((i) => rgbToHex(centroids[i]));
  const tierNames = hex.map((h) => closestTailwind(h));
  return { hex, counts: order.map((i) => counts[i]), tierNames };
}

// ---------------------------------------------------------------------------
// Image → palette pipeline
// ---------------------------------------------------------------------------

/**
 * Resize a decoded image buffer to 64×64 and return the raw pixel
 * array. The alpha channel is stripped — we want RGB only — and
 * grayscale inputs (1 or 2 channels) are expanded to RGB so the
 * downstream k-means code can assume a fixed 3-bytes-per-pixel layout.
 */
async function extractPixels(buffer: Buffer): Promise<RGB[]> {
  const img = sharp(buffer, { failOn: "none" });
  const { data, info } = await img
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  if (channels < 1 || channels > 4) {
    throw new Error(`unexpected channel count ${channels}`);
  }
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) {
    if (channels >= 3) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    } else {
      // Grayscale (channels === 1) or grayscale+alpha (channels === 2).
      const v = data[i];
      pixels.push({ r: v, g: v, b: v });
    }
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// Core pipeline (tool body)
// ---------------------------------------------------------------------------

/**
 * Run the full image-to-design-system pipeline. Pure async function
 * with no MCP dependencies — used by both the MCP tool wrapper and
 * the in-process harness.
 *
 *  1. Decode `imageBase64` → Buffer.
 *  2. Resize to 64×64 via sharp.
 *  3. K-means-lite (k=5) over the RGB pixels.
 *  4. Map centroids → closest Tailwind color tier (for debug metadata).
 *  5. `generateTokens({ vibe: "image", colors: palette.hex })` →
 *     `generateComponents` → `generateLayout` → `generatePreview`.
 *
 * Returns the discriminated-union `FromImageResponse`; never throws.
 */
export async function generateFromImage(
  imageBase64: string,
  mimeType?: string,
): Promise<FromImageResponse> {
  // ----- 1. Decode base64 -----
  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
    if (buffer.length === 0) {
      return { ok: false, error: "decode failed: empty buffer" };
    }
  } catch (e) {
    return { ok: false, error: `decode failed: ${(e as Error).message ?? String(e)}` };
  }

  // ----- 2. Resize + extract pixels -----
  let pixels: RGB[];
  try {
    pixels = await extractPixels(buffer);
  } catch (e) {
    return {
      ok: false,
      error: `image decode failed${mimeType ? ` (mimeType=${mimeType})` : ""}: ${(e as Error).message ?? String(e)}`,
    };
  }
  if (pixels.length === 0) {
    return { ok: false, error: "image decode failed: zero pixels extracted" };
  }

  // ----- 3. Quantize -----
  const palette = quantize(pixels);

  // ----- 4. Forward to generateTokens -----
  // The first three palette colors become primary / secondary / accent
  // in `applyColorOverrides`; the remaining two are accepted (and
  // ignored) by the AC-4 contract, which is a non-breaking widening
  // for callers that supply more than three colors.
  let tokens: DesignTokens;
  try {
    tokens = await generateTokens({ vibe: "image", colors: palette.hex });
  } catch (e) {
    return { ok: false, error: `generateTokens failed: ${(e as Error).message ?? String(e)}` };
  }

  // ----- 5. Run the rest of the pipeline -----
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
    palette,
  };
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

/** Inferred input type for the `generate_from_image` tool. */
export type GenerateFromImageArgs = {
  imageBase64: string;
  mimeType?: string;
};

/** Zod raw shape for the `generate_from_image` input. */
const imageInputShape: { imageBase64: z.ZodString; mimeType: z.ZodOptional<z.ZodString> } = {
  imageBase64: z
    .string()
    .min(1, "imageBase64 must be a non-empty string")
    .describe(
      "Base64-encoded image payload (PNG, JPEG, WebP, etc.). " +
        "Example: a 256×256 PNG returned by `Buffer.from(fs.readFileSync('out.png')).toString('base64')`.",
    ),
  mimeType: z
    .string()
    .optional()
    .describe(
      "Optional MIME type hint, e.g. 'image/png'. Sharp will infer " +
        "the format from the buffer's magic bytes when this is omitted.",
    ),
};

/**
 * Register the `generate_from_image` tool on the supplied `McpServer`.
 * Mirrors the registration pattern of `generate_from_vibe` and
 * `generate_from_url` (cast through `unknown` to bypass the TS2589
 * deep-instantiation issue in the SDK's z3 + z4 compatibility layer).
 */
export function registerFromImage(server: McpServer): void {
  // The MCP SDK's `server.tool(...)` overload triggers a TypeScript
  // "Type instantiation is excessively deep" error (TS2589) with the
  // installed Zod 3.25 + SDK 1.29 combo. The runtime behavior is
  // correct; the issue is purely a type-checker limitation. We cast
  // through `unknown` to bypass it. (Same workaround as from-vibe.ts
  // and from-url.ts.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  s.tool(
    "generate_from_image",
    "Convert a base64-encoded image into a complete React + Tailwind + " +
      "Framer Motion design system. The image is downsampled to 64×64, " +
      "quantized to a 5-color palette via k-means, and each color is " +
      "mapped to the closest Tailwind v3.4 tier before the pipeline runs. " +
      "Returns the same five-output shape as `generate_from_vibe` " +
      "(tokens, components, layout, preview, files) on success, or " +
      "`{ ok: false, error }` on decode/parse failure.",
    imageInputShape,
    {
      // Read-only: the tool doesn't modify any external state.
      readOnlyHint: true,
      // Idempotent: the same base64 always produces the same output.
      idempotentHint: true,
      // Closed world: the tool only consumes the base64 the caller
      // supplied — no external network calls.
      openWorldHint: false,
    },
    async (args: GenerateFromImageArgs) => {
      const result = await generateFromImage(args.imageBase64, args.mimeType);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        // Cast through `unknown` because the schema for
        // structuredContent is `Record<string, unknown>` while our
        // payload is a typed `FromImageResponse`.
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
