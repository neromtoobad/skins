/**
 * src/generators/tokens.ts — token resolution for skins-mcp.
 *
 * Exports `generateTokens(input)` which produces a `DesignTokens` bundle
 * from one of three input signals:
 *
 *   1. A free-form **vibe** string. Scored against every preset's
 *      `keywords`. The highest-scoring preset wins. Ties resolve in
 *      declaration order (first declared = winner).
 *   2. A list of **hex colors**. The first three override
 *      `colors.primary` / `colors.secondary` / `colors.accent` by snapping
 *      each hex to the closest Tailwind v3.4 palette entry (Euclidean
 *      distance in RGB).
 *   3. Optional **font hints**. Currently a soft input — see
 *      `applyFontHints` for the (no-op) policy. Real wiring lands when
 *      the LLM is involved.
 *
 * If no preset matches the vibe (best score is 0) and the LLM is
 * configured, the generator will call `src/llm.ts` to refine the tokens.
 * Any error from the LLM (unavailable, validation failure, etc.) is
 * caught and the closest-scoring preset is used as the fallback.
 */
import { z } from "zod";
import { listPresets, presets, PRESET_NAMES } from "../vibes/presets";
import type { DesignTokens, Preset } from "../types";
import { callLlm, LlmUnavailableError } from "../llm";

// ---------------------------------------------------------------------------
// Public input + output shapes
// ---------------------------------------------------------------------------

/** Input shape for `generateTokens`. All fields are optional. */
export interface GenerateTokensInput {
  /** Free-form vibe description, e.g. `"neon cyberpunk dashboard"`. */
  vibe?: string;
  /** Hex colors to override `primary` / `secondary` / `accent`. */
  colors?: string[];
  /** Google Font family hints (currently advisory only). */
  fontHints?: string[];
}

// ---------------------------------------------------------------------------
// Tailwind v3.4 color palette
// ---------------------------------------------------------------------------
//
// Every Tailwind v3.4 default color family and shade, plus black/white.
// The 22 family × 11 shade grid (242 entries) plus 2 neutrals gives
// 244 candidate names. Closest-match is computed by RGB Euclidean
// distance — fast (O(N)) and a good fit for the evenly-spaced Tailwind
// palette.

interface PaletteEntry {
  /** Tailwind name without the `bg-` prefix, e.g. `"indigo-500"`. */
  name: string;
  /** 0-255 red channel. */
  r: number;
  /** 0-255 green channel. */
  g: number;
  /** 0-255 blue channel. */
  b: number;
}

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

type Shade = (typeof SHADES)[number];

type Palette = Record<string, Record<Shade, [number, number, number]>>;

/**
 * Curated Tailwind v3.4 palette. Hex values are taken from
 * `tailwindcss/src/public/resolve-config.js` defaults. Compact
 * representation — one record per family, shades as `[r, g, b]` tuples.
 */
const PALETTE: Palette = {
  slate:    { 50: [248, 250, 252], 100: [241, 245, 249], 200: [226, 232, 240], 300: [203, 213, 225], 400: [148, 163, 184], 500: [100, 116, 139], 600: [ 71,  85, 105], 700: [ 51,  65,  85], 800: [ 30,  41,  59], 900: [ 15,  23,  42], 950: [  2,   6,  23] },
  gray:     { 50: [249, 250, 251], 100: [243, 244, 246], 200: [229, 231, 235], 300: [209, 213, 219], 400: [156, 163, 175], 500: [107, 114, 128], 600: [ 75,  85,  99], 700: [ 55,  65,  81], 800: [ 31,  41,  55], 900: [ 17,  24,  39], 950: [  3,   7,  18] },
  zinc:     { 50: [250, 250, 250], 100: [244, 244, 245], 200: [228, 228, 231], 300: [212, 212, 216], 400: [161, 161, 170], 500: [113, 113, 122], 600: [ 82,  82,  91], 700: [ 63,  63,  70], 800: [ 39,  39,  42], 900: [ 24,  24,  27], 950: [  9,   9,  11] },
  neutral:  { 50: [250, 250, 250], 100: [245, 245, 245], 200: [229, 229, 229], 300: [212, 212, 212], 400: [163, 163, 163], 500: [115, 115, 115], 600: [ 82,  82,  82], 700: [ 64,  64,  64], 800: [ 38,  38,  38], 900: [ 23,  23,  23], 950: [ 10,  10,  10] },
  stone:    { 50: [250, 250, 249], 100: [245, 245, 244], 200: [231, 229, 228], 300: [214, 211, 209], 400: [168, 162, 158], 500: [120, 113, 108], 600: [ 87,  83,  78], 700: [ 68,  64,  60], 800: [ 41,  37,  36], 900: [ 28,  25,  23], 950: [ 12,  10,   9] },
  red:      { 50: [254, 242, 242], 100: [254, 226, 226], 200: [254, 202, 202], 300: [252, 165, 165], 400: [248, 113, 113], 500: [239,  68,  68], 600: [220,  38,  38], 700: [185,  28,  28], 800: [153,  27,  27], 900: [127,  29,  29], 950: [ 69,  10,  10] },
  orange:   { 50: [255, 247, 237], 100: [255, 237, 213], 200: [254, 215, 170], 300: [253, 186, 116], 400: [251, 146,  60], 500: [249, 115,  22], 600: [234,  88,  12], 700: [194,  65,  12], 800: [154,  52,  18], 900: [124,  45,  18], 950: [ 67,  20,   7] },
  amber:    { 50: [255, 251, 235], 100: [254, 243, 199], 200: [253, 230, 138], 300: [252, 211,  77], 400: [251, 191,  36], 500: [245, 158,  11], 600: [217, 119,   6], 700: [180,  83,   9], 800: [146,  64,  14], 900: [120,  53,  15], 950: [ 69,  26,   3] },
  yellow:   { 50: [254, 252, 232], 100: [254, 249, 195], 200: [254, 240, 138], 300: [253, 224,  71], 400: [250, 204,  21], 500: [234, 179,   8], 600: [202, 138,   4], 700: [161,  98,   7], 800: [133,  77,  14], 900: [113,  63,  18], 950: [ 66,  32,   6] },
  lime:     { 50: [247, 254, 231], 100: [236, 252, 203], 200: [217, 249, 157], 300: [190, 242, 100], 400: [163, 230,  53], 500: [132, 204,  22], 600: [101, 163,  13], 700: [ 77, 124,  15], 800: [ 63,  98,  18], 900: [ 54,  83,  20], 950: [ 26,  46,   5] },
  green:    { 50: [240, 253, 244], 100: [220, 252, 231], 200: [187, 247, 208], 300: [134, 239, 172], 400: [ 74, 222, 128], 500: [ 34, 197,  94], 600: [ 22, 163,  74], 700: [ 21, 128,  61], 800: [ 22, 101,  52], 900: [ 20,  83,  45], 950: [  5,  46,  22] },
  emerald:  { 50: [236, 253, 245], 100: [209, 250, 229], 200: [167, 243, 208], 300: [110, 231, 183], 400: [ 52, 211, 153], 500: [ 16, 185, 129], 600: [  5, 150, 105], 700: [  4, 120,  87], 800: [  6,  95,  70], 900: [  6,  78,  59], 950: [  2,  44,  34] },
  teal:     { 50: [240, 253, 250], 100: [204, 251, 241], 200: [153, 246, 228], 300: [ 94, 234, 212], 400: [ 45, 212, 191], 500: [ 20, 184, 166], 600: [ 13, 148, 136], 700: [ 15, 118, 110], 800: [ 17,  94,  89], 900: [ 19,  78,  74], 950: [  4,  47,  46] },
  cyan:     { 50: [236, 254, 255], 100: [207, 250, 254], 200: [165, 243, 252], 300: [103, 232, 249], 400: [ 34, 211, 238], 500: [  6, 182, 212], 600: [  8, 145, 178], 700: [ 14, 116, 144], 800: [ 21,  94, 117], 900: [ 22,  78,  99], 950: [  8,  51,  68] },
  sky:      { 50: [240, 249, 255], 100: [224, 242, 254], 200: [186, 230, 253], 300: [125, 211, 252], 400: [ 56, 189, 248], 500: [ 14, 165, 233], 600: [  2, 132, 199], 700: [  3, 105, 161], 800: [  7,  89, 133], 900: [ 12,  74, 110], 950: [  8,  47,  73] },
  blue:     { 50: [239, 246, 255], 100: [219, 234, 254], 200: [191, 219, 254], 300: [147, 197, 253], 400: [ 96, 165, 250], 500: [ 59, 130, 246], 600: [ 37,  99, 235], 700: [ 29,  78, 216], 800: [ 30,  64, 175], 900: [ 30,  58, 138], 950: [ 23,  37,  84] },
  indigo:   { 50: [238, 242, 255], 100: [224, 231, 255], 200: [199, 210, 254], 300: [165, 180, 252], 400: [129, 140, 248], 500: [ 99, 102, 241], 600: [ 79,  70, 229], 700: [ 67,  56, 202], 800: [ 55,  48, 163], 900: [ 49,  46, 129], 950: [ 30,  27,  75] },
  violet:   { 50: [245, 243, 255], 100: [237, 233, 254], 200: [221, 214, 254], 300: [196, 181, 253], 400: [167, 139, 250], 500: [139,  92, 246], 600: [124,  58, 237], 700: [109,  40, 217], 800: [ 91,  33, 182], 900: [ 76,  29, 149], 950: [ 46,  16, 101] },
  purple:   { 50: [250, 245, 255], 100: [243, 232, 255], 200: [233, 213, 255], 300: [216, 180, 254], 400: [192, 132, 252], 500: [168,  85, 247], 600: [147,  51, 234], 700: [126,  34, 206], 800: [107,  33, 168], 900: [ 88,  28, 135], 950: [ 59,   7, 100] },
  fuchsia:  { 50: [253, 244, 255], 100: [250, 232, 255], 200: [245, 208, 254], 300: [240, 171, 252], 400: [232, 121, 249], 500: [217,  70, 239], 600: [192,  38, 211], 700: [162,  28, 175], 800: [134,  25, 143], 900: [112,  26, 117], 950: [ 74,   4,  78] },
  pink:     { 50: [253, 242, 248], 100: [252, 231, 243], 200: [251, 207, 232], 300: [249, 168, 212], 400: [244, 114, 182], 500: [236,  72, 153], 600: [219,  39, 119], 700: [190,  24,  93], 800: [157,  23,  77], 900: [131,  24,  67], 950: [ 80,   7,  36] },
  rose:     { 50: [255, 241, 242], 100: [255, 228, 230], 200: [254, 205, 211], 300: [253, 164, 175], 400: [251, 113, 133], 500: [244,  63,  94], 600: [225,  29,  72], 700: [190,  18,  60], 800: [159,  18,  57], 900: [136,  19,  55], 950: [ 76,   5,  25] },
};

/** Pre-flattened list of every Tailwind palette entry (built once at module load). */
const PALETTE_FLAT: ReadonlyArray<PaletteEntry> = (() => {
  const out: PaletteEntry[] = [];
  for (const [family, shades] of Object.entries(PALETTE)) {
    for (const [shade, rgb] of Object.entries(shades) as Array<[string, [number, number, number]]>) {
      out.push({ name: `${family}-${shade}`, r: rgb[0], g: rgb[1], b: rgb[2] });
    }
  }
  // Plus black and white for completeness.
  out.push({ name: "black", r: 0, g: 0, b: 0 });
  out.push({ name: "white", r: 255, g: 255, b: 255 });
  return out;
})();

// ---------------------------------------------------------------------------
// Hex → Tailwind mapping
// ---------------------------------------------------------------------------

/** Parse `#rrggbb` / `#rgb` / `rrggbb` into a `[r, g, b]` tuple. */
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function sqDist(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Snap an arbitrary hex color to the closest Tailwind v3.4 palette entry
 * (Euclidean distance in RGB). Returns `"black"` / `"white"` when the
 * hex is essentially monochrome.
 */
export function closestTailwind(hex: string): string {
  const target = hexToRgb(hex);
  if (!target) {
    // Couldn't parse — fall back to neutral-500 so the caller still gets
    // a valid Tailwind class.
    return "neutral-500";
  }
  let best = PALETTE_FLAT[0];
  let bestDist = Infinity;
  for (const entry of PALETTE_FLAT) {
    const d = sqDist(target, [entry.r, entry.g, entry.b]);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best.name;
}

// ---------------------------------------------------------------------------
// Vibe scoring
// ---------------------------------------------------------------------------

/**
 * Lowercase a vibe and count how many of a preset's `keywords` appear in it
 * as substrings. Word-boundary-aware: the keyword "art" should NOT match
 * "smart", so we require the keyword to be flanked by non-letters (or by
 * the start/end of the string).
 */
function scoreVibe(vibe: string, preset: Preset): number {
  const lower = vibe.toLowerCase();
  let score = 0;
  for (const kw of preset.keywords) {
    const k = kw.toLowerCase();
    if (k.length === 0) continue;
    let from = 0;
    while (from <= lower.length - k.length) {
      const idx = lower.indexOf(k, from);
      if (idx === -1) break;
      const before = idx === 0 ? "" : lower.charAt(idx - 1);
      const after = idx + k.length === lower.length
        ? ""
        : lower.charAt(idx + k.length);
      const leftOk = before === "" || !/[a-z0-9]/.test(before);
      const rightOk = after === "" || !/[a-z0-9]/.test(after);
      if (leftOk && rightOk) {
        score += 1;
        break; // count each keyword at most once
      }
      from = idx + 1;
    }
  }
  return score;
}

/**
 * Pick the preset with the highest keyword score against `vibe`. When two
 * presets tie, the first-declared wins (insertion order in `presets`).
 * If `vibe` is empty, the first preset (cyberpunk) is returned with
 * score 0 — callers can interpret that as "no match, use the default".
 */
export function pickClosestPreset(
  vibe: string,
): { preset: Preset; score: number } {
  if (!vibe || vibe.trim().length === 0) {
    const fallback = presets[PRESET_NAMES[0]];
    return { preset: fallback, score: 0 };
  }
  const all = listPresets();
  let best: Preset = all[0];
  let bestScore = -1;
  for (const p of all) {
    const s = scoreVibe(vibe, p);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return { preset: best, score: Math.max(0, bestScore) };
}

// ---------------------------------------------------------------------------
// Color / font override application
// ---------------------------------------------------------------------------

/**
 * Apply the first three entries of `hexColors` to the preset tokens:
 *   colors[0] → colors.primary
 *   colors[1] → colors.secondary
 *   colors[2] → colors.accent
 * Extra colors are ignored. Unparseable colors are dropped (the preset's
 * original value is preserved).
 */
export function applyColorOverrides(
  tokens: DesignTokens,
  hexColors: string[],
): DesignTokens {
  if (!Array.isArray(hexColors) || hexColors.length === 0) return tokens;
  const [primary, secondary, accent] = hexColors;
  const next: DesignTokens = {
    ...tokens,
    colors: {
      ...tokens.colors,
      ...(primary ? { primary: closestTailwind(primary) } : {}),
      ...(secondary ? { secondary: closestTailwind(secondary) } : {}),
      ...(accent ? { accent: closestTailwind(accent) } : {}),
    },
  };
  return next;
}

/**
 * Apply Google Font family hints. Currently a no-op: the AC-4 spec only
 * requires `colors` overrides. The hook exists so AC-12 (LLM path) and
 * AC-8 (vibe tool) can later wire `fontHints` into the prompt without
 * changing the call site.
 */
function applyFontHints(
  tokens: DesignTokens,
  _fontHints: string[] | undefined,
): DesignTokens {
  return tokens;
}

// ---------------------------------------------------------------------------
// Zod schema for LLM response validation
// ---------------------------------------------------------------------------

const ColorTokensSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  surface: z.string(),
  foreground: z.string(),
  muted: z.string(),
  border: z.string(),
  success: z.string(),
  warning: z.string(),
  danger: z.string(),
});

const FontFamilySchema = z.object({
  display: z.string(),
  body: z.string(),
  mono: z.string(),
});

const FontSizeSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  base: z.string(),
  lg: z.string(),
  xl: z.string(),
  "2xl": z.string(),
  "3xl": z.string(),
  "4xl": z.string(),
});

const FontWeightSchema = z.object({
  normal: z.string(),
  medium: z.string(),
  semibold: z.string(),
  bold: z.string(),
});

const TypographyTokensSchema = z.object({
  fontFamily: FontFamilySchema,
  fontSize: FontSizeSchema,
  fontWeight: FontWeightSchema,
});

const SpacingTokensSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  "2xl": z.string(),
  "3xl": z.string(),
});

const MotionTokensSchema = z.object({
  durationBase: z.number(),
  durationFast: z.number(),
  durationSlow: z.number(),
  easeOut: z.string(),
  easeIn: z.string(),
  easeInOut: z.string(),
  staggerChildren: z.number(),
});

const ShadowTokensSchema = z.object({
  none: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  glow: z.string(),
});

const RadiusTokensSchema = z.object({
  none: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  full: z.string(),
});

/** Zod schema that matches the `DesignTokens` TypeScript type 1:1. */
export const DesignTokensSchema = z.object({
  colors: ColorTokensSchema,
  typography: TypographyTokensSchema,
  spacing: SpacingTokensSchema,
  motion: MotionTokensSchema,
  shadows: ShadowTokensSchema,
  radius: RadiusTokensSchema,
});

// ---------------------------------------------------------------------------
// LLM refinement (best-effort)
// ---------------------------------------------------------------------------

function buildLlmPrompt(vibe: string, fontHints?: string[]): string {
  const lines = [
    `Generate a complete Tailwind v3.4 design system for a UI described as:`,
    `"${vibe}".`,
    ``,
    `Return JSON with shape:`,
    JSON.stringify(
      {
        colors: { primary: "indigo-500", /* ... 10 more */ },
        typography: { fontFamily: { display: "...", body: "...", mono: "..." } },
        // ...
      },
      null,
      2,
    ),
    ``,
    `Rules:`,
    `- Every color must be a Tailwind v3.4 family-shade name (e.g. "indigo-500", "slate-950") or "black" / "white".`,
    `- Every font family must be a real Google Font family.`,
    `- Motion durations are in seconds.`,
  ];
  if (fontHints && fontHints.length > 0) {
    lines.push(`- Preferred font families: ${fontHints.join(", ")}.`);
  }
  return lines.join("\n");
}

/**
 * Attempt to refine the closest-scoring preset's tokens via the LLM.
 * Any error (`LlmUnavailableError`, network failure, Zod validation
 * failure, etc.) is caught and the original preset tokens are returned.
 */
async function tryLlmRefine(
  vibe: string,
  fallback: DesignTokens,
  fontHints?: string[],
): Promise<DesignTokens> {
  try {
    const prompt = buildLlmPrompt(vibe, fontHints);
    const raw = await callLlm(prompt, DesignTokensSchema);
    return DesignTokensSchema.parse(raw) as DesignTokens;
  } catch (err) {
    // Log to stderr so debug sessions are easier; never throw.
    process.stderr.write(
      `[generateTokens] LLM refine failed, using preset fallback (${(err as Error).message ?? String(err)})\n`,
    );
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a `DesignTokens` bundle from the given input signals. The
 * function is async because the LLM fallback path (AC-12) is async.
 *
 * Algorithm:
 *   1. If a vibe is provided, score every preset and pick the closest.
 *   2. Start from the chosen preset's tokens.
 *   3. If the best score is 0 (no preset matched), and the LLM is
 *      configured (i.e. `OPENAI_API_KEY` is set OR the LLM is callable),
 *      try the LLM refinement. Any failure → fall back to the preset.
 *   4. Apply color overrides (first three hex colors map to
 *      primary / secondary / accent).
 *   5. Apply font hints (currently a no-op).
 */
export async function generateTokens(
  input: GenerateTokensInput,
): Promise<DesignTokens> {
  const vibe = (input.vibe ?? "").trim();
  const { preset, score } = pickClosestPreset(vibe);

  let tokens: DesignTokens = preset.tokens;

  // No preset matched and an LLM is available → try the LLM refinement.
  if (vibe.length > 0 && score === 0 && isLlmConfigured()) {
    tokens = await tryLlmRefine(vibe, tokens, input.fontHints);
  }

  // Apply color overrides last so they win over both the preset and the
  // (possibly LLM-supplied) tokens.
  tokens = applyColorOverrides(tokens, input.colors ?? []);
  tokens = applyFontHints(tokens, input.fontHints);

  return tokens;
}

/**
 * Synchronous variant. Skips the LLM refinement step (the LLM is async
 * by nature) and returns the closest-preset tokens directly. This is the
 * function AC-8/AC-9/AC-10 should call from their `server.tool` handlers
 * when they need a non-Promise return path, e.g. for caching layers.
 */
export function generateTokensSync(input: GenerateTokensInput): DesignTokens {
  const vibe = (input.vibe ?? "").trim();
  const { preset, score } = pickClosestPreset(vibe);
  let tokens = preset.tokens;
  if (vibe.length > 0 && score === 0) {
    // LLM refinement is async; the sync caller accepts the closest preset.
    process.stderr.write(
      `[generateTokensSync] no preset matched for "${vibe}"; using ${preset.name} (sync path skips LLM)\n`,
    );
  }
  tokens = applyColorOverrides(tokens, input.colors ?? []);
  tokens = applyFontHints(tokens, input.fontHints);
  return tokens;
}

/**
 * True when an LLM is configured in the environment. The AC-4 spec
 * says "if an LLM is configured" — the cleanest definition is the
 * presence of `OPENAI_API_KEY`. (`OPENAI_BASE_URL` and `OPENAI_MODEL`
 * are read inside `callLlm` itself.)
 */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0);
}

/**
 * Convenience re-export so callers (and tests) can see the same error
 * class the LLM client throws. Avoids forcing every consumer to import
 * from `src/llm.ts` directly.
 */
export { LlmUnavailableError };
