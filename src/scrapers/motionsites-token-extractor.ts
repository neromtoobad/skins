/**
 * src/scrapers/motionsites-token-extractor.ts
 *
 * Extracts Partial<DesignTokens> from a MotionsitesPrompt.
 *
 * - Hex colors are mapped to the closest Tailwind tier via RGB Euclidean distance
 * - HSL values are converted to hex first, then mapped
 * - Font families are preserved as-is (Google Font names)
 * - Animation keywords are mapped to a MotionStyle profile
 * - Layout density maps to motion duration adjustments
 */
import type { DesignTokens, MotionStyle } from "../types";
import type { MotionsitesPrompt } from "./motionsites-data";

// ---------------------------------------------------------------------------
// HSL → hex conversion
// ---------------------------------------------------------------------------

function hslToHex(hslString: string): string | null {
  // Accepts "262 83% 58%" or "262, 83%, 58%"
  const cleaned = hslString.replace(/%/g, "").replace(/,/g, " ");
  const parts = cleaned.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  if (isNaN(h) || isNaN(s) || isNaN(l)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; b = 0; }
  else if (h < 120){ r = x; g = c; b = 0; }
  else if (h < 180){ r = 0; g = c; b = x; }
  else if (h < 240){ r = 0; g = x; b = c; }
  else if (h < 300){ r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---------------------------------------------------------------------------
// Tailwind palette mapping (minimal — reuses logic from tokens.ts)
// ---------------------------------------------------------------------------

const TAILWIND_COLORS: Array<{ name: string; r: number; g: number; b: number }> = [
  // Slates
  { name: "slate-950", r: 2, g: 6, b: 23 },
  { name: "slate-900", r: 15, g: 23, b: 42 },
  { name: "slate-800", r: 30, g: 41, b: 59 },
  { name: "slate-700", r: 51, g: 65, b: 85 },
  { name: "slate-500", r: 100, g: 116, b: 139 },
  { name: "slate-400", r: 148, g: 163, b: 184 },
  { name: "slate-200", r: 226, g: 232, b: 240 },
  { name: "slate-50", r: 248, g: 250, b: 252 },
  // Zinc / neutral darks
  { name: "zinc-950", r: 9, g: 9, b: 11 },
  { name: "zinc-900", r: 24, g: 24, b: 27 },
  { name: "zinc-800", r: 39, g: 39, b: 42 },
  { name: "neutral-900", r: 23, g: 23, b: 23 },
  { name: "neutral-950", r: 10, g: 10, b: 10 },
  // Indigo
  { name: "indigo-950", r: 30, g: 27, b: 75 },
  { name: "indigo-900", r: 49, g: 46, b: 129 },
  { name: "indigo-700", r: 67, g: 56, b: 202 },
  { name: "indigo-600", r: 79, g: 70, b: 229 },
  { name: "indigo-500", r: 99, g: 102, b: 241 },
  { name: "indigo-400", r: 129, g: 140, b: 248 },
  { name: "indigo-300", r: 165, g: 180, b: 252 },
  // Violet / purple
  { name: "violet-950", r: 46, g: 16, b: 101 },
  { name: "violet-900", r: 76, g: 29, b: 149 },
  { name: "violet-700", r: 109, g: 40, b: 217 },
  { name: "violet-600", r: 124, g: 58, b: 237 },
  { name: "violet-500", r: 139, g: 92, b: 246 },
  { name: "purple-900", r: 88, g: 28, b: 135 },
  { name: "purple-700", r: 126, g: 34, b: 206 },
  { name: "purple-500", r: 168, g: 85, b: 247 },
  { name: "purple-400", r: 192, g: 132, b: 252 },
  // Fuchsia / pink
  { name: "fuchsia-500", r: 217, g: 70, b: 239 },
  { name: "pink-500", r: 236, g: 72, b: 153 },
  { name: "pink-400", r: 244, g: 114, b: 182 },
  { name: "pink-300", r: 249, g: 168, b: 212 },
  // Blue
  { name: "blue-950", r: 23, g: 37, b: 84 },
  { name: "blue-900", r: 30, g: 58, b: 138 },
  { name: "blue-700", r: 29, g: 78, b: 216 },
  { name: "blue-600", r: 37, g: 99, b: 235 },
  { name: "blue-500", r: 59, g: 130, b: 246 },
  { name: "blue-400", r: 96, g: 165, b: 250 },
  // Sky / cyan
  { name: "sky-500", r: 14, g: 165, b: 233 },
  { name: "sky-400", r: 56, g: 189, b: 248 },
  { name: "cyan-400", r: 34, g: 211, b: 238 },
  { name: "cyan-300", r: 103, g: 232, b: 249 },
  // Green / emerald
  { name: "green-900", r: 20, g: 83, b: 45 },
  { name: "green-700", r: 21, g: 128, b: 61 },
  { name: "green-600", r: 22, g: 163, b: 74 },
  { name: "green-500", r: 34, g: 197, b: 94 },
  { name: "emerald-600", r: 5, g: 150, b: 105 },
  { name: "emerald-500", r: 16, g: 185, b: 129 },
  { name: "emerald-400", r: 52, g: 211, b: 153 },
  // Amber / yellow / orange
  { name: "amber-600", r: 217, g: 119, b: 6 },
  { name: "amber-500", r: 245, g: 158, b: 11 },
  { name: "amber-400", r: 251, g: 191, b: 36 },
  { name: "yellow-500", r: 234, g: 179, b: 8 },
  { name: "yellow-400", r: 250, g: 204, b: 21 },
  { name: "orange-600", r: 234, g: 88, b: 12 },
  { name: "orange-500", r: 249, g: 115, b: 22 },
  { name: "orange-400", r: 251, g: 146, b: 60 },
  // Red
  { name: "red-600", r: 220, g: 38, b: 38 },
  { name: "red-500", r: 239, g: 68, b: 68 },
  { name: "rose-500", r: 244, g: 63, b: 94 },
  // White / Black
  { name: "white", r: 255, g: 255, b: 255 },
  { name: "black", r: 0, g: 0, b: 0 },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function closestTailwindColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "slate-900";

  let best = TAILWIND_COLORS[0].name;
  let bestDist = Infinity;

  for (const entry of TAILWIND_COLORS) {
    const dr = entry.r - rgb[0];
    const dg = entry.g - rgb[1];
    const db = entry.b - rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry.name;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Motion style detection
// ---------------------------------------------------------------------------

const SNAPPY_KEYWORDS = ["neon", "glow", "scan", "pulse", "flicker", "type", "counter", "matrix", "stagger", "blur"];
const SLOW_KEYWORDS = ["float", "parallax", "orbit", "bloom", "morph", "scroll", "drift", "breathe", "twinkle"];

function detectMotionStyle(keywords: string[]): MotionStyle {
  const kw = keywords.map(k => k.toLowerCase());
  const snappyScore = kw.filter(k => SNAPPY_KEYWORDS.includes(k)).length;
  const slowScore = kw.filter(k => SLOW_KEYWORDS.includes(k)).length;

  if (snappyScore > slowScore) return "snappy";
  if (slowScore > snappyScore) return "slow";
  return "smooth";
}

// ---------------------------------------------------------------------------
// Motion token values per style
// ---------------------------------------------------------------------------

function motionTokensForStyle(style: MotionStyle): DesignTokens["motion"] {
  switch (style) {
    case "snappy":
      return {
        durationBase: 0.3,
        durationFast: 0.15,
        durationSlow: 0.6,
        easeOut: "easeOut",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.05,
      };
    case "slow":
      return {
        durationBase: 0.8,
        durationFast: 0.4,
        durationSlow: 1.2,
        easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.1,
      };
    case "smooth":
    default:
      return {
        durationBase: 0.5,
        durationFast: 0.25,
        durationSlow: 0.9,
        easeOut: "easeOut",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.08,
      };
  }
}

// ---------------------------------------------------------------------------
// Font to slot mapping
// ---------------------------------------------------------------------------

const MONO_FONTS = ["JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono", "Cascadia Code"];
const SERIF_FONTS = [
  "Playfair Display", "Cormorant Garamond", "Fraunces", "DM Serif Display",
  "Lora", "Merriweather", "EB Garamond",
];

function assignFontSlots(fonts: string[]): { display: string; body: string; mono: string } {
  let display = "Inter";
  let body = "Inter";
  const mono = "JetBrains Mono";

  for (const font of fonts) {
    if (MONO_FONTS.includes(font)) continue; // skip — goes in mono slot
    if (SERIF_FONTS.includes(font)) {
      display = font;
    } else {
      // Sans-serif display candidates
      const displayCandidates = ["Orbitron", "Archivo Black", "Bebas Neue", "Syne", "Barlow Condensed", "Barlow", "Space Grotesk", "Outfit", "Manrope"];
      if (displayCandidates.includes(font)) {
        display = font;
      } else {
        body = font;
      }
    }
  }

  // If we only have one font it serves both slots
  if (fonts.length === 1 && !MONO_FONTS.includes(fonts[0])) {
    display = fonts[0];
    body = fonts[0];
  }

  return { display, body, mono };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract design token overrides from a motionsites prompt.
 * Returns a Partial<DesignTokens> that callers merge over a base preset.
 */
export function extractTokensFromPrompt(prompt: MotionsitesPrompt): Partial<DesignTokens> {
  // Collect all hex colors (from hex + converted HSL)
  const hexColors: string[] = [...prompt.colors];

  for (const hsl of prompt.hslColors) {
    const hex = hslToHex(hsl);
    if (hex) hexColors.push(hex);
  }

  // Map hex colors to Tailwind tiers
  const tailwindColors = hexColors.map(closestTailwindColor);

  // Determine background: darkest color (lowest luminance)
  // Simple heuristic: find a color that maps to a 900/950 tier
  const bgColor = tailwindColors.find(c => c.includes("950") || c.includes("900")) ?? tailwindColors[0];

  // Primary: first non-dark, non-black color
  const primaryCandidates = tailwindColors.filter(c =>
    !c.includes("950") && !c.includes("900") && !c.includes("800") &&
    c !== "black" && c !== "white"
  );
  const primary = primaryCandidates[0] ?? tailwindColors[1] ?? "indigo-500";
  const secondary = primaryCandidates[1] ?? primary;
  const accent = primaryCandidates[2] ?? secondary;

  // Foreground: if bg is dark, use white/light; if light, use dark
  const isDarkBg = bgColor?.includes("950") || bgColor?.includes("900") ||
    bgColor?.includes("800") || bgColor === "black" || bgColor === "zinc-950";
  const foreground = isDarkBg ? "slate-50" : "slate-900";
  const muted = isDarkBg ? "slate-400" : "slate-500";
  const border = isDarkBg ? "slate-700" : "slate-200";
  const surface = isDarkBg ? "slate-900" : "white";

  // Motion
  const motionStyle = detectMotionStyle(prompt.animationKeywords);
  const motion = motionTokensForStyle(motionStyle);

  // Typography
  const fontSlots = assignFontSlots(prompt.fonts);

  // Shadows: glow for dark neon designs, standard for others
  const hasGlow = prompt.animationKeywords.some(k => ["glow", "neon", "pulse"].includes(k));
  const glowColor = primary.split("-")[0];
  const shadows: DesignTokens["shadows"] = {
    none: "shadow-none",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl",
    glow: hasGlow ? `shadow-lg shadow-${glowColor}-500/30` : "shadow-xl",
  };

  return {
    colors: {
      primary,
      secondary,
      accent,
      background: bgColor ?? "slate-950",
      surface,
      foreground,
      muted,
      border,
      success: "emerald-500",
      warning: "amber-500",
      danger: "rose-500",
    },
    typography: {
      fontFamily: fontSlots,
      fontSize: {
        xs: "text-xs",
        sm: "text-sm",
        base: "text-base",
        lg: "text-lg",
        xl: "text-xl",
        "2xl": "text-2xl",
        "3xl": "text-3xl",
        "4xl": "text-4xl",
      },
      fontWeight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
      },
    },
    motion,
    shadows,
  };
}
