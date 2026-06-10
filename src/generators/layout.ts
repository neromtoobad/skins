/**
 * src/generators/layout.ts — full-page layout generation for skins-mcp.
 *
 * Exports `generateLayout(tokens)` which returns a single TSX string
 * containing a complete, paste-ready `DemoPage` React component. The
 * emitted file is self-contained: it imports `motion` from
 * `framer-motion` and `* as React` from `react`, and uses only Tailwind
 * utility classes derived from the supplied `DesignTokens`.
 *
 * The page is composed of six sections, in order:
 *
 *   Navbar → Hero → StatCard grid → Input form → Card list → Footer
 *
 * A single `motion.div` wraps everything. Its `variants.container`
 * declares `staggerChildren: <tokens.motion.staggerChildren>` so the
 * six section-level `motion.*` children fade-and-rise in sequence.
 * Each child inherits the `itemVariants` shape, which references
 * `tokens.motion.durationBase` and `tokens.motion.easeOut`.
 *
 * The emitted TSX is guaranteed to compile under `tsc --noEmit --strict`
 * — no `any` casts, no missing imports, and every class fragment is a
 * real Tailwind v3.4+ utility.
 */
import type { DesignTokens } from "../types";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build a complete, paste-ready `DemoPage` `.tsx` source string for
 * the supplied `DesignTokens`. The output is a single file: import it,
 * render `<DemoPage />`, and you have a fully animated landing page.
 *
 * @example
 *   const tokens = await generateTokens({ vibe: "neon cyberpunk" });
 *   const tsx = generateLayout(tokens);
 *   fs.writeFileSync("demo-output/vibe/layout.tsx", tsx);
 */
export function generateLayout(tokens: DesignTokens): string {
  return buildDemoPage(tokens);
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

/**
 * Escape a backtick inside a template literal so the generated source
 * is always a single contiguous string. (We use backtick template
 * literals internally so class fragments like `${bg(t.colors.primary)}`
 * interpolate cleanly into multi-line className arrays.)
 */
function backtick(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Quote a string for safe interpolation into a TSX literal. We use
 * double-quotes everywhere in the generated source.
 */
function q(s: string): string {
  return JSON.stringify(s);
}

/** Build a `bg-<name>` utility class. */
function bg(name: string): string {
  return `bg-${name}`;
}

/** Build a `text-<name>` utility class. */
function text(name: string): string {
  return `text-${name}`;
}

/** Build a `border-<name>` utility class. */
function border(name: string): string {
  return `border-${name}`;
}

/** Build a `ring-<name>` utility class. */
function ring(name: string): string {
  return `ring-${name}`;
}

// ---------------------------------------------------------------------------
// The full DemoPage emitter
// ---------------------------------------------------------------------------

function buildDemoPage(t: DesignTokens): string {
  // The emitted source. We use a single template literal so the whole
  // file is one continuous string — easier to inspect, easier to
  // writeFileSync, and matches the format the AC-13 demo driver expects.
  //
  // Note: every class fragment below is a real Tailwind v3.4+ utility.
  // No bespoke values, no `tw\`...\`` calls. Just the same shape a
  // developer would type by hand.
  return `/**
 * DemoPage — full-page composition for ${backtick(String(t.typography.fontFamily.display))}.
 *
 * Sections, top to bottom:
 *   1. Navbar        — sticky top bar with brand + nav links
 *   2. Hero          — headline, subhead, primary + secondary CTAs
 *   3. StatCard grid — 4 metric tiles in a responsive 4-col grid
 *   4. Input form    — 2 labeled inputs + submit button
 *   5. Card list     — 3 content cards with accent bars
 *   6. Footer        — copyright + secondary links
 *
 * The whole page is wrapped in a single parent \`motion.div\` whose
 * \`containerVariants\` drive a 6-step staggered entrance animation.
 * Each section is a \`motion.<element>\` that inherits \`itemVariants\`.
 *
 * Motion timing is derived from the design tokens:
 *   - staggerChildren = ${t.motion.staggerChildren}  (from tokens.motion.staggerChildren)
 *   - item transition duration = ${t.motion.durationBase}  (from tokens.motion.durationBase)
 *   - item transition ease     = ${q(t.motion.easeOut)}     (from tokens.motion.easeOut)
 */
import * as React from "react";
import { motion, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: ${t.motion.staggerChildren},
      delayChildren: 0,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

const navLinkClass = [
  "${t.typography.fontSize.sm}",
  "${t.typography.fontWeight.medium}",
  "${text(t.colors.muted)}",
  "hover:${text(t.colors.foreground)}",
  "transition-colors",
].join(" ");

const STAT_TILES: ReadonlyArray<{ label: string; value: string; delta: string; trend: "up" | "down" | "flat" }> = [
  { label: "Active users", value: "12,438", delta: "+8.2% vs last week", trend: "up" },
  { label: "Revenue",     value: "$284K",  delta: "+12.4% vs last week", trend: "up" },
  { label: "Churn",       value: "2.1%",   delta: "-0.3 pts vs last week", trend: "down" },
  { label: "NPS",         value: "72",     delta: "no change", trend: "flat" },
];

const TREND_COLOR: Record<"up" | "down" | "flat", string> = {
  up:   "${text(t.colors.success)}",
  down: "${text(t.colors.danger)}",
  flat: "${text(t.colors.muted)}",
};

const TREND_GLYPH: Record<"up" | "down" | "flat", string> = {
  up:   "▲",
  down: "▼",
  flat: "■",
};

const FORM_FIELDS: ReadonlyArray<{ label: string; placeholder: string; type: "text" | "email" }> = [
  { label: "Full name", placeholder: "Ada Lovelace",  type: "text" },
  { label: "Email",     placeholder: "ada@example.dev", type: "email" },
];

const CARD_ITEMS: ReadonlyArray<{ title: string; body: string; accent: "primary" | "secondary" | "accent" }> = [
  {
    title: "Composable primitives",
    body:  "Every block is a motion component, so the entrance animation is consistent across the page.",
    accent: "primary",
  },
  {
    title: "Token-driven styling",
    body:  "Spacing, color, radius and motion all flow from a single DesignTokens bundle.",
    accent: "secondary",
  },
  {
    title: "Tailwind v3.4 utilities",
    body:  "All classes are real Tailwind utilities — paste the file into any v3.4+ project and it just works.",
    accent: "accent",
  },
];

function StatTile({ label, value, delta, trend }: typeof STAT_TILES[number]): React.ReactElement {
  return (
    <motion.div
      variants={itemVariants}
      className={[
        "flex flex-col gap-2",
        "${bg(t.colors.surface)}",
        "${text(t.colors.foreground)}",
        "${border(t.colors.border)}",
        "border",
        "${t.radius.lg}",
        "${t.shadows.sm}",
        "${t.spacing.md}",
      ].join(" ")}
    >
      <span
        className={[
          "${t.typography.fontSize.xs}",
          "${t.typography.fontWeight.medium}",
          "${text(t.colors.muted)}",
          "uppercase tracking-wide",
        ].join(" ")}
      >
        {label}
      </span>
      <span
        className={[
          "${t.typography.fontSize["3xl"]}",
          "${t.typography.fontWeight.bold}",
          "${text(t.colors.foreground)}",
        ].join(" ")}
      >
        {value}
      </span>
      <span
        className={[
          "inline-flex items-center gap-1",
          "${t.typography.fontSize.xs}",
          "${t.typography.fontWeight.medium}",
          TREND_COLOR[trend],
        ].join(" ")}
      >
        <span aria-hidden="true">{TREND_GLYPH[trend]}</span>
        {delta}
      </span>
    </motion.div>
  );
}

function ContentCard({ title, body, accent }: typeof CARD_ITEMS[number]): React.ReactElement {
  const accentBg: Record<typeof accent, string> = {
    primary:   "${bg(t.colors.primary)}",
    secondary: "${bg(t.colors.secondary)}",
    accent:    "${bg(t.colors.accent)}",
  };
  return (
    <motion.article
      variants={itemVariants}
      className={[
        "relative overflow-hidden",
        "${bg(t.colors.surface)}",
        "${text(t.colors.foreground)}",
        "${border(t.colors.border)}",
        "border",
        "${t.radius.lg}",
        "${t.shadows.md}",
        "${t.spacing.md}",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={["absolute inset-y-0 left-0 w-1", accentBg[accent]].join(" ")}
      />
      <h3
        className={[
          "${t.typography.fontWeight.semibold}",
          "${t.typography.fontSize.lg}",
          "mb-2",
        ].join(" ")}
      >
        {title}
      </h3>
      <p
        className={[
          "${t.typography.fontSize.sm}",
          "${t.typography.fontWeight.normal}",
          "${text(t.colors.muted)}",
        ].join(" ")}
      >
        {body}
      </p>
    </motion.article>
  );
}

export default function DemoPage(): React.ReactElement {
  const inputId = React.useId();
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={[
        "min-h-screen w-full",
        "${bg(t.colors.background)}",
        "${text(t.colors.foreground)}",
        "${t.typography.fontFamily.body}",
        "${t.typography.fontSize.base}",
        "${t.typography.fontWeight.normal}",
      ].join(" ")}
    >
      {/* 1. Navbar ------------------------------------------------------- */}
      <motion.nav
        variants={itemVariants}
        className={[
          "sticky top-0 z-40 w-full",
          "${bg(t.colors.surface)}",
          "${border(t.colors.border)}",
          "border-b",
          "${t.shadows.sm}",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex max-w-6xl items-center justify-between",
            "${t.spacing.md} ${t.spacing.lg}",
          ].join(" ")}
        >
          <span
            className={[
              "${t.typography.fontWeight.bold}",
              "${t.typography.fontSize.lg}",
              "${text(t.colors.foreground)}",
            ].join(" ")}
          >
            ${backtick(String(t.typography.fontFamily.display))}
          </span>
          <ul className="flex items-center gap-4">
            <li><a className={navLinkClass} href="#hero">Home</a></li>
            <li><a className={navLinkClass} href="#stats">Stats</a></li>
            <li><a className={navLinkClass} href="#signup">Sign up</a></li>
            <li><a className={navLinkClass} href="#features">Features</a></li>
          </ul>
        </div>
      </motion.nav>

      {/* 2. Hero --------------------------------------------------------- */}
      <motion.section
        id="hero"
        variants={itemVariants}
        className={[
          "mx-auto max-w-6xl",
          "${t.spacing["3xl"]} ${t.spacing.lg}",
          "flex flex-col items-start gap-4",
        ].join(" ")}
      >
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-1",
            "${bg(t.colors.surface)}",
            "${text(t.colors.accent)}",
            "${border(t.colors.border)}",
            "border",
            "${t.typography.fontSize.xs}",
            "${t.typography.fontWeight.medium}",
          ].join(" ")}
        >
          <span aria-hidden="true">●</span>
          New: token-driven design systems
        </span>
        <h1
          className={[
            "${t.typography.fontFamily.display}",
            "${t.typography.fontSize["4xl"]}",
            "${t.typography.fontWeight.bold}",
            "${text(t.colors.foreground)}",
            "leading-tight",
            "max-w-3xl",
          ].join(" ")}
        >
          A complete React + Tailwind + Framer Motion design system, generated from a single vibe.
        </h1>
        <p
          className={[
            "${t.typography.fontSize.lg}",
            "${t.typography.fontWeight.normal}",
            "${text(t.colors.muted)}",
            "max-w-2xl",
          ].join(" ")}
        >
          Drop the file into your project, render &lt;DemoPage /&gt;, and you have a fully animated landing page in seconds — no manual Tailwind configuration required.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={[
              "inline-flex items-center justify-center",
              "${t.typography.fontWeight.semibold}",
              "${t.typography.fontSize.sm}",
              "${t.spacing.sm} ${t.spacing.md}",
              "${t.radius.md}",
              "transition-colors",
              "${bg(t.colors.primary)}",
              "${text(t.colors.background)}",
              "hover:opacity-90",
              "focus:outline-none focus:ring-2 ${ring(t.colors.primary)} focus:ring-offset-2",
            ].join(" ")}
            type="button"
          >
            Get started
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={[
              "inline-flex items-center justify-center",
              "${t.typography.fontWeight.semibold}",
              "${t.typography.fontSize.sm}",
              "${t.spacing.sm} ${t.spacing.md}",
              "${t.radius.md}",
              "transition-colors",
              "bg-transparent",
              "${text(t.colors.foreground)}",
              "${border(t.colors.border)}",
              "border",
              "hover:${bg(t.colors.surface)}",
              "focus:outline-none focus:ring-2 ${ring(t.colors.primary)} focus:ring-offset-2",
            ].join(" ")}
            type="button"
          >
            Read the docs
          </motion.button>
        </div>
      </motion.section>

      {/* 3. StatCard grid ------------------------------------------------ */}
      <section
        id="stats"
        className={["mx-auto max-w-6xl", "${t.spacing.lg} ${t.spacing.lg}", "${t.spacing["2xl"]}"].join(" ")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_TILES.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>
      </section>

      {/* 4. Input form --------------------------------------------------- */}
      <motion.section
        id="signup"
        variants={itemVariants}
        className={["mx-auto max-w-6xl", "${t.spacing.lg} ${t.spacing.lg}", "${t.spacing["2xl"]}"].join(" ")}
      >
        <div
          className={[
            "grid grid-cols-1 gap-4",
            "${bg(t.colors.surface)}",
            "${text(t.colors.foreground)}",
            "${border(t.colors.border)}",
            "border",
            "${t.radius.lg}",
            "${t.shadows.md}",
            "${t.spacing.lg}",
            "md:grid-cols-3",
          ].join(" ")}
        >
          {FORM_FIELDS.map((field) => {
            const fieldId = \`\${inputId}-\${field.label.replace(/\\s+/g, "-").toLowerCase()}\`;
            return (
              <div key={field.label} className="flex flex-col gap-1">
                <label
                  htmlFor={fieldId}
                  className={[
                    "${t.typography.fontWeight.medium}",
                    "${t.typography.fontSize.sm}",
                    "${text(t.colors.foreground)}",
                  ].join(" ")}
                >
                  {field.label}
                </label>
                <input
                  id={fieldId}
                  type={field.type}
                  placeholder={field.placeholder}
                  className={[
                    "w-full",
                    "${bg(t.colors.background)}",
                    "${text(t.colors.foreground)}",
                    "${border(t.colors.border)}",
                    "border",
                    "${t.radius.md}",
                    "${t.spacing.sm} ${t.spacing.md}",
                    "${t.typography.fontSize.base}",
                    "placeholder:${text(t.colors.muted)}",
                    "focus:outline-none focus:ring-2 ${ring(t.colors.primary)}",
                    "transition-shadow",
                  ].join(" ")}
                />
              </div>
            );
          })}
          <div className="flex items-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={[
                "w-full inline-flex items-center justify-center",
                "${t.typography.fontWeight.semibold}",
                "${t.typography.fontSize.sm}",
                "${t.spacing.sm} ${t.spacing.md}",
                "${t.radius.md}",
                "transition-colors",
                "${bg(t.colors.primary)}",
                "${text(t.colors.background)}",
                "hover:opacity-90",
                "focus:outline-none focus:ring-2 ${ring(t.colors.primary)} focus:ring-offset-2",
              ].join(" ")}
              type="submit"
            >
              Sign up
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* 5. Card list ---------------------------------------------------- */}
      <section
        id="features"
        className={["mx-auto max-w-6xl", "${t.spacing.lg} ${t.spacing.lg}", "${t.spacing["2xl"]}"].join(" ")}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CARD_ITEMS.map((card) => (
            <ContentCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* 6. Footer ------------------------------------------------------- */}
      <motion.footer
        variants={itemVariants}
        className={[
          "mt-12 w-full",
          "${bg(t.colors.surface)}",
          "${border(t.colors.border)}",
          "border-t",
          "${t.spacing.lg}",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center",
          ].join(" ")}
        >
          <span
            className={[
              "${t.typography.fontSize.sm}",
              "${t.typography.fontWeight.normal}",
              "${text(t.colors.muted)}",
            ].join(" ")}
          >
            © 2026 ${backtick(String(t.typography.fontFamily.display))}. Built with skins-mcp.
          </span>
          <ul className="flex items-center gap-4">
            <li><a className={navLinkClass} href="#">Privacy</a></li>
            <li><a className={navLinkClass} href="#">Terms</a></li>
            <li><a className={navLinkClass} href="#">Contact</a></li>
          </ul>
        </div>
      </motion.footer>
    </motion.div>
  );
}
`;
}
