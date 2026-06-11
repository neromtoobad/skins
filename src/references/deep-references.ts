/**
 * src/references/deep-references.ts
 *
 * The curated, high-signal half of the reference library. Where
 * `motionsites-data.ts` holds 61 one-line summaries, these are *full
 * design blueprints* — palette + roles, type system, motion profile, a
 * section-by-section breakdown, signature techniques, and the one thing
 * that makes each distinctive. `generate_brief` prefers a strong match
 * here over a motionsites summary, so the vibe path produces award-grade
 * output without a reference URL.
 *
 * Grow this list to grow the product's moat. See docs for the extraction
 * recipe (screenshot a great site → structured spec → new entry here).
 */

export interface RefSection {
  /** Section name, e.g. "Hero", "Bento features". */
  name: string;
  /** Layout + key elements + motion in one or two punchy sentences. */
  detail: string;
}

export interface DeepReference {
  id: string;
  name: string;
  category: string;
  /** Lowercase fragments used to match a free-form vibe. */
  keywords: string[];
  /** One-line essence of the look. */
  summary: string;
  theme: "dark" | "light";
  palette: {
    background: string;
    surface: string;
    foreground: string;
    primary: string;
    accent: string;
    hexes: string[];
  };
  fonts: { display: string; body: string; mono: string; note: string };
  motion: { style: string; beats: string[] };
  /** Section-by-section blueprint. */
  sections: RefSection[];
  /** Technique ids from the brief-engine toolkit. */
  techniques: string[];
  /** The single distinctive move that defines this design. */
  signature: string;
}

export const DEEP_REFERENCES: DeepReference[] = [
  {
    id: "apex-saas-dark",
    name: "Apex — Dark AI SaaS",
    category: "SaaS / AI",
    keywords: ["saas", "ai", "dark", "glass", "glassmorphism", "startup", "b2b", "platform", "dashboard", "tech", "software", "agent"],
    summary: "Near-black, glassy, glowing — the modern AI-startup hero with a floating navbar and a gradient-bordered CTA.",
    theme: "dark",
    palette: { background: "#070612", surface: "#0e0c1d", foreground: "#f5f5fa", primary: "#7c5cff", accent: "#22d3ee", hexes: ["#070612", "#7c5cff", "#22d3ee", "#a78bfa", "#f5f5fa"] },
    fonts: { display: "Space Grotesk", body: "Inter", mono: "JetBrains Mono", note: "Tight, techy display; high-legibility body; mono for metrics/code." },
    motion: { style: "snappy", beats: ["blur-in", "stagger", "glow-pulse", "marquee"] },
    sections: [
      { name: "Floating glass navbar", detail: "Pill-shaped, backdrop-blur, semi-transparent, condenses on scroll; gradient-bordered 'Get started' CTA." },
      { name: "Hero", detail: "Pill badge with a sparkle icon, a 3-line split-text heading that blur-staggers in (y:40, 0.08s delay), dual CTA, faint grid + radial glow behind." },
      { name: "Logo marquee", detail: "Infinite 20s linear 'trusted by' logo parade, greyscale → color on hover, edge-faded." },
      { name: "Bento feature grid", detail: "Asymmetric bento cards with glass surfaces, hover lift + glow, a looping product mock in the largest tile." },
      { name: "Metrics band", detail: "3–4 big count-up stats in mono, divider lines, a soft gradient underglow." },
      { name: "CTA + footer", detail: "Full-width gradient CTA with animated border, generous footer with grouped links." },
    ],
    techniques: ["glass-nav-condense", "gradient-shimmer-text", "cursor-spotlight", "intersection-reveal", "infinite-marquee", "count-up", "micro-interactions", "texture-overlays"],
    signature: "Liquid-glass surfaces over a near-black field with one electric accent — restraint + glow.",
  },
  {
    id: "broadcast-sports",
    name: "Broadcast — Bold Sports",
    category: "Sports / Fantasy",
    keywords: ["sports", "football", "soccer", "fantasy", "broadcast", "stadium", "league", "match", "team", "gaming", "esports", "tournament", "world cup"],
    summary: "Stadium-grade drama: a 3D pitch, gold-shimmer headline, holographic player cards, live tickers.",
    theme: "dark",
    palette: { background: "#05080a", surface: "#0e171c", foreground: "#f3f7f5", primary: "#19c463", accent: "#f5c542", hexes: ["#05080a", "#0c7a39", "#19c463", "#f5c542", "#f3f7f5"] },
    fonts: { display: "Anton", body: "Inter", mono: "Barlow Condensed", note: "Condensed broadcast display (Anton/Bebas), Barlow for stat labels." },
    motion: { style: "snappy", beats: ["count-up", "draw-in", "pulse", "marquee", "tilt"] },
    sections: [
      { name: "Hero pitch", detail: "A real 3D perspective pitch (rotateX) receding to a horizon, floodlight beams, drifting sparks; a gold metallic-shimmer headline with mouse parallax." },
      { name: "Live ticker", detail: "Broadcast lower-third marquee of nations/scores, a pulsing LIVE badge." },
      { name: "Squad / pitch builder", detail: "Top-down pitch with glowing player tokens, formation lines that draw themselves in (SVG stroke), captain armband, hover lift." },
      { name: "Holo scout cards", detail: "FUT/Panini-style cards with cursor-following holographic foil (mix-blend color-dodge) + 3D tilt, count-up stats, gold tier for top picks." },
      { name: "Leaderboard", detail: "Table with rank medals, your row gold-glowing, count-up totals, trend arrows, sparklines." },
      { name: "Prizes", detail: "Tilt cards, animated gold sweep on the champion tier, a generated trophy render." },
    ],
    techniques: ["3d-perspective-floor", "gradient-shimmer-text", "holo-foil-tilt", "draw-in-stroke", "count-up", "infinite-marquee", "mouse-parallax", "micro-interactions"],
    signature: "A genuine 3D pitch + holographic trading-card cards — it feels like a broadcast, not a webpage.",
  },
  {
    id: "editorial-3d-portfolio",
    name: "Studio — 3D Creator Portfolio",
    category: "Portfolio",
    keywords: ["portfolio", "3d", "creator", "designer", "studio", "personal", "freelance", "artist", "showreel", "creative", "motion", "cgi"],
    summary: "Huge lowercase type, a magnetic portrait, a scroll-driven image marquee, sticky-stacking project cards.",
    theme: "dark",
    palette: { background: "#0c0c0c", surface: "#141414", foreground: "#d7e2ea", primary: "#bbccd7", accent: "#b600a8", hexes: ["#0c0c0c", "#d7e2ea", "#bbccd7", "#b600a8", "#7621b0"] },
    fonts: { display: "Kanit", body: "Kanit", mono: "Space Mono", note: "One heavy variable display (Kanit/Syne) at 14–18vw; gradient-clip on the name." },
    motion: { style: "cinematic / scroll-driven", beats: ["fade-up", "magnetic", "scroll-marquee", "char-reveal", "sticky-stack"] },
    sections: [
      { name: "Hero", detail: "Massive lowercase 'hi, i'm ___' at 16vw with a gradient text-clip; a center portrait wrapped in a magnetic (cursor-following) effect; tiny uppercase nav + contact pill." },
      { name: "Scroll marquee", detail: "Two rows of project thumbnails that scroll opposite directions driven by scroll position (translateX), rounded tiles, willChange transform." },
      { name: "About", detail: "Giant 'about me' headline; a paragraph that reveals character-by-character keyed to scroll; floating 3D decorative objects in the corners." },
      { name: "Services", detail: "Numbered list (01–05) on a white inset section with rounded-top corners, big numbers, hairline dividers, staggered fade-in." },
      { name: "Projects", detail: "Sticky-stacking cards that scale down as you scroll past (useScroll/useTransform), each a 2-column image grid with heavy border-radius." },
    ],
    techniques: ["magnetic-hover", "character-reveal", "sticky-stack-cards", "infinite-marquee", "gradient-shimmer-text", "intersection-reveal", "cursor-spotlight"],
    signature: "Type-as-hero at absurd scale + a magnetic portrait + scroll-reactive image rows.",
  },
  {
    id: "luxe-editorial",
    name: "Maison — Luxury Editorial",
    category: "Luxury / Fashion",
    keywords: ["luxury", "fashion", "editorial", "elegant", "premium", "jewelry", "beauty", "magazine", "minimal", "serif", "high-end", "boutique"],
    summary: "Whitespace, a big serif, full-bleed imagery, slow cinematic reveals — quiet luxury.",
    theme: "light",
    palette: { background: "#f7f4ef", surface: "#ffffff", foreground: "#14110e", primary: "#14110e", accent: "#9a7b4f", hexes: ["#f7f4ef", "#ffffff", "#14110e", "#9a7b4f", "#cbb89a"] },
    fonts: { display: "Cormorant Garamond", body: "Inter", mono: "Inter", note: "High-contrast serif display (Cormorant/Playfair) at large size; restrained sans body, wide tracking." },
    motion: { style: "slow / cinematic", beats: ["slow-fade", "image-reveal", "parallax", "line-draw"] },
    sections: [
      { name: "Hero", detail: "Full-bleed editorial image with a thin gradient scrim; an oversized serif headline bottom-left, lots of negative space, a single understated link." },
      { name: "Manifesto", detail: "Centered serif paragraph at generous leading, words fading up slowly on scroll; a hairline rule above and below." },
      { name: "Collection grid", detail: "2–3 column product/imagery grid with hover image-swap and a subtle zoom; captions in small-caps tracked-out sans." },
      { name: "Feature split", detail: "50/50 image + text, image parallax on scroll, a thin animated underline on the CTA." },
      { name: "Footer", detail: "Minimal, centered, large serif wordmark, a single newsletter field." },
    ],
    techniques: ["intersection-reveal", "character-reveal", "mouse-parallax", "micro-interactions", "texture-overlays"],
    signature: "A high-contrast serif at scale + full-bleed imagery + slowness. The restraint is the luxury.",
  },
  {
    id: "fintech-dashboard",
    name: "Ledger — Fintech / Data",
    category: "Fintech",
    keywords: ["fintech", "finance", "payments", "dashboard", "data", "analytics", "banking", "invoice", "crypto wallet", "trading", "metrics", "money"],
    summary: "Crisp, dense, trustworthy: animated counters, mini charts, a product dashboard mock front and center.",
    theme: "dark",
    palette: { background: "#0b1020", surface: "#121a30", foreground: "#eaf0ff", primary: "#3b82f6", accent: "#10b981", hexes: ["#0b1020", "#3b82f6", "#10b981", "#60a5fa", "#eaf0ff"] },
    fonts: { display: "Plus Jakarta Sans", body: "Inter", mono: "JetBrains Mono", note: "Confident geometric sans display; mono for all numbers/values." },
    motion: { style: "snappy", beats: ["count-up", "chart-draw", "slide", "reveal"] },
    sections: [
      { name: "Hero split", detail: "Copy left, an animated product dashboard mock right (cards, a line chart that draws in, a balance that counts up); blue→green positive-metric accent." },
      { name: "Trust band", detail: "Compliance/logos row, small, quiet, edge-faded." },
      { name: "Feature cards", detail: "3-up cards with line-icon, hover border-glow, each with a tiny live mini-chart." },
      { name: "Metrics", detail: "Big count-up KPIs in mono with +/- deltas in green/red, divider lines." },
      { name: "Security section", detail: "Dark panel, a draw-in lock/shield SVG, bullet guarantees." },
      { name: "CTA", detail: "Clean gradient CTA, dual buttons, fine-print reassurance." },
    ],
    techniques: ["count-up", "draw-in-stroke", "intersection-reveal", "micro-interactions", "glass-nav-condense", "cursor-spotlight"],
    signature: "Numbers that count up + charts that draw themselves in — motion that signals 'live data', not decoration.",
  },
  {
    id: "web3-neon",
    name: "Nebula — Web3 / Neon",
    category: "Web3 / Crypto",
    keywords: ["web3", "crypto", "nft", "neon", "cyberpunk", "blockchain", "dao", "token", "mint", "defi", "metaverse", "futuristic"],
    summary: "Deep space-black, dual-neon (cyan/magenta), orbiting 3D objects, glow everywhere.",
    theme: "dark",
    palette: { background: "#05030f", surface: "#0d0a1f", foreground: "#eef2ff", primary: "#00e5ff", accent: "#ff2bd6", hexes: ["#05030f", "#00e5ff", "#ff2bd6", "#7c3aed", "#eef2ff"] },
    fonts: { display: "Orbitron", body: "Space Grotesk", mono: "Space Mono", note: "Techno display (Orbitron/Chakra), geometric body; uppercase, wide tracking." },
    motion: { style: "snappy", beats: ["neon-glow", "orbit", "pulse", "scan", "float"] },
    sections: [
      { name: "Hero", detail: "Rotating 3D token/orb (or a spline/three.js object), neon glow text with a flicker, scanline overlay, a pulsing mint CTA." },
      { name: "Stats", detail: "Glowing count-up stats (holders, volume, floor) on glass tiles with neon borders." },
      { name: "Roadmap / orbit", detail: "Orbiting nodes around a center, connectors that draw in, hover to reveal phase detail." },
      { name: "Collection", detail: "Grid of items with holographic-foil hover tilt; rarity color-coded borders." },
      { name: "Join / footer", detail: "Discord/X CTA, animated gradient border, neon wordmark." },
    ],
    techniques: ["cursor-spotlight", "gradient-shimmer-text", "holo-foil-tilt", "mouse-parallax", "count-up", "draw-in-stroke", "micro-interactions", "texture-overlays"],
    signature: "Dual-neon glow + an orbiting 3D object — maximalist, but anchored on pure black.",
  },
  {
    id: "kinetic-agency",
    name: "Kinetik — Creative Agency",
    category: "Agency / Studio",
    keywords: ["agency", "studio", "creative", "marketing", "brand", "design studio", "production", "kinetic", "brutalist", "bold", "video"],
    summary: "Loud kinetic type, marquees, hover-reveal work grid — confident and a little brutalist.",
    theme: "dark",
    palette: { background: "#0a0a0a", surface: "#141414", foreground: "#ffffff", primary: "#ff5c00", accent: "#ffffff", hexes: ["#0a0a0a", "#ff5c00", "#ffffff", "#a3a3a3", "#1a1a1a"] },
    fonts: { display: "Syne", body: "Inter", mono: "Space Mono", note: "Expressive display (Syne/Archivo Black/Bebas), uppercase, super tight leading." },
    motion: { style: "snappy", beats: ["word-stagger", "marquee", "hover-reveal", "slide"] },
    sections: [
      { name: "Hero", detail: "Screen-filling uppercase statement that staggers in word-by-word; an oversized scrolling marquee strip ('WE MAKE ___') beneath." },
      { name: "Work grid", detail: "Dense project grid where hovering a row reveals a floating preview image that follows the cursor; client/year metadata in mono." },
      { name: "Services marquee", detail: "Rotating list of capabilities as a horizontal ticker; numbers and arrows." },
      { name: "About", detail: "Big claim + a client logo marquee; a 'showreel' play button with magnetic hover." },
      { name: "Contact", detail: "Giant email link with an animated underline, footer ticker." },
    ],
    techniques: ["infinite-marquee", "magnetic-hover", "character-reveal", "intersection-reveal", "micro-interactions", "cursor-spotlight"],
    signature: "Type that moves — word-stagger headlines + marquees + a cursor-following work preview.",
  },
  {
    id: "devtool-terminal",
    name: "Forge — Developer Tool",
    category: "Developer Tool",
    keywords: ["developer", "devtool", "cli", "api", "open source", "terminal", "code", "infra", "deploy", "framework", "sdk", "docs"],
    summary: "GitHub-dark, mono accents, a typewriter code block, syntax-colored snippets — built for engineers.",
    theme: "dark",
    palette: { background: "#0d1117", surface: "#161b22", foreground: "#e6edf3", primary: "#58a6ff", accent: "#3fb950", hexes: ["#0d1117", "#58a6ff", "#3fb950", "#bc8cff", "#e6edf3"] },
    fonts: { display: "Inter", body: "Inter", mono: "JetBrains Mono", note: "Inter for prose; mono carries the personality (headings can be mono too)." },
    motion: { style: "snappy", beats: ["typewriter", "reveal", "slide", "cursor-blink"] },
    sections: [
      { name: "Hero", detail: "Copy left, a realistic terminal/editor card right with a typewriter animation running a real command + syntax-highlighted output; an `npm i` copy-button." },
      { name: "Install band", detail: "One-line install in a mono pill with a click-to-copy + 'copied' micro-interaction." },
      { name: "Feature rows", detail: "Alternating code-left/text-right rows, each code block fades+slides in; line numbers, a blinking caret." },
      { name: "Logos", detail: "'Used by' grid, quiet, monochrome." },
      { name: "Docs CTA", detail: "Two cards: Quickstart and API reference, hover border-glow." },
    ],
    techniques: ["intersection-reveal", "micro-interactions", "draw-in-stroke", "cursor-spotlight", "glass-nav-condense"],
    signature: "A live, syntax-highlighted typewriter terminal as the hero subject — credibility through real code.",
  },
  {
    id: "cosmic-space",
    name: "Voyager — Cosmic / Space",
    category: "Space / Hero",
    keywords: ["space", "cosmic", "stars", "galaxy", "astronomy", "rocket", "planet", "exploration", "sci-fi", "universe", "nebula", "orbit"],
    summary: "Deep-space black, a twinkling parallax star-field, orbiting planets, glowing accents.",
    theme: "dark",
    palette: { background: "#020209", surface: "#0a0a1a", foreground: "#eef2ff", primary: "#7c5cff", accent: "#a5b4fc", hexes: ["#020209", "#7c5cff", "#a5b4fc", "#22d3ee", "#eef2ff"] },
    fonts: { display: "Orbitron", body: "Inter", mono: "Space Mono", note: "Space-grade display (Orbitron), clean body; airy tracking." },
    motion: { style: "cinematic / scroll-driven", beats: ["twinkle", "parallax", "orbit", "float", "glow"] },
    sections: [
      { name: "Hero", detail: "Multi-layer parallax star-field (3 depths) reacting to mouse, a glowing planet/orb floating, an Orbitron headline, soft nebula gradients." },
      { name: "Mission stats", detail: "Count-up figures (distance, missions, crew) on translucent tiles." },
      { name: "Timeline / orbit", detail: "An orbital path with milestone nodes that draw in; hover to expand." },
      { name: "Gallery", detail: "Full-bleed cosmic imagery with slow parallax and reveal." },
      { name: "CTA", detail: "'Begin the voyage' glowing button, twinkling particles, footer." },
    ],
    techniques: ["mouse-parallax", "cursor-spotlight", "count-up", "draw-in-stroke", "intersection-reveal", "gradient-shimmer-text", "texture-overlays"],
    signature: "A genuine multi-depth parallax star-field + a floating planet — depth you feel as you move the mouse.",
  },
  {
    id: "organic-wellness",
    name: "Bloom — Wellness / Organic",
    category: "Health / Wellness",
    keywords: ["wellness", "health", "organic", "natural", "skincare", "yoga", "calm", "mindful", "botanical", "spa", "food", "sustainable"],
    summary: "Warm off-white, sage + clay, a friendly serif, gentle blooming motion — calm and human.",
    theme: "light",
    palette: { background: "#f6f3ec", surface: "#ffffff", foreground: "#23271f", primary: "#5a7d4f", accent: "#d98a5b", hexes: ["#f6f3ec", "#5a7d4f", "#d98a5b", "#9cb38b", "#23271f"] },
    fonts: { display: "Fraunces", body: "Inter", mono: "Inter", note: "Soft optical serif (Fraunces) with a friendly body; generous rounding." },
    motion: { style: "smooth", beats: ["bloom", "soft-fade", "float", "reveal"] },
    sections: [
      { name: "Hero", detail: "Rounded full-bleed lifestyle image, a warm serif headline, an organic blob shape drifting behind, a pill CTA; soft entrance." },
      { name: "Benefits", detail: "3 rounded cards with line illustrations that gently float; soft shadows, pastel backgrounds." },
      { name: "Process", detail: "Numbered steps connected by a hand-drawn line that draws in on scroll." },
      { name: "Testimonials", detail: "Soft cards, rounded avatars, a calm auto-advancing slider." },
      { name: "CTA / footer", detail: "Warm gradient band, rounded newsletter field, botanical motif." },
    ],
    techniques: ["intersection-reveal", "draw-in-stroke", "micro-interactions", "magnetic-hover", "texture-overlays"],
    signature: "Rounded everything + warm earthy palette + gentle floating shapes — it breathes.",
  },
];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function searchDeepReferences(query: string): Array<DeepReference & { score: number }> {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  const scored = DEEP_REFERENCES.map((ref) => {
    let score = 0;
    const name = ref.name.toLowerCase();
    const cat = ref.category.toLowerCase();
    const summary = ref.summary.toLowerCase();
    for (const w of words) {
      if (ref.keywords.some((k) => k === w)) score += 3;
      else if (ref.keywords.some((k) => k.includes(w) || w.includes(k))) score += 2;
      if (cat.includes(w)) score += 2;
      if (name.includes(w)) score += 2;
      if (summary.includes(w)) score += 1;
    }
    return { ...ref, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
