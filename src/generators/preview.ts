/**
 * src/generators/preview.ts — self-contained HTML preview generation.
 *
 * Exports `generatePreview(tokens, layoutSource)` which returns a single
 * HTML document (one string) that can be written to disk and opened in
 * a browser. The preview is a parallel, non-React re-implementation of
 * the same visual structure the `layout.ts` generator emits, but as
 * plain HTML so the page can render without a build step.
 *
 * The returned document includes:
 *
 *   1. The Tailwind Play CDN script tag — every Tailwind utility class
 *      used in the markup is JIT-compiled at runtime.
 *   2. Google Fonts <link> tags for the display + body typefaces.
 *   3. A <style> block defining CSS variables for every token color
 *      (hex value) and every motion duration (seconds), plus a tiny
 *      @keyframes block that references them.
 *   4. Inline <div> markup mirroring the six layout sections in order
 *      (Navbar → Hero → StatCard grid → Input form → Card list →
 *      Footer) so every section is visible when the file is opened in
 *      a browser.
 *
 * The page produces zero console errors and renders all six sections
 * with the token-driven colors, spacing, radius, shadow, and motion
 * feel of the supplied `DesignTokens`.
 */
import type { DesignTokens } from "../types";

// ---------------------------------------------------------------------------
// Tailwind v3.4 hex lookup
// ---------------------------------------------------------------------------
//
// Compact `name → #rrggbb` lookup for every Tailwind v3.4 default color
// plus black/white/transparent. We keep this table inline so the
// generated HTML is fully self-contained (no runtime fetch of the
// palette). Values match `tailwindcss/src/public/resolve-config.js`.

const HEX: Record<string, string> = {
  // Slate
  "slate-50": "#f8fafc", "slate-100": "#f1f5f9", "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1", "slate-400": "#94a3b8", "slate-500": "#64748b",
  "slate-600": "#475569", "slate-700": "#334155", "slate-800": "#1e293b",
  "slate-900": "#0f172a", "slate-950": "#020617",
  // Gray
  "gray-50": "#f9fafb", "gray-100": "#f3f4f6", "gray-200": "#e5e7eb",
  "gray-300": "#d1d5db", "gray-400": "#9ca3af", "gray-500": "#6b7280",
  "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937",
  "gray-900": "#111827", "gray-950": "#030712",
  // Zinc
  "zinc-50": "#fafafa", "zinc-100": "#f4f4f5", "zinc-200": "#e4e4e7",
  "zinc-300": "#d4d4d8", "zinc-400": "#a1a1aa", "zinc-500": "#71717a",
  "zinc-600": "#52525b", "zinc-700": "#3f3f46", "zinc-800": "#27272a",
  "zinc-900": "#18181b", "zinc-950": "#09090b",
  // Neutral
  "neutral-50": "#fafafa", "neutral-100": "#f5f5f5", "neutral-200": "#e5e5e5",
  "neutral-300": "#d4d4d4", "neutral-400": "#a3a3a3", "neutral-500": "#737373",
  "neutral-600": "#525252", "neutral-700": "#404040", "neutral-800": "#262626",
  "neutral-900": "#171717", "neutral-950": "#0a0a0a",
  // Stone
  "stone-50": "#fafaf9", "stone-100": "#f5f5f4", "stone-200": "#e7e5e4",
  "stone-300": "#d6d3d1", "stone-400": "#a8a29e", "stone-500": "#78716c",
  "stone-600": "#57534e", "stone-700": "#44403c", "stone-800": "#292524",
  "stone-900": "#1c1917", "stone-950": "#0c0a09",
  // Red
  "red-50": "#fef2f2", "red-100": "#fee2e2", "red-200": "#fecaca",
  "red-300": "#fca5a5", "red-400": "#f87171", "red-500": "#ef4444",
  "red-600": "#dc2626", "red-700": "#b91c1c", "red-800": "#991b1b",
  "red-900": "#7f1d1d", "red-950": "#450a0a",
  // Orange
  "orange-50": "#fff7ed", "orange-100": "#ffedd5", "orange-200": "#fed7aa",
  "orange-300": "#fdba74", "orange-400": "#fb923c", "orange-500": "#f97316",
  "orange-600": "#ea580c", "orange-700": "#c2410c", "orange-800": "#9a3412",
  "orange-900": "#7c2d12", "orange-950": "#431407",
  // Amber
  "amber-50": "#fffbeb", "amber-100": "#fef3c7", "amber-200": "#fde68a",
  "amber-300": "#fcd34d", "amber-400": "#fbbf24", "amber-500": "#f59e0b",
  "amber-600": "#d97706", "amber-700": "#b45309", "amber-800": "#92400e",
  "amber-900": "#78350f", "amber-950": "#451a03",
  // Yellow
  "yellow-50": "#fefce8", "yellow-100": "#fef9c3", "yellow-200": "#fef08a",
  "yellow-300": "#fde047", "yellow-400": "#facc15", "yellow-500": "#eab308",
  "yellow-600": "#ca8a04", "yellow-700": "#a16207", "yellow-800": "#854d0e",
  "yellow-900": "#713f12", "yellow-950": "#422006",
  // Lime
  "lime-50": "#f7fee7", "lime-100": "#ecfccb", "lime-200": "#d9f99d",
  "lime-300": "#bef264", "lime-400": "#a3e635", "lime-500": "#84cc16",
  "lime-600": "#65a30d", "lime-700": "#4d7c0f", "lime-800": "#3f6212",
  "lime-900": "#365314", "lime-950": "#1a2e05",
  // Green
  "green-50": "#f0fdf4", "green-100": "#dcfce7", "green-200": "#bbf7d0",
  "green-300": "#86efac", "green-400": "#4ade80", "green-500": "#22c55e",
  "green-600": "#16a34a", "green-700": "#15803d", "green-800": "#166534",
  "green-900": "#14532d", "green-950": "#052e16",
  // Emerald
  "emerald-50": "#ecfdf5", "emerald-100": "#d1fae5", "emerald-200": "#a7f3d0",
  "emerald-300": "#6ee7b7", "emerald-400": "#34d399", "emerald-500": "#10b981",
  "emerald-600": "#059669", "emerald-700": "#047857", "emerald-800": "#065f46",
  "emerald-900": "#064e3b", "emerald-950": "#022c22",
  // Teal
  "teal-50": "#f0fdfa", "teal-100": "#ccfbf1", "teal-200": "#99f6e4",
  "teal-300": "#5eead4", "teal-400": "#2dd4bf", "teal-500": "#14b8a6",
  "teal-600": "#0d9488", "teal-700": "#0f766e", "teal-800": "#115e59",
  "teal-900": "#134e4a", "teal-950": "#042f2e",
  // Cyan
  "cyan-50": "#ecfeff", "cyan-100": "#cffafe", "cyan-200": "#a5f3fc",
  "cyan-300": "#67e8f9", "cyan-400": "#22d3ee", "cyan-500": "#06b6d4",
  "cyan-600": "#0891b2", "cyan-700": "#0e7490", "cyan-800": "#155e75",
  "cyan-900": "#164e63", "cyan-950": "#083344",
  // Sky
  "sky-50": "#f0f9ff", "sky-100": "#e0f2fe", "sky-200": "#bae6fd",
  "sky-300": "#7dd3fc", "sky-400": "#38bdf8", "sky-500": "#0ea5e9",
  "sky-600": "#0284c7", "sky-700": "#0369a1", "sky-800": "#075985",
  "sky-900": "#0c4a6e", "sky-950": "#082f49",
  // Blue
  "blue-50": "#eff6ff", "blue-100": "#dbeafe", "blue-200": "#bfdbfe",
  "blue-300": "#93c5fd", "blue-400": "#60a5fa", "blue-500": "#3b82f6",
  "blue-600": "#2563eb", "blue-700": "#1d4ed8", "blue-800": "#1e40af",
  "blue-900": "#1e3a8a", "blue-950": "#172554",
  // Indigo
  "indigo-50": "#eef2ff", "indigo-100": "#e0e7ff", "indigo-200": "#c7d2fe",
  "indigo-300": "#a5b4fc", "indigo-400": "#818cf8", "indigo-500": "#6366f1",
  "indigo-600": "#4f46e5", "indigo-700": "#4338ca", "indigo-800": "#3730a3",
  "indigo-900": "#312e81", "indigo-950": "#1e1b4b",
  // Violet
  "violet-50": "#f5f3ff", "violet-100": "#ede9fe", "violet-200": "#ddd6fe",
  "violet-300": "#c4b5fd", "violet-400": "#a78bfa", "violet-500": "#8b5cf6",
  "violet-600": "#7c3aed", "violet-700": "#6d28d9", "violet-800": "#5b21b6",
  "violet-900": "#4c1d95", "violet-950": "#2e1065",
  // Purple
  "purple-50": "#faf5ff", "purple-100": "#f3e8ff", "purple-200": "#e9d5ff",
  "purple-300": "#d8b4fe", "purple-400": "#c084fc", "purple-500": "#a855f7",
  "purple-600": "#9333ea", "purple-700": "#7e22ce", "purple-800": "#6b21a8",
  "purple-900": "#581c87", "purple-950": "#3b0764",
  // Fuchsia
  "fuchsia-50": "#fdf4ff", "fuchsia-100": "#fae8ff", "fuchsia-200": "#f5d0fe",
  "fuchsia-300": "#f0abfc", "fuchsia-400": "#e879f9", "fuchsia-500": "#d946ef",
  "fuchsia-600": "#c026d3", "fuchsia-700": "#a21caf", "fuchsia-800": "#86198f",
  "fuchsia-900": "#701a75", "fuchsia-950": "#4a044e",
  // Pink
  "pink-50": "#fdf2f8", "pink-100": "#fce7f3", "pink-200": "#fbcfe8",
  "pink-300": "#f9a8d4", "pink-400": "#f472b6", "pink-500": "#ec4899",
  "pink-600": "#db2777", "pink-700": "#be185d", "pink-800": "#9d174d",
  "pink-900": "#831843", "pink-950": "#500724",
  // Rose
  "rose-50": "#fff1f2", "rose-100": "#ffe4e6", "rose-200": "#fecdd3",
  "rose-300": "#fda4af", "rose-400": "#fb7185", "rose-500": "#f43f5e",
  "rose-600": "#e11d48", "rose-700": "#be123c", "rose-800": "#9f1239",
  "rose-900": "#881337", "rose-950": "#4c0519",
  // Neutrals
  "white": "#ffffff",
  "black": "#000000",
  "transparent": "transparent",
};

/** Resolve a Tailwind color name (e.g. `"fuchsia-500"`) to its hex. */
function hex(name: string): string {
  return HEX[name] ?? "#000000";
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

/** Escape user-supplied strings for safe insertion into HTML markup. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Encode a Google Font family name (which may contain spaces, e.g.
 * `"Playfair Display"`) for use in a `family=` query string value.
 */
function gf(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, "+");
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build a self-contained HTML document that previews the supplied
 * `DesignTokens` using the same six-section structure as the
 * React-based `generateLayout` output.
 *
 * The returned string is suitable for `fs.writeFileSync(path, html)` and
 * `agent-browser open path`. It contains no `import` statements, no
 * TypeScript, and no React — just plain HTML + Tailwind utility classes
 * + a tiny CSS keyframes block. The Tailwind Play CDN processes all
 * classes at runtime.
 *
 * @param tokens         The resolved design tokens to render.
 * @param layoutSource   The TSX source from `generateLayout`. Currently
 *                       unused by the renderer (the preview mirrors the
 *                       same structure as the layout), but kept in the
 *                       signature so future iterations can parse it.
 */
export function generatePreview(
  tokens: DesignTokens,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  layoutSource: string,
): string {
  // Unpack the token bundle so the template below stays readable.
  const c = tokens.colors;
  const ty = tokens.typography;
  const sp = tokens.spacing;
  const sh = tokens.shadows;
  const r = tokens.radius;
  const m = tokens.motion;

  // Pre-compute the CSS variable block. Each Tailwind color name is
  // resolved to its hex equivalent at generation time.
  const colorVars = [
    ["--color-primary",   hex(c.primary)],
    ["--color-secondary", hex(c.secondary)],
    ["--color-accent",    hex(c.accent)],
    ["--color-background", hex(c.background)],
    ["--color-surface",   hex(c.surface)],
    ["--color-foreground", hex(c.foreground)],
    ["--color-muted",     hex(c.muted)],
    ["--color-border",    hex(c.border)],
    ["--color-success",   hex(c.success)],
    ["--color-warning",   hex(c.warning)],
    ["--color-danger",    hex(c.danger)],
  ]
    .map(([k, v]) => `        ${k}: ${v};`)
    .join("\n");

  const motionVars = [
    ["--duration-base", `${m.durationBase}s`],
    ["--duration-fast", `${m.durationFast}s`],
    ["--duration-slow", `${m.durationSlow}s`],
    ["--stagger",       `${m.staggerChildren}s`],
  ]
    .map(([k, v]) => `        ${k}: ${v};`)
    .join("\n");

  // Google Fonts link for the display + body typefaces. mono is wired
  // up too for completeness; it falls back to the body face if Google
  // Fonts can't find it.
  const fontsHref =
    `https://fonts.googleapis.com/css2?` +
    `family=${gf(ty.fontFamily.display)}:wght@400;500;600;700&` +
    `family=${gf(ty.fontFamily.body)}:wght@400;500;600;700&` +
    `family=${gf(ty.fontFamily.mono)}:wght@400;500&` +
    `display=swap`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>skins-mcp preview — ${esc(ty.fontFamily.display)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontsHref}" rel="stylesheet">
  <style>
    :root {
${colorVars}
${motionVars}
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: '${esc(ty.fontFamily.body)}', system-ui, -apple-system, sans-serif;
      background-color: var(--color-background);
      color: var(--color-foreground);
      -webkit-font-smoothing: antialiased;
    }

    .font-display {
      font-family: '${esc(ty.fontFamily.display)}', system-ui, -apple-system, sans-serif;
    }
    .font-mono {
      font-family: '${esc(ty.fontFamily.mono)}', ui-monospace, SFMono-Regular, monospace;
    }

    /* Entrance animation mirroring the layout's motion.div stagger. */
    @keyframes skin-fade-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .stagger > * {
      opacity: 0;
      animation: skin-fade-in var(--duration-base) var(--ease-out) forwards;
    }
    .stagger > *:nth-child(1) { animation-delay: calc(var(--stagger) * 0); }
    .stagger > *:nth-child(2) { animation-delay: calc(var(--stagger) * 1); }
    .stagger > *:nth-child(3) { animation-delay: calc(var(--stagger) * 2); }
    .stagger > *:nth-child(4) { animation-delay: calc(var(--stagger) * 3); }
    .stagger > *:nth-child(5) { animation-delay: calc(var(--stagger) * 4); }
    .stagger > *:nth-child(6) { animation-delay: calc(var(--stagger) * 5); }
    .stagger > *:nth-child(7) { animation-delay: calc(var(--stagger) * 6); }
    .stagger > *:nth-child(8) { animation-delay: calc(var(--stagger) * 7); }
  </style>
</head>
<body class="min-h-screen">
  <div class="stagger">
    <!-- 1. Navbar ------------------------------------------------------- -->
    <nav class="sticky top-0 z-40 w-full bg-${c.surface} border-b border-${c.border} ${sh.sm}">
      <div class="mx-auto flex max-w-6xl items-center justify-between ${sp.md} ${sp.lg}">
        <span class="font-display ${ty.fontWeight.bold} ${ty.fontSize.lg} text-${c.foreground}">${esc(ty.fontFamily.display)}</span>
        <ul class="flex items-center gap-4">
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#hero">Home</a></li>
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#stats">Stats</a></li>
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#signup">Sign up</a></li>
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#features">Features</a></li>
        </ul>
      </div>
    </nav>

    <!-- 2. Hero --------------------------------------------------------- -->
    <section id="hero" class="mx-auto max-w-6xl ${sp["3xl"]} ${sp.lg} flex flex-col items-start gap-4">
      <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-${c.surface} text-${c.accent} border border-${c.border} border ${ty.fontSize.xs} ${ty.fontWeight.medium}">
        <span aria-hidden="true">●</span>
        New: token-driven design systems
      </span>
      <h1 class="font-display ${ty.fontSize["4xl"]} ${ty.fontWeight.bold} text-${c.foreground} leading-tight max-w-3xl">
        A complete React + Tailwind + Framer Motion design system, generated from a single vibe.
      </h1>
      <p class="${ty.fontSize.lg} ${ty.fontWeight.normal} text-${c.muted} max-w-2xl">
        Drop the file into your project, render &lt;DemoPage /&gt;, and you have a fully animated landing page in seconds — no manual Tailwind configuration required.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button class="inline-flex items-center justify-center ${ty.fontWeight.semibold} ${ty.fontSize.sm} ${sp.sm} ${sp.md} ${r.md} transition-colors bg-${c.primary} text-${c.background} hover:opacity-90 focus:outline-none focus:ring-2 ring-${c.primary} focus:ring-offset-2" type="button">
          Get started
        </button>
        <button class="inline-flex items-center justify-center ${ty.fontWeight.semibold} ${ty.fontSize.sm} ${sp.sm} ${sp.md} ${r.md} transition-colors bg-transparent text-${c.foreground} border border-${c.border} hover:bg-${c.surface} focus:outline-none focus:ring-2 ring-${c.primary} focus:ring-offset-2" type="button">
          Read the docs
        </button>
      </div>
    </section>

    <!-- 3. StatCard grid ------------------------------------------------ -->
    <section id="stats" class="mx-auto max-w-6xl ${sp.lg} ${sp.lg} ${sp["2xl"]}">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="flex flex-col gap-2 bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.sm} ${sp.md}">
          <span class="${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.muted} uppercase tracking-wide">Active users</span>
          <span class="${ty.fontSize["3xl"]} ${ty.fontWeight.bold} text-${c.foreground}">12,438</span>
          <span class="inline-flex items-center gap-1 ${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.success}">
            <span aria-hidden="true">▲</span>
            +8.2% vs last week
          </span>
        </div>
        <div class="flex flex-col gap-2 bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.sm} ${sp.md}">
          <span class="${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.muted} uppercase tracking-wide">Revenue</span>
          <span class="${ty.fontSize["3xl"]} ${ty.fontWeight.bold} text-${c.foreground}">$284K</span>
          <span class="inline-flex items-center gap-1 ${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.success}">
            <span aria-hidden="true">▲</span>
            +12.4% vs last week
          </span>
        </div>
        <div class="flex flex-col gap-2 bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.sm} ${sp.md}">
          <span class="${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.muted} uppercase tracking-wide">Churn</span>
          <span class="${ty.fontSize["3xl"]} ${ty.fontWeight.bold} text-${c.foreground}">2.1%</span>
          <span class="inline-flex items-center gap-1 ${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.danger}">
            <span aria-hidden="true">▼</span>
            -0.3 pts vs last week
          </span>
        </div>
        <div class="flex flex-col gap-2 bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.sm} ${sp.md}">
          <span class="${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.muted} uppercase tracking-wide">NPS</span>
          <span class="${ty.fontSize["3xl"]} ${ty.fontWeight.bold} text-${c.foreground}">72</span>
          <span class="inline-flex items-center gap-1 ${ty.fontSize.xs} ${ty.fontWeight.medium} text-${c.muted}">
            <span aria-hidden="true">■</span>
            no change
          </span>
        </div>
      </div>
    </section>

    <!-- 4. Input form --------------------------------------------------- -->
    <section id="signup" class="mx-auto max-w-6xl ${sp.lg} ${sp.lg} ${sp["2xl"]}">
      <div class="grid grid-cols-1 gap-4 bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.md} ${sp.lg} md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label for="preview-name" class="${ty.fontWeight.medium} ${ty.fontSize.sm} text-${c.foreground}">Full name</label>
          <input id="preview-name" type="text" placeholder="Ada Lovelace" class="w-full bg-${c.background} text-${c.foreground} border border-${c.border} ${r.md} ${sp.sm} ${sp.md} ${ty.fontSize.base} placeholder:text-${c.muted} focus:outline-none focus:ring-2 ring-${c.primary} transition-shadow" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="preview-email" class="${ty.fontWeight.medium} ${ty.fontSize.sm} text-${c.foreground}">Email</label>
          <input id="preview-email" type="email" placeholder="ada@example.dev" class="w-full bg-${c.background} text-${c.foreground} border border-${c.border} ${r.md} ${sp.sm} ${sp.md} ${ty.fontSize.base} placeholder:text-${c.muted} focus:outline-none focus:ring-2 ring-${c.primary} transition-shadow" />
        </div>
        <div class="flex items-end">
          <button class="w-full inline-flex items-center justify-center ${ty.fontWeight.semibold} ${ty.fontSize.sm} ${sp.sm} ${sp.md} ${r.md} transition-colors bg-${c.primary} text-${c.background} hover:opacity-90 focus:outline-none focus:ring-2 ring-${c.primary} focus:ring-offset-2" type="submit">
            Sign up
          </button>
        </div>
      </div>
    </section>

    <!-- 5. Card list ---------------------------------------------------- -->
    <section id="features" class="mx-auto max-w-6xl ${sp.lg} ${sp.lg} ${sp["2xl"]}">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article class="relative overflow-hidden bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.md} ${sp.md}">
          <span aria-hidden="true" class="absolute inset-y-0 left-0 w-1 bg-${c.primary}"></span>
          <h3 class="${ty.fontWeight.semibold} ${ty.fontSize.lg} mb-2">Composable primitives</h3>
          <p class="${ty.fontSize.sm} ${ty.fontWeight.normal} text-${c.muted}">
            Every block is a motion component, so the entrance animation is consistent across the page.
          </p>
        </article>
        <article class="relative overflow-hidden bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.md} ${sp.md}">
          <span aria-hidden="true" class="absolute inset-y-0 left-0 w-1 bg-${c.secondary}"></span>
          <h3 class="${ty.fontWeight.semibold} ${ty.fontSize.lg} mb-2">Token-driven styling</h3>
          <p class="${ty.fontSize.sm} ${ty.fontWeight.normal} text-${c.muted}">
            Spacing, color, radius and motion all flow from a single DesignTokens bundle.
          </p>
        </article>
        <article class="relative overflow-hidden bg-${c.surface} text-${c.foreground} border border-${c.border} ${r.lg} ${sh.md} ${sp.md}">
          <span aria-hidden="true" class="absolute inset-y-0 left-0 w-1 bg-${c.accent}"></span>
          <h3 class="${ty.fontWeight.semibold} ${ty.fontSize.lg} mb-2">Tailwind v3.4 utilities</h3>
          <p class="${ty.fontSize.sm} ${ty.fontWeight.normal} text-${c.muted}">
            All classes are real Tailwind utilities — paste the file into any v3.4+ project and it just works.
          </p>
        </article>
      </div>
    </section>

    <!-- 6. Footer ------------------------------------------------------- -->
    <footer class="mt-12 w-full bg-${c.surface} border-t border-${c.border} ${sp.lg}">
      <div class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <span class="${ty.fontSize.sm} ${ty.fontWeight.normal} text-${c.muted}">
          © 2026 ${esc(ty.fontFamily.display)}. Built with skins-mcp.
        </span>
        <ul class="flex items-center gap-4">
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#">Privacy</a></li>
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#">Terms</a></li>
          <li><a class="${ty.fontSize.sm} ${ty.fontWeight.medium} text-${c.muted} hover:text-${c.foreground} transition-colors" href="#">Contact</a></li>
        </ul>
      </div>
    </footer>
  </div>
</body>
</html>
`;
}
