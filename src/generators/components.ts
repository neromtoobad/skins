/**
 * src/generators/components.ts — TSX component generation for skins-mcp.
 *
 * Exports `generateComponents(tokens)` which returns a record of five
 * component source strings (`Button`, `Card`, `Input`, `Navbar`,
 * `StatCard`). Each string is a complete, valid TypeScript React
 * component source. Every component:
 *
 *   - imports `motion` (and only `motion`) from `framer-motion`
 *   - uses only real Tailwind v3.4+ utility classes
 *   - animates entrance using a `variants` object that references
 *     `tokens.motion.durationBase` and `tokens.motion.easeOut`
 *
 * The variant strings are built with a tiny JS template layer so the
 * output is human-readable and easy to debug. No template-engine
 * dependency — the trade-off is more verbose code, but the output is
 * exactly the source a developer would write by hand.
 */
import type { DesignTokens } from "../types";

// ---------------------------------------------------------------------------
// Component name union
// ---------------------------------------------------------------------------

/** The five components this module generates. */
export type ComponentName = "Button" | "Card" | "Input" | "Navbar" | "StatCard";

/** The full record shape returned by `generateComponents`. */
export type ComponentBundle = Record<ComponentName, string>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Quote a string for safe interpolation into a TSX literal. We use
 * double-quotes everywhere in the generated source (matches the
 * rest of the project). Escapes backslashes and embedded quotes.
 */
function q(s: string): string {
  return JSON.stringify(s);
}

/**
 * Convert a Tailwind color name like `"fuchsia-500"` into the matching
 * class fragments used in the generated source. The mapping is intentionally
 * conservative — the components only need `bg-*`, `text-*`, `border-*`,
 * `ring-*`, and `from-*`/`to-*` variants. Unknown role names (e.g. a
 * future `textOnPrimary`) fall back to `text-white`.
 */
function bg(name: string): string {
  return `bg-${name}`;
}
function text(name: string): string {
  return `text-${name}`;
}
function border(name: string): string {
  return `border-${name}`;
}
function ring(name: string): string {
  return `ring-${name}`;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

function buildButton(t: DesignTokens): string {
  // Reusable variants for the entrance animation. Referenced by every
  // component below so the design system moves as one.
  return `/**
 * Button — primary interactive element.
 *
 * Variants: \`primary\`, \`secondary\`, \`ghost\`. Entrance animation is
 * driven by framer-motion's parent→child variant propagation: the parent
 * must set \`initial="hidden"\` and \`animate="visible"\` on its own
 * \`motion\` element, and the timing values are pulled from
 * \`tokens.motion\` at generation time.
 */
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  children?: React.ReactNode;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

const variantClass: Record<ButtonVariant, string> = {
  primary: \`${bg(t.colors.primary)} ${text(t.colors.background)} hover:opacity-90\`,
  secondary: \`${bg(t.colors.secondary)} ${text(t.colors.foreground)} hover:opacity-90\`,
  ghost: \`bg-transparent ${text(t.colors.foreground)} ${border(t.colors.border)} hover:${bg(t.colors.surface)}\`,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", className = "", children, ...rest },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: ${t.motion.durationBase}, ease: ${q(t.motion.easeOut)} }}
        className={[
          "inline-flex items-center justify-center",
          "${t.typography.fontWeight.semibold}",
          "${t.typography.fontSize.sm}",
          "${t.spacing.sm} ${t.spacing.md}",
          "${t.radius.md}",
          "transition-colors",
          "focus:outline-none focus:ring-2 ${ring(t.colors.primary)} focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClass[variant],
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);

export default Button;
`;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function buildCard(t: DesignTokens): string {
  return `/**
 * Card — content surface with optional accent bar.
 *
 * Use \`accent\` to draw a thin vertical bar in the brand color; omit it
 * for a neutral surface. Entrance animation follows the same
 * \`hidden → visible\` variant contract as Button.
 */
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export type CardAccent = "primary" | "secondary" | "accent" | "none";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "title"> {
  /** Optional heading rendered above the children. */
  title?: React.ReactNode;
  accent?: CardAccent;
  children?: React.ReactNode;
}

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

const accentBar: Record<Exclude<CardAccent, "none">, string> = {
  primary: "${bg(t.colors.primary)}",
  secondary: "${bg(t.colors.secondary)}",
  accent: "${bg(t.colors.accent)}",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { title, accent = "none", className = "", children, ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
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
        className,
      ].join(" ")}
      {...rest}
    >
      {accent !== "none" && (
        <span
          aria-hidden="true"
          className={["absolute inset-y-0 left-0 w-1", accentBar[accent]].join(" ")}
        />
      )}
      {title !== undefined && (
        <h3 className={["${t.typography.fontWeight.semibold}", "${t.typography.fontSize.lg}", "mb-2"].join(" ")}>
          {title}
        </h3>
      )}
      {children}
    </motion.div>
  );
});

export default Card;
`;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function buildInput(t: DesignTokens): string {
  return `/**
 * Input — labeled text input with focus ring.
 *
 * Wraps a native \`<input>\` so all standard props (\`type\`, \`value\`,
 * \`onChange\`, …) pass through. The label is rendered above the field
 * and is clickable. The outer wrapper is animated; the native input
 * itself is rendered as a regular \`<input>\` (style props don't pass
 * through, which keeps framer-motion's \`MotionStyle\` from clashing
 * with React's \`CSSProperties\`).
 */
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export interface InputProps extends HTMLMotionProps<"div"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** Type forwarded to the native <input> element. */
  type?: React.HTMLInputTypeAttribute;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  autoComplete?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  id?: string;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    className = "",
    id,
    type = "text",
    value,
    defaultValue,
    placeholder,
    disabled,
    readOnly,
    name,
    autoComplete,
    onChange,
    onFocus,
    onBlur,
  },
  ref,
) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-1">
      {label !== undefined && (
        <label
          htmlFor={inputId}
          className={[
            "${t.typography.fontWeight.medium}",
            "${t.typography.fontSize.sm}",
            "${text(t.colors.foreground)}",
          ].join(" ")}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        name={name}
        autoComplete={autoComplete}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
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
          className,
        ].join(" ")}
      />
      {hint !== undefined && (
        <span className={["${t.typography.fontSize.xs}", "${text(t.colors.muted)}"].join(" ")}>
          {hint}
        </span>
      )}
    </motion.div>
  );
});

export default Input;
`;
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function buildNavbar(t: DesignTokens): string {
  return `/**
 * Navbar — top-of-page navigation.
 *
 * The component renders a sticky bar with the brand on the left and a
 * horizontal list of links on the right. The whole bar fades + slides
 * in on mount; children propagate the \`hidden → visible\` variant.
 */
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export interface NavbarLink {
  label: string;
  href: string;
}

export interface NavbarProps extends HTMLMotionProps<"nav"> {
  brand?: React.ReactNode;
  links?: NavbarLink[];
}

const barVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

const linkVariants: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

export const Navbar: React.FC<NavbarProps> = function Navbar({
  brand = "Brand",
  links = [],
  className = "",
  ...rest
}) {
  return (
    <motion.nav
      variants={barVariants}
      initial="hidden"
      animate="visible"
      className={[
        "sticky top-0 z-40 w-full",
        "${bg(t.colors.surface)}",
        "${border(t.colors.border)}",
        "border-b",
        "${t.shadows.sm}",
        className,
      ].join(" ")}
      {...rest}
    >
      <div className={["mx-auto flex max-w-6xl items-center justify-between", "${t.spacing.md} ${t.spacing.lg}"].join(" ")}>
        <motion.span
          variants={linkVariants}
          className={[
            "${t.typography.fontWeight.bold}",
            "${t.typography.fontSize.lg}",
            "${text(t.colors.foreground)}",
          ].join(" ")}
        >
          {brand}
        </motion.span>
        <ul className="flex items-center gap-4">
          {links.map((link) => (
            <motion.li key={link.href} variants={linkVariants}>
              <a
                href={link.href}
                className={[
                  "${t.typography.fontSize.sm}",
                  "${t.typography.fontWeight.medium}",
                  "${text(t.colors.muted)}",
                  "hover:${text(t.colors.foreground)}",
                  "transition-colors",
                ].join(" ")}
              >
                {link.label}
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.nav>
  );
};

export default Navbar;
`;
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function buildStatCard(t: DesignTokens): string {
  return `/**
 * StatCard — single-metric dashboard tile.
 *
 * Displays a large value, a label, and an optional trend delta. The
 * trend chip color follows \`tokens.colors.success\` / \`danger\`.
 */
import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export type StatTrend = "up" | "down" | "flat";

export interface StatCardProps extends HTMLMotionProps<"div"> {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  trend?: StatTrend;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: ${t.motion.durationBase},
      ease: ${q(t.motion.easeOut)},
    },
  },
};

const trendColor: Record<StatTrend, string> = {
  up: "${text(t.colors.success)}",
  down: "${text(t.colors.danger)}",
  flat: "${text(t.colors.muted)}",
};

const trendGlyph: Record<StatTrend, string> = {
  up: "▲",
  down: "▼",
  flat: "■",
};

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  function StatCard(
    { label, value, delta, trend = "flat", className = "", ...rest },
    ref,
  ) {
    return (
      <motion.div
        ref={ref}
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
          className,
        ].join(" ")}
        {...rest}
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
        {delta !== undefined && (
          <span
            className={[
              "inline-flex items-center gap-1",
              "${t.typography.fontSize.xs}",
              "${t.typography.fontWeight.medium}",
              trendColor[trend],
            ].join(" ")}
          >
            <span aria-hidden="true">{trendGlyph[trend]}</span>
            {delta}
          </span>
        )}
      </motion.div>
    );
  },
);

export default StatCard;
`;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate the five canonical components for the supplied `DesignTokens`.
 *
 * Each value in the returned record is a complete, valid TypeScript
 * React component source — paste it into a `.tsx` file and it compiles
 * with the project's existing \`tsc --noEmit --strict\` settings. The
 * motion timing in every component is derived from \`tokens.motion\` so
 * changing the preset automatically retunes the animation feel.
 *
 * @example
 *   const tokens = await generateTokens({ vibe: "neon cyberpunk" });
 *   const files  = generateComponents(tokens);
 *   // files.Button -> "import * as React from ..."
 */
export function generateComponents(tokens: DesignTokens): ComponentBundle {
  return {
    Button: buildButton(tokens),
    Card: buildCard(tokens),
    Input: buildInput(tokens),
    Navbar: buildNavbar(tokens),
    StatCard: buildStatCard(tokens),
  };
}
