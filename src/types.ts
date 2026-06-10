/**
 * src/types.ts — shared TypeScript types for the skins-mcp design system.
 *
 * These types are the canonical contract between every generator module
 * (tokens, components, layout, preview) and every input adapter (vibe, URL,
 * image). Keeping the shape here means generators and tools can evolve
 * independently as long as they continue to satisfy this interface.
 *
 * Convention: token values are *token references* (e.g. `"indigo-500"`,
 * `"rounded-md"`) rather than raw CSS values. Generators translate them to
 * Tailwind utility classes at the point of emission.
 */

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------

/**
 * The full color palette of a design system. `primary`, `secondary`, and
 * `accent` are the three brand-defining colors (overridable by the
 * `from-url` and `from-image` pipelines per AC-4). The remaining roles are
 * supporting semantic and surface colors that components fall back to.
 */
export interface ColorTokens {
  /** Primary brand color, e.g. `"indigo-500"`. */
  primary: string;
  /** Secondary brand color, e.g. `"violet-500"`. */
  secondary: string;
  /** Accent / highlight color used sparingly, e.g. `"emerald-400"`. */
  accent: string;
  /** Page background, e.g. `"slate-950"`. */
  background: string;
  /** Card / panel surface color, e.g. `"slate-900"`. */
  surface: string;
  /** Default body / heading text, e.g. `"slate-50"`. */
  foreground: string;
  /** Muted secondary text, e.g. `"slate-400"`. */
  muted: string;
  /** Hairline / divider / border color, e.g. `"slate-800"`. */
  border: string;
  /** Success state, e.g. `"emerald-500"`. */
  success: string;
  /** Warning state, e.g. `"amber-500"`. */
  warning: string;
  /** Danger / error state, e.g. `"rose-500"`. */
  danger: string;
}

// ---------------------------------------------------------------------------
// Typography tokens
// ---------------------------------------------------------------------------

/**
 * Three-slot font family stack. Each value is a Google Font family name
 * (e.g. `"Inter"`, `"Space Grotesk"`, `"JetBrains Mono"`). Tailwind's
 * font-family utilities are extended at the consumer site to map these
 * names to the real `font-[family-name]` declarations.
 */
export interface FontFamilyTokens {
  /** Display / headings. */
  display: string;
  /** Body / paragraph. */
  body: string;
  /** Code / monospaced UI. */
  mono: string;
}

/**
 * Typographic scale expressed in Tailwind class fragments. Generators
 * apply these directly (`text-base`, `text-2xl`, `leading-relaxed`).
 */
export interface FontSizeTokens {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
  "4xl": string;
}

/**
 * Weight tokens as Tailwind utility suffixes (`"font-normal"`, etc.).
 */
export interface FontWeightTokens {
  normal: string;
  medium: string;
  semibold: string;
  bold: string;
}

export interface TypographyTokens {
  fontFamily: FontFamilyTokens;
  fontSize: FontSizeTokens;
  fontWeight: FontWeightTokens;
}

// ---------------------------------------------------------------------------
// Spacing tokens
// ---------------------------------------------------------------------------

/**
 * Spacing scale expressed as Tailwind padding/margin utilities
 * (`"p-2"`, `"p-4"`, etc.). Generators use these to lay out sections.
 */
export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
  "3xl": string;
}

// ---------------------------------------------------------------------------
// Motion tokens
// ---------------------------------------------------------------------------

/**
 * Motion vocabulary. Numeric values are in **seconds** (framer-motion
 * convention). String values are framer-motion easing identifiers
 * (`"easeOut"`, `"easeIn"`, `"easeInOut"`) OR raw cubic-bezier definitions
 * (`"cubic-bezier(0.16, 1, 0.3, 1)"`).
 */
export interface MotionTokens {
  /** Default duration for entrance animations, in seconds. */
  durationBase: number;
  /** Quick micro-interactions (hover, press), in seconds. */
  durationFast: number;
  /** Slow cinematic transitions, in seconds. */
  durationSlow: number;
  /** Standard ease-out curve, referenced by every component (AC-5). */
  easeOut: string;
  /** Ease-in curve for elements leaving the viewport. */
  easeIn: string;
  /** Symmetric ease for in-out transitions. */
  easeInOut: string;
  /** Delay between staggered children, in seconds (AC-6). */
  staggerChildren: number;
}

// ---------------------------------------------------------------------------
// Shadow + radius tokens
// ---------------------------------------------------------------------------

/** Shadow scale as Tailwind utility fragments (`"shadow-sm"`, etc.). */
export interface ShadowTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  /** Optional colored "glow" used by cyberpunk / glassmorphism presets. */
  glow: string;
}

/** Border-radius scale as Tailwind utility fragments (`"rounded-md"`, etc.). */
export interface RadiusTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  /** Full circle / pill, e.g. `"rounded-full"`. */
  full: string;
}

// ---------------------------------------------------------------------------
// Top-level DesignTokens
// ---------------------------------------------------------------------------

/**
 * The complete token bundle for one design system. Every preset (AC-3),
 * generator (AC-4/5/6/7), and demo output (AC-13) operates on this shape.
 */
export interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  motion: MotionTokens;
  shadows: ShadowTokens;
  radius: RadiusTokens;
}

// ---------------------------------------------------------------------------
// Component record + DesignSystem bundle
// ---------------------------------------------------------------------------

/**
 * A single generated component: a stable `name` (used as the file name and
 * as the import key in the layout) plus the full TSX `code` source. The
 * shape is intentionally string-typed so `DesignSystem` can be safely
 * round-tripped through JSON (see the components.json file written by the
 * demo driver in AC-13).
 */
export interface DesignComponent {
  /** Component name, e.g. `"Button"`, `"Card"`, `"Input"`, `"Navbar"`, `"StatCard"`. */
  name: string;
  /** Full, ready-to-paste TSX source for the component. */
  code: string;
}

/**
 * Bundle returned by every MCP tool: a `DesignTokens` plus the ordered
 * list of generated components. The order of `components` matches the
 * layout's section order so callers can render the page top-to-bottom.
 */
export interface DesignSystem {
  tokens: DesignTokens;
  components: DesignComponent[];
}

// ---------------------------------------------------------------------------
// Shared union types
// ---------------------------------------------------------------------------

/**
 * Motion pacing discriminator used by presets (AC-3) and by the LLM path
 * to keep the right feeling across the design system.
 */
export type MotionStyle = "snappy" | "smooth" | "slow";

// ---------------------------------------------------------------------------
// Preset shape
// ---------------------------------------------------------------------------

/**
 * A built-in design preset: a self-describing bundle of `keywords` (used by
 * `generateTokens` in AC-4 to score incoming vibes), a full `DesignTokens`
 * (consumed by every generator), and a `motionStyle` discriminator that
 * informs the pace of generated animations.
 *
 * Presets live in `src/vibes/presets.ts`. The eight required by AC-3 are
 * `cyberpunk`, `brutalist`, `luxury`, `pastel`, `monochrome`, `retro`,
 * `organic`, and `glassmorphism`. Additional presets may be added.
 */
export interface Preset {
  /** Unique preset identifier (matches the key in the exported record). */
  name: string;
  /** Lowercase keyword fragments used to match free-form vibes. */
  keywords: string[];
  /** Full design tokens the preset represents. */
  tokens: DesignTokens;
  /** Pacing discriminator; presets of the same style cluster together. */
  motionStyle: MotionStyle;
}

// ---------------------------------------------------------------------------
// Five-output tool shape
// ---------------------------------------------------------------------------

/**
 * The canonical response shape of every MCP tool (AC-8/9/10). Five keys:
 *
 *  - `tokens`    — the resolved `DesignTokens`
 *  - `components` — a record of component name → TSX string (5 entries).
 *                   Note: this is `Record<string, string>` rather than
 *                   `DesignComponent[]` because the AC-8/9/10 spec calls
 *                   for "component-name → TSX string" mapping. Use
 *                   `DesignSystem.components` (an ordered array) when you
 *                   need the full `{name, code}` record.
 *  - `layout`    — a single TSX string composing the page
 *  - `preview`   — a single self-contained HTML document
 *  - `files`     — a record of component name → TSX string (same as
 *                  `components`; provided as a separate key for callers
 *                  that want to splat files to disk)
 */
export interface ToolOutput {
  tokens: DesignTokens;
  components: Record<string, string>;
  layout: string;
  preview: string;
  files: Record<string, string>;
}
