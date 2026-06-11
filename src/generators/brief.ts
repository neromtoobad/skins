/**
 * src/generators/brief.ts — the "brief engine".
 *
 * Turns a matched motionsites.ai design direction into a rich BUILD
 * DIRECTIVE for the consuming model (Claude / Codex) to implement —
 * instead of reducing it to ~10 tokens + 5 canned components.
 *
 * The returned `brief` string IS a prompt: when an MCP tool returns it,
 * it lands in the model's context as an instruction to build a complete,
 * production-grade, heavily-animated page. The model is the engine; this
 * module is the curator + quality bar.
 */
import { searchPrompts } from "../scrapers/motionsites";
import type { MotionsitesPrompt } from "../scrapers/motionsites-data";
import { extractTokensFromPrompt } from "../scrapers/motionsites-token-extractor";

// ---------------------------------------------------------------------------
// Public result shape
// ---------------------------------------------------------------------------

export interface BriefResult {
  source: {
    name: string;
    category: string;
    type: string;
    promptUrl: string;
    animationKeywords: string[];
    score: number;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    foreground: string;
    sourceHex: string[];
    fonts: { display: string; body: string; mono: string };
    motionStyle: string;
    durations: { base: number; fast: number; slow: number; stagger: number };
  };
  brandColors: string[];
  techniques: string[];
  brief: string;
}

// ---------------------------------------------------------------------------
// Technique toolkit — the named tricks a model can reach for.
// `tags` map to the animation-keyword vocabulary in motionsites-data so the
// brief can recommend techniques that fit the matched design.
// ---------------------------------------------------------------------------

interface Technique {
  id: string;
  blurb: string;
  tags: string[];
}

const TECHNIQUES: Technique[] = [
  { id: "cinematic-hero", blurb: "Full-viewport hero with real depth — layered radial gradients, a light bloom, vignette, and a focal subject. Never a flat centered headline.", tags: [] },
  { id: "3d-perspective-floor", blurb: "A surface (pitch / grid / dashboard plane) tilted with CSS `perspective` + `rotateX` receding to a horizon, masked to fade out. Great for sports, data, space themes.", tags: ["orbit", "parallax", "float"] },
  { id: "gradient-shimmer-text", blurb: "The headline as animated metallic/gradient text — `background-clip:text` + a moving `background-position` sweep.", tags: ["glow", "pulse", "bloom"] },
  { id: "mouse-parallax", blurb: "Hero layers (title, art, glow, floor) translate/rotate at different rates with the cursor via a rAF loop.", tags: ["float", "parallax", "orbit"] },
  { id: "cursor-spotlight", blurb: "A soft radial glow that follows the cursor across the page (fixed, pointer-events:none).", tags: ["glow", "pulse"] },
  { id: "holo-foil-tilt", blurb: "Cards with a cursor-following holographic foil sheen (`mix-blend-mode: color-dodge` over a rainbow gradient) + 3D tilt that tracks the pointer. The FIFA/Panini card effect.", tags: ["glow", "reveal", "pulse"] },
  { id: "infinite-marquee", blurb: "A broadcast-style ticker that scrolls forever (duplicated track + `translateX` keyframe), pausing on hover.", tags: ["marquee", "slide"] },
  { id: "intersection-reveal", blurb: "Scroll-triggered entrance — IntersectionObserver toggles fade+slide, with a small stagger between siblings.", tags: ["reveal", "fade", "slide", "stagger"] },
  { id: "count-up", blurb: "Numeric stats animate from 0 to their value on reveal (eased), with prefix/suffix support.", tags: ["counter"] },
  { id: "draw-in-stroke", blurb: "SVG lines/diagrams draw themselves in via `stroke-dasharray`/`stroke-dashoffset` on scroll. Formation lines, charts, connectors.", tags: ["scan", "reveal", "type", "chart"] },
  { id: "magnetic-hover", blurb: "Interactive elements pull toward the cursor when it's near (translate by distance/strength).", tags: ["float", "glow"] },
  { id: "character-reveal", blurb: "Body copy reveals character-by-character as it scrolls through the viewport (opacity 0.2→1 keyed to scroll progress).", tags: ["reveal", "stagger", "fade"] },
  { id: "sticky-stack-cards", blurb: "Cards stack and scale down as you scroll past them (sticky positioning + scroll-linked scale). Project/feature showcases.", tags: ["scroll", "parallax", "reveal"] },
  { id: "glass-nav-condense", blurb: "Nav starts transparent, then shrinks + frosts (backdrop-blur) once you scroll, with an animated active-link underline.", tags: ["fade", "slide"] },
  { id: "scroll-progress", blurb: "A thin gradient progress bar pinned to the top, scaleX driven by scroll position.", tags: [] },
  { id: "texture-overlays", blurb: "Subtle film grain (SVG feTurbulence) + vignette so flat dark sections feel premium, not empty.", tags: [] },
  { id: "micro-interactions", blurb: "Buttons with a shine sweep, press feedback, add→confirm state changes, hover lifts with shadow depth. Every interactive element reacts.", tags: ["pulse", "glow", "slide"] },
];

const BASE_TECHNIQUE_IDS = [
  "cinematic-hero",
  "gradient-shimmer-text",
  "cursor-spotlight",
  "intersection-reveal",
  "glass-nav-condense",
  "scroll-progress",
  "texture-overlays",
  "micro-interactions",
];

function recommendTechniques(prompt: MotionsitesPrompt): Technique[] {
  const kw = new Set(prompt.animationKeywords.map((k) => k.toLowerCase()));
  const picked = new Map<string, Technique>();
  for (const t of TECHNIQUES) {
    if (BASE_TECHNIQUE_IDS.includes(t.id)) picked.set(t.id, t);
    if (t.tags.some((tag) => kw.has(tag))) picked.set(t.id, t);
  }
  // Dense layouts benefit from count-up + marquee; comfortable ones from parallax.
  if (prompt.layoutDensity === "dense") {
    picked.set("count-up", TECHNIQUES.find((t) => t.id === "count-up")!);
  } else {
    picked.set("mouse-parallax", TECHNIQUES.find((t) => t.id === "mouse-parallax")!);
  }
  return [...picked.values()];
}

// ---------------------------------------------------------------------------
// Light brand-color hinting — if the user names colors in their query/target,
// surface them as the priority palette (they beat the matched design).
// ---------------------------------------------------------------------------

const COLOR_WORDS = [
  "gold", "green", "pitch green", "emerald", "lime", "teal", "cyan", "blue", "navy",
  "indigo", "violet", "purple", "magenta", "fuchsia", "pink", "rose", "red", "crimson",
  "orange", "amber", "yellow", "white", "black", "silver", "bronze", "neon", "pastel",
  "monochrome", "earth", "sage", "olive",
];

function detectBrandColors(text: string): string[] {
  const t = text.toLowerCase();
  const found = COLOR_WORDS.filter((c) => t.includes(c));
  // de-dupe overlaps like "green" + "pitch green"
  return found.filter((c, i) => !found.some((o, j) => j !== i && o.includes(c) && o !== c));
}

function motionStyleLabel(durationBase: number): string {
  if (durationBase <= 0.35) return "snappy";
  if (durationBase >= 0.75) return "slow / cinematic";
  return "smooth";
}

// ---------------------------------------------------------------------------
// Brief assembly
// ---------------------------------------------------------------------------

export function buildBrief(query: string, target?: string): BriefResult {
  const results = searchPrompts(query);
  const prompt = results[0];

  const ex = extractTokensFromPrompt(prompt);
  const colors = ex.colors!;
  const fonts = ex.typography!.fontFamily;
  const motion = ex.motion!;
  const motionStyle = motionStyleLabel(motion.durationBase);

  const recommended = recommendTechniques(prompt);
  const techIds = recommended.map((t) => t.id);

  const sourceHex = [...prompt.colors];
  const brandColors = detectBrandColors(`${query} ${target ?? ""}`);

  // ----- assemble the directive text (this is what the model reads) -----
  const lines: string[] = [];

  lines.push(`# DESIGN BRIEF — "${prompt.name}" direction (${prompt.category})`);
  lines.push("");
  lines.push(
    target
      ? `You are doing a **complete redesign** of the target below. Keep its real content and data; transform the presentation entirely. Do NOT ship a watered-down version.`
      : `You are building a **complete, production-grade page** from this direction. Do NOT ship a watered-down version.`,
  );
  if (target) {
    lines.push("");
    lines.push("## Target (the user's content)");
    lines.push(target.trim());
  }

  lines.push("");
  lines.push("## Design DNA (starting direction)");
  lines.push(`- **Vibe match:** ${prompt.name} — ${prompt.rawSpec}`);
  if (brandColors.length) {
    lines.push(
      `- **Brand colors the user asked for (these take PRIORITY over the match):** ${brandColors.join(", ")}`,
    );
  }
  lines.push(
    `- **Palette (Tailwind tiers, adapt freely):** primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}, background ${colors.background}, surface ${colors.surface}, text ${colors.foreground}` +
      (sourceHex.length ? ` · source hex: ${sourceHex.join(", ")}` : ""),
  );
  lines.push(`- **Type:** display \`${fonts.display}\`, body \`${fonts.body}\`, mono \`${fonts.mono}\` (Google Fonts).`);
  lines.push(
    `- **Motion:** ${motionStyle} — base ${motion.durationBase}s, fast ${motion.durationFast}s, slow ${motion.durationSlow}s, stagger ${motion.staggerChildren}s. Signature beats: ${prompt.animationKeywords.join(", ")}.`,
  );

  lines.push("");
  lines.push("## Build directive — BUILD THIS, do not simplify");
  lines.push("1. **Cinematic hero with depth.** Layered gradients/glow, a focal subject, and motion on load. Never a flat centered headline on a solid background.");
  lines.push("2. **Animate everything that earns it.** Scroll-reveal with stagger, count-ups on stats, hover micro-interactions on every interactive element, an animated headline. Motion should feel intentional, not decorative.");
  lines.push("3. **One cohesive token system.** Define CSS variables (or Tailwind theme) for color/space/type/motion up top and use them everywhere. No ad-hoc values.");
  lines.push("4. **Real depth & texture.** Use shadows, gradients, glass/blur, grain, and at least one standout 3D / parallax / holographic moment so it reads premium, not template.");
  lines.push("5. **Adapt to the actual content.** Every section must reflect the user's real data and domain — never generic Button/Card/Input filler.");
  lines.push("6. **Ship a complete page**, fully responsive, all sections wired, with working interactions (tabs, filters, modals where relevant).");

  lines.push("");
  lines.push("## Recommended techniques (pick what fits — don't force all)");
  for (const t of recommended) {
    lines.push(`- **${t.id}** — ${t.blurb}`);
  }

  lines.push("");
  lines.push("## Quality bar (anti-slop — reject your own output if it fails these)");
  lines.push("- No placeholder/Lorem text, no empty sections, no unstyled default elements.");
  lines.push("- No generic 5-component dump (Button/Card/Input/Navbar/StatCard). Build the *page*, not a kit.");
  lines.push("- Every section visually distinct; consistent rhythm and spacing; strong type hierarchy.");
  lines.push("- Animations are performant (transform/opacity, rAF-throttled, passive listeners) and respect `prefers-reduced-motion`.");
  lines.push("- If a choice would look 'basic', pick the more ambitious option.");

  lines.push("");
  lines.push("## Output");
  lines.push(
    "Default to a **single self-contained HTML file** (Google Fonts via CDN, vanilla JS, no build step) so it opens by double-click. If the user's project is React, emit **React + TypeScript + Tailwind + Framer Motion** components instead. Match whatever stack the target already uses.",
  );

  return {
    source: {
      name: prompt.name,
      category: prompt.category,
      type: prompt.type,
      promptUrl: prompt.promptUrl,
      animationKeywords: prompt.animationKeywords,
      score: results[0] ? (results[0] as MotionsitesPrompt & { score: number }).score : 0,
    },
    palette: {
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.accent,
      background: colors.background,
      surface: colors.surface,
      foreground: colors.foreground,
      sourceHex,
      fonts,
      motionStyle,
      durations: {
        base: motion.durationBase,
        fast: motion.durationFast,
        slow: motion.durationSlow,
        stagger: motion.staggerChildren,
      },
    },
    brandColors,
    techniques: techIds,
    brief: lines.join("\n"),
  };
}
