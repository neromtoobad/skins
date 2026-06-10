/**
 * src/vibes/presets.ts — built-in design presets.
 *
 * Each preset is a self-describing bundle of `keywords` (used by
 * `generateTokens` in AC-4 to score incoming vibes), a full `DesignTokens`
 * bundle, and a `motionStyle` discriminator. Every preset uses real
 * Tailwind color names (`slate-900`, `emerald-400`, etc.) and a real
 * Google Font family.
 *
 * The eight presets required by AC-3 are exported: `cyberpunk`,
 * `brutalist`, `luxury`, `pastel`, `monochrome`, `retro`, `organic`, and
 * `glassmorphism`. A ninth, `terminal`, is provided for the AC-13 demo
 * vibe that mixes cyberpunk + terminal keywords — `generateTokens` will
 * pick whichever preset scores highest.
 */
import type { DesignTokens, MotionStyle, Preset } from "../types";

// ---------------------------------------------------------------------------
// Shared typography + spacing + shadow + radius defaults
// ---------------------------------------------------------------------------
//
// We expose these as plain object factories so each preset can extend them
// without a `Pick`/`Omit` dance and without losing the Tailwind class
// fragments the generators consume.

/** Standard Tailwind text-size scale; the same in every preset. */
const FONT_SIZE: DesignTokens["typography"]["fontSize"] = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
};

/** Standard Tailwind weight scale. */
const FONT_WEIGHT: DesignTokens["typography"]["fontWeight"] = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

/** Standard spacing scale. */
const SPACING: DesignTokens["spacing"] = {
  xs: "p-1",
  sm: "p-2",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
  "2xl": "p-12",
  "3xl": "p-16",
};

/** Standard shadow scale. */
const SHADOWS: DesignTokens["shadows"] = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  glow: "shadow-[0_0_24px_rgba(168,85,247,0.45)]",
};

/** Standard radius scale. */
const RADIUS: DesignTokens["radius"] = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

/**
 * Build a `MotionTokens` object for the given pacing style. Keeps every
 * preset's motion vocabulary in one place and consistent.
 */
function motionFor(style: MotionStyle): DesignTokens["motion"] {
  switch (style) {
    case "snappy":
      return {
        durationBase: 0.18,
        durationFast: 0.1,
        durationSlow: 0.3,
        easeOut: "easeOut",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.05,
      };
    case "smooth":
      return {
        durationBase: 0.32,
        durationFast: 0.2,
        durationSlow: 0.55,
        easeOut: "easeOut",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.1,
      };
    case "slow":
      return {
        durationBase: 0.55,
        durationFast: 0.35,
        durationSlow: 0.9,
        easeOut: "easeOut",
        easeIn: "easeIn",
        easeInOut: "easeInOut",
        staggerChildren: 0.15,
      };
  }
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

/** Neon glow on near-black; mono and futuristic. */
const cyberpunk: Preset = {
  name: "cyberpunk",
  keywords: [
    "cyberpunk",
    "neon",
    "terminal",
    "magenta",
    "pink",
    "cyan",
    "glow",
    "matrix",
    "synthwave",
    "vaporwave",
    "futuristic",
    "dystopian",
    "night-city",
    "hacker",
  ],
  tokens: {
    colors: {
      primary: "fuchsia-500",
      secondary: "cyan-400",
      accent: "yellow-300",
      background: "slate-950",
      surface: "slate-900",
      foreground: "slate-50",
      muted: "slate-400",
      border: "fuchsia-500",
      success: "emerald-400",
      warning: "amber-400",
      danger: "rose-500",
    },
    typography: {
      fontFamily: {
        display: "Orbitron",
        body: "JetBrains Mono",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("snappy"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "snappy",
};

/** Stark black/white, hard borders, industrial. */
const brutalist: Preset = {
  name: "brutalist",
  keywords: [
    "brutalist",
    "brutal",
    "raw",
    "stark",
    "monospace",
    "block",
    "industrial",
    "frank",
    "ugly",
    "harsh",
    "unfinished",
    "high-contrast",
    "swiss",
    "grot",
  ],
  tokens: {
    colors: {
      primary: "neutral-900",
      secondary: "neutral-700",
      accent: "yellow-300",
      background: "stone-100",
      surface: "white",
      foreground: "neutral-900",
      muted: "neutral-600",
      border: "neutral-900",
      success: "green-600",
      warning: "orange-500",
      danger: "red-600",
    },
    typography: {
      fontFamily: {
        display: "Archivo Black",
        body: "Space Mono",
        mono: "Space Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("snappy"),
    shadows: SHADOWS,
    radius: {
      none: "rounded-none",
      sm: "rounded-none",
      md: "rounded-none",
      lg: "rounded-none",
      xl: "rounded-none",
      full: "rounded-none",
    },
  },
  motionStyle: "snappy",
};

/** Jewel tones, serifs, slow elegant motion. */
const luxury: Preset = {
  name: "luxury",
  keywords: [
    "luxury",
    "luxurious",
    "elegant",
    "premium",
    "high-end",
    "jewel",
    "serif",
    "rich",
    "opulent",
    "sophisticated",
    "champagne",
    "velvet",
    "haute",
    "couture",
    "gilded",
  ],
  tokens: {
    colors: {
      primary: "amber-600",
      secondary: "emerald-900",
      accent: "rose-700",
      background: "stone-950",
      surface: "stone-900",
      foreground: "amber-50",
      muted: "stone-500",
      border: "amber-700",
      success: "emerald-500",
      warning: "amber-500",
      danger: "rose-600",
    },
    typography: {
      fontFamily: {
        display: "Playfair Display",
        body: "Cormorant Garamond",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("slow"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "slow",
};

/** Soft candy palette, rounded, friendly. */
const pastel: Preset = {
  name: "pastel",
  keywords: [
    "pastel",
    "soft",
    "cute",
    "gentle",
    "kawaii",
    "light",
    "candy",
    "rose",
    "mint",
    "powder",
    "peach",
    "lavender",
    "baby",
    "marshmallow",
  ],
  tokens: {
    colors: {
      primary: "pink-300",
      secondary: "sky-300",
      accent: "lime-300",
      background: "rose-50",
      surface: "white",
      foreground: "slate-800",
      muted: "slate-400",
      border: "pink-200",
      success: "emerald-300",
      warning: "amber-300",
      danger: "rose-400",
    },
    typography: {
      fontFamily: {
        display: "Quicksand",
        body: "Nunito",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("smooth"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "smooth",
};

/** Grayscale, ultra-clean, no color. */
const monochrome: Preset = {
  name: "monochrome",
  keywords: [
    "monochrome",
    "grayscale",
    "black-and-white",
    "minimal",
    "bw",
    "monochromatic",
    "neutral",
    "achromatic",
    "desaturated",
    "tin",
    "graphite",
    "noir",
  ],
  tokens: {
    colors: {
      primary: "neutral-900",
      secondary: "neutral-700",
      accent: "neutral-400",
      background: "neutral-50",
      surface: "white",
      foreground: "neutral-900",
      muted: "neutral-500",
      border: "neutral-300",
      success: "neutral-700",
      warning: "neutral-500",
      danger: "neutral-900",
    },
    typography: {
      fontFamily: {
        display: "Inter",
        body: "Inter",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("smooth"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "smooth",
};

/** Warm vintage palette, 70s/80s type. */
const retro: Preset = {
  name: "retro",
  keywords: [
    "retro",
    "vintage",
    "70s",
    "80s",
    "classic",
    "sepia",
    "analog",
    "warm",
    "old-school",
    "throwback",
    "mid-century",
    "groovy",
    "diner",
    "faded",
  ],
  tokens: {
    colors: {
      primary: "orange-600",
      secondary: "teal-600",
      accent: "yellow-400",
      background: "amber-50",
      surface: "amber-100",
      foreground: "amber-950",
      muted: "amber-700",
      border: "orange-300",
      success: "green-600",
      warning: "orange-700",
      danger: "red-600",
    },
    typography: {
      fontFamily: {
        display: "DM Serif Display",
        body: "Special Elite",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("smooth"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "smooth",
};

/** Earth tones, natural, biophilic. */
const organic: Preset = {
  name: "organic",
  keywords: [
    "organic",
    "natural",
    "earthy",
    "botanical",
    "green",
    "forest",
    "wood",
    "earth",
    "biophilic",
    "wellness",
    "sage",
    "moss",
    "flora",
    "sustainability",
  ],
  tokens: {
    colors: {
      primary: "green-700",
      secondary: "amber-700",
      accent: "sky-500",
      background: "stone-50",
      surface: "stone-100",
      foreground: "green-950",
      muted: "stone-600",
      border: "stone-300",
      success: "green-600",
      warning: "amber-600",
      danger: "red-700",
    },
    typography: {
      fontFamily: {
        display: "Fraunces",
        body: "Lora",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("slow"),
    shadows: SHADOWS,
    radius: RADIUS,
  },
  motionStyle: "slow",
};

/** Vibrant gradient on dark with frosted glass panels. */
const glassmorphism: Preset = {
  name: "glassmorphism",
  keywords: [
    "glassmorphism",
    "glass",
    "frosted",
    "translucent",
    "blur",
    "vibrant",
    "gradient",
    "modern",
    "aurora",
    "iridescent",
    "frost",
    "transparency",
    "neon-gradient",
  ],
  tokens: {
    colors: {
      primary: "indigo-500",
      secondary: "purple-500",
      accent: "pink-400",
      background: "slate-950",
      surface: "slate-800",
      foreground: "slate-50",
      muted: "slate-400",
      border: "indigo-400",
      success: "emerald-400",
      warning: "amber-400",
      danger: "rose-400",
    },
    typography: {
      fontFamily: {
        display: "Poppins",
        body: "Outfit",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("smooth"),
    shadows: {
      none: "shadow-none",
      sm: "shadow-sm",
      md: "shadow-md",
      lg: "shadow-lg",
      xl: "shadow-xl",
      glow: "shadow-[0_8px_32px_rgba(99,102,241,0.35)]",
    },
    radius: RADIUS,
  },
  motionStyle: "smooth",
};

/** Green-on-black phosphor terminal. Companion to cyberpunk. */
const terminal: Preset = {
  name: "terminal",
  keywords: [
    "terminal",
    "cli",
    "console",
    "hacker",
    "phosphor",
    "crt",
    "shell",
    "code-editor",
    "ide",
    "monospace",
    "green-on-black",
    "amber-screen",
    "ascii",
  ],
  tokens: {
    colors: {
      primary: "green-400",
      secondary: "lime-400",
      accent: "amber-300",
      background: "black",
      surface: "neutral-950",
      foreground: "green-300",
      muted: "green-700",
      border: "green-500",
      success: "green-400",
      warning: "amber-400",
      danger: "red-500",
    },
    typography: {
      fontFamily: {
        display: "JetBrains Mono",
        body: "JetBrains Mono",
        mono: "JetBrains Mono",
      },
      fontSize: FONT_SIZE,
      fontWeight: FONT_WEIGHT,
    },
    spacing: SPACING,
    motion: motionFor("snappy"),
    shadows: SHADOWS,
    radius: {
      none: "rounded-none",
      sm: "rounded-none",
      md: "rounded-sm",
      lg: "rounded-md",
      xl: "rounded-md",
      full: "rounded-full",
    },
  },
  motionStyle: "snappy",
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/** Record of every preset keyed by name. Iteration order matches the
 * declared insertion order; the `generateTokens` scorer in AC-4 uses this
 * to break ties deterministically. */
export const presets: Record<string, Preset> = {
  cyberpunk,
  brutalist,
  luxury,
  pastel,
  monochrome,
  retro,
  organic,
  glassmorphism,
  terminal,
};

/** Ordered list of preset names (insertion order). */
export const PRESET_NAMES: ReadonlyArray<string> = Object.keys(presets);

/**
 * Look up a preset by exact name. Returns `undefined` when the name is
 * not registered; callers (e.g. AC-4's keyword scorer) are expected to
 * fall back to the closest-scoring preset in that case.
 */
export function getPreset(name: string): Preset | undefined {
  return presets[name];
}

/**
 * Convenience: list every preset as an array. Useful for the LLM prompt
 * in AC-12 ("available preset names: ...") and for iteration in tests.
 */
export function listPresets(): Preset[] {
  return Object.values(presets);
}
