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
import type { SiteDNA } from "./../scrapers/site-dna";

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
  assets: AssetSlot[];
  brief: string;
}

/** One image the design needs, with a generation prompt + a free fallback. */
export interface AssetSlot {
  slot: string;
  purpose: string;
  ratio: string;
  genPrompt: string;
  fallback: string;
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
// Asset plan — the images the design needs. Each slot ships a generation
// prompt (for Higgsfield / any image tool the building agent has) plus a
// free-stock fallback keyword. skins-mcp never generates images itself.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "the", "for", "with", "and", "of", "to", "in", "on", "bold", "premium",
  "modern", "clean", "dark", "light", "page", "site", "website", "app", "ui", "design",
  "broadcast", "cinematic", "vibe", "style", "look",
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !COLOR_WORDS.includes(w))
    .filter((w, i, a) => a.indexOf(w) === i)
    .slice(0, 5);
}

function stock(kw: string[], ratio: string): string {
  const q = kw.length ? kw.join(",") : "abstract,texture";
  return `free stock — search Unsplash/Pexels for "${kw.join(" ") || "abstract"}" (or https://picsum.photos/seed/${q.replace(/[^a-z0-9]/g, "")}/1600/900 as a neutral ${ratio} placeholder)`;
}

function buildAssetPlan(
  query: string,
  target: string | undefined,
  paletteDesc: string,
  motionStyle: string,
): AssetSlot[] {
  const subject = keywords(`${query} ${target ?? ""}`);
  const subjectStr = subject.join(" ") || query;
  const style = `${paletteDesc}, ${motionStyle} mood, dramatic lighting, high detail, sharp focus, no text, no watermark`;

  const slots: AssetSlot[] = [
    {
      slot: "hero-key-visual",
      purpose: "The hero's focal subject / background — the first thing seen. Carries the whole vibe.",
      ratio: "16:9",
      genPrompt: `Cinematic hero key visual for ${subjectStr}: a striking central subject, depth, atmosphere, ${style}, 16:9`,
      fallback: stock(subject, "16:9"),
    },
    {
      slot: "ambient-texture",
      purpose: "A subtle full-bleed texture/gradient field behind dark sections so they don't read flat.",
      ratio: "16:9",
      genPrompt: `Abstract premium background texture inspired by ${subjectStr}: soft gradient, grain, bokeh light, ${paletteDesc}, very low contrast, no subject, 16:9`,
      fallback: stock(["abstract", ...subject.slice(0, 2)], "16:9"),
    },
    {
      slot: "feature-art",
      purpose: "1–3 supporting images for feature/showcase sections (mix angles).",
      ratio: "4:3",
      genPrompt: `Editorial showcase image for ${subjectStr}: dynamic composition, ${style}, 4:3`,
      fallback: stock(subject, "4:3"),
    },
  ];

  // People imagery only when the content implies it.
  if (/\b(player|people|team|profile|avatar|manager|leaderboard|member|user|portrait|creator|founder)\b/i.test(`${query} ${target ?? ""}`)) {
    slots.push({
      slot: "portrait-set",
      purpose: "Avatars / portraits for rosters, leaderboards, testimonials.",
      ratio: "1:1",
      genPrompt: `Studio portrait for ${subjectStr}: single subject, clean rim light, ${paletteDesc} backdrop, centered, 1:1`,
      fallback: `free portraits — https://i.pravatar.cc/240?img=N (N=1..70), or generate per person`,
    });
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Brief assembly
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared brief sections — used by both the vibe brief and the URL brief so
// the build directive / quality bar / image strategy stay identical.
// ---------------------------------------------------------------------------

function directiveLines(): string[] {
  return [
    "",
    "## Build directive — BUILD THIS, do not simplify",
    "1. **Cinematic hero with depth.** Layered gradients/glow, a focal subject, and motion on load. Never a flat centered headline on a solid background.",
    "2. **Animate everything that earns it.** Scroll-reveal with stagger, count-ups on stats, hover micro-interactions on every interactive element, an animated headline. Motion should feel intentional, not decorative.",
    "3. **One cohesive token system.** Define CSS variables (or Tailwind theme) for color/space/type/motion up top and use them everywhere. No ad-hoc values.",
    "4. **Real depth & texture.** Use shadows, gradients, glass/blur, grain, and at least one standout 3D / parallax / holographic moment so it reads premium, not template.",
    "5. **Adapt to the actual content.** Every section must reflect the user's real data and domain — never generic Button/Card/Input filler.",
    "6. **Ship a complete page**, fully responsive, all sections wired, with working interactions (tabs, filters, modals where relevant).",
  ];
}

function techniqueLines(recommended: Technique[]): string[] {
  return [
    "",
    "## Recommended techniques (pick what fits — don't force all)",
    ...recommended.map((t) => `- **${t.id}** — ${t.blurb}`),
  ];
}

function qualityBarLines(): string[] {
  return [
    "",
    "## Quality bar (anti-slop — reject your own output if it fails these)",
    "- No placeholder/Lorem text, no empty sections, no unstyled default elements.",
    "- No generic 5-component dump (Button/Card/Input/Navbar/StatCard). Build the *page*, not a kit.",
    "- Every section visually distinct; consistent rhythm and spacing; strong type hierarchy.",
    "- Animations are performant (transform/opacity, rAF-throttled, passive listeners) and respect `prefers-reduced-motion`.",
    "- If a choice would look 'basic', pick the more ambitious option.",
  ];
}

function imageSectionLines(assets: AssetSlot[]): string[] {
  const out: string[] = [
    "",
    "## Asset plan — REAL images (the biggest premium multiplier)",
    "Do NOT ship solid color blocks where a hero/feature image belongs. Generate the images below, then wire them in (object-cover, lazy-load, alt text, a gradient scrim over anything with text on top).",
  ];
  for (const a of assets) {
    out.push(`- **${a.slot}** (${a.ratio}) — ${a.purpose}`);
    out.push(`    - generate: \`${a.genPrompt}\``);
    out.push(`    - fallback: ${a.fallback}`);
  }
  out.push(
    "",
    "## Image strategy",
    "1. If you have an image-generation tool (e.g. **Higgsfield** `generate_image`, or any DALL·E/SD tool), GENERATE the assets above from their prompts — bespoke art beats stock and makes the result unique.",
    "2. If not, use the free-stock fallback keywords (Unsplash / Pexels), or `picsum.photos` for neutral placeholders.",
    "3. Never hotlink Pinterest/Google Images — those URLs rot and aren't licensed. Generated or properly-licensed stock only.",
    "4. Treat imagery as a design layer: duotone/overlay it to the palette, add grain, and let it bleed behind text with a gradient for contrast.",
  );
  return out;
}

function outputLines(): string[] {
  return [
    "",
    "## Output",
    "Default to a **single self-contained HTML file** (Google Fonts via CDN, vanilla JS, no build step) so it opens by double-click. If the user's project is React, emit **React + TypeScript + Tailwind + Framer Motion** components instead. Match whatever stack the target already uses.",
  ];
}

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

  const paletteDesc = brandColors.length
    ? `${brandColors.join(" + ")} palette`
    : `${colors.primary} / ${colors.accent} on ${colors.background}`;
  const assets = buildAssetPlan(query, target, paletteDesc, motionStyle);

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

  lines.push(...directiveLines());
  lines.push(...techniqueLines(recommended));
  lines.push(...qualityBarLines());
  lines.push(...imageSectionLines(assets));
  lines.push(...outputLines());

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
    assets,
    brief: lines.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// URL brief — reverse-engineer a real site's design DNA into a build brief.
// ---------------------------------------------------------------------------

/** Map detected libraries/features on a real site to our technique toolkit. */
const FEATURE_TO_TECH: Record<string, string[]> = {
  gradients: ["gradient-shimmer-text", "cinematic-hero"],
  glassmorphism: ["glass-nav-condense"],
  "transforms-3d": ["3d-perspective-floor", "mouse-parallax"],
  "three.js": ["3d-perspective-floor", "mouse-parallax"],
  spline: ["3d-perspective-floor"],
  "css-animations": ["intersection-reveal", "micro-interactions"],
  "framer-motion": ["intersection-reveal", "micro-interactions"],
  gsap: ["intersection-reveal", "draw-in-stroke", "sticky-stack-cards"],
  marquee: ["infinite-marquee"],
  "blend-modes": ["holo-foil-tilt"],
  "locomotive-scroll": ["character-reveal", "sticky-stack-cards"],
  aos: ["intersection-reveal"],
  lottie: ["micro-interactions"],
  video: ["cinematic-hero"],
  canvas: ["cinematic-hero", "mouse-parallax"],
  sticky: ["sticky-stack-cards"],
};

function techniquesForDNA(dna: SiteDNA): Technique[] {
  const ids = new Set<string>(BASE_TECHNIQUE_IDS);
  for (const sig of [...dna.libs, ...dna.features]) {
    for (const t of FEATURE_TO_TECH[sig] ?? []) ids.add(t);
  }
  return TECHNIQUES.filter((t) => ids.has(t.id));
}

function dnaMotionStyle(dna: SiteDNA): string {
  const heavy = ["gsap", "three.js", "spline", "framer-motion", "locomotive-scroll"];
  if (dna.libs.some((l) => heavy.includes(l)) || dna.features.includes("transforms-3d")) {
    return "cinematic / scroll-driven";
  }
  if (dna.features.includes("css-animations")) return "snappy";
  return "smooth";
}

/**
 * Build a design brief from a real site's extracted DNA. The palette,
 * fonts, motion, and recommended techniques all come from the actual
 * reference — so the model builds in *that site's* design language.
 */
export function buildBriefFromDNA(dna: SiteDNA): BriefResult {
  const recommended = techniquesForDNA(dna);
  const motionStyle = dnaMotionStyle(dna);
  const paletteDesc = `${dna.theme} theme, ${dna.roles.primary} / ${dna.roles.accent} on ${dna.roles.background}`;
  const subject = dna.title || dna.description || dna.url;
  const assets = buildAssetPlan(subject, dna.description || undefined, paletteDesc, motionStyle);

  const fontList = dna.fonts.length ? dna.fonts.join(", ") : "match the reference's type feel (infer a close Google Font)";

  const lines: string[] = [];
  lines.push(`# DESIGN BRIEF — built from a live reference: ${dna.url}`);
  lines.push("");
  lines.push(
    "Reverse-engineer this reference's **design language** and apply it to the user's content. " +
      "Match the feel, palette, type, motion, and structure — but build the user's own page with their data. " +
      "Credit the inspiration; never copy the site's text or images.",
  );

  lines.push("");
  lines.push("## Design DNA (extracted from the live site)");
  if (dna.title) lines.push(`- **Reference:** ${dna.title}`);
  lines.push(`- **Theme:** ${dna.theme}`);
  lines.push(
    `- **Palette (real hex from the page):** background ${dna.roles.background}, text ${dna.roles.foreground}, primary ${dna.roles.primary}, accent ${dna.roles.accent}` +
      (dna.colors.length ? ` · full set: ${dna.colors.join(", ")}` : ""),
  );
  lines.push(`- **Type:** ${fontList}.`);
  lines.push(`- **Corners / shape language:** ${dna.radiusStyle}.`);
  lines.push(`- **Density:** ${dna.density}.`);
  if (dna.libs.length) lines.push(`- **Detected stack:** ${dna.libs.join(", ")}.`);
  if (dna.features.length) lines.push(`- **Techniques in use on the reference:** ${dna.features.join(", ")}.`);
  lines.push(`- **Motion:** ${motionStyle}.`);

  lines.push(...directiveLines());
  lines.push(...techniqueLines(recommended));
  lines.push(...qualityBarLines());
  lines.push(...imageSectionLines(assets));
  lines.push(...outputLines());

  return {
    source: {
      name: dna.title || dna.url,
      category: "URL reference",
      type: "site",
      promptUrl: dna.url,
      animationKeywords: dna.features,
      score: 0,
    },
    palette: {
      primary: dna.roles.primary,
      secondary: dna.roles.accent,
      accent: dna.roles.accent,
      background: dna.roles.background,
      surface: dna.roles.background,
      foreground: dna.roles.foreground,
      sourceHex: dna.colors,
      fonts: {
        display: dna.fonts[0] ?? "Inter",
        body: dna.fonts[1] ?? dna.fonts[0] ?? "Inter",
        mono: "JetBrains Mono",
      },
      motionStyle,
      durations: { base: 0.5, fast: 0.25, slow: 0.9, stagger: 0.08 },
    },
    brandColors: dna.colors,
    techniques: recommended.map((t) => t.id),
    assets,
    brief: lines.join("\n"),
  };
}
