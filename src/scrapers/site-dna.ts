/**
 * src/scrapers/site-dna.ts
 *
 * Deep "design DNA" extraction from a real web page's HTML/CSS. This is
 * the engine behind `generate_brief_from_url`: point skins-mcp at any site
 * you love and it reverse-engineers the design language — palette + roles,
 * Google Fonts, animation libraries, glass/gradient/shadow usage, dark vs
 * light, radius style, structure — so the brief can tell the model to build
 * in that style. No network calls here; pass in already-fetched HTML.
 */
import * as cheerio from "cheerio";

type CheerioAPI = ReturnType<typeof cheerio.load>;

export interface SiteDNA {
  url: string;
  title: string;
  description: string;
  theme: "dark" | "light";
  colors: string[]; // frequency-ranked hex
  roles: { background: string; foreground: string; primary: string; accent: string };
  fonts: string[];
  googleFonts: string[];
  libs: string[];
  features: string[];
  radiusStyle: "sharp" | "rounded" | "pill";
  density: "dense" | "comfortable";
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function normHex(hex: string): string {
  let h = hex.toLowerCase();
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  else if (h.length === 9) h = h.slice(0, 7);
  return h;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function rankedHex(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(HEX_RE)) {
    const h = normHex(m[0]);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

// ---------------------------------------------------------------------------
// Library + feature detection
// ---------------------------------------------------------------------------

const LIB_SIGNATURES: Array<{ id: string; re: RegExp }> = [
  { id: "framer-motion", re: /framer-motion|framerusercontent|data-framer/i },
  { id: "gsap", re: /gsap|greensock|ScrollTrigger/i },
  { id: "three.js", re: /three(\.min)?\.js|three@|\bTHREE\b/i },
  { id: "spline", re: /spline\.design|@splinetool/i },
  { id: "lottie", re: /lottie|bodymovin/i },
  { id: "rive", re: /rive-js|@rive-app/i },
  { id: "swiper", re: /swiper(\.min)?\.(js|css)|swiper-bundle/i },
  { id: "locomotive-scroll", re: /locomotive-scroll/i },
  { id: "aos", re: /aos\.(js|css)|data-aos/i },
  { id: "splitting", re: /splitting(\.min)?\.js/i },
  { id: "tailwind", re: /tailwind|cdn\.tailwindcss/i },
  { id: "next.js", re: /\/_next\/|__NEXT_DATA__/i },
];

const FEATURE_SIGNATURES: Array<{ id: string; re: RegExp }> = [
  { id: "gradients", re: /(linear|radial|conic)-gradient/i },
  { id: "glassmorphism", re: /backdrop-filter\s*:\s*[^;]*blur|backdrop-blur/i },
  { id: "deep-shadows", re: /box-shadow\s*:\s*[^;]*\d{2,}px/i },
  { id: "blend-modes", re: /mix-blend-mode|background-blend-mode/i },
  { id: "clip-path", re: /clip-path\s*:/i },
  { id: "css-animations", re: /@keyframes|animation\s*:/i },
  { id: "transforms-3d", re: /perspective\(|rotate[XYZ]\(|translate3d|preserve-3d/i },
  { id: "uppercase-type", re: /text-transform\s*:\s*uppercase|tracking-/i },
  { id: "sticky", re: /position\s*:\s*sticky/i },
  { id: "marquee", re: /marquee|@keyframes\s+\w*scroll/i },
];

function detectFrom(text: string, sigs: Array<{ id: string; re: RegExp }>): string[] {
  return sigs.filter((s) => s.re.test(text)).map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Google Fonts from <link> hrefs
// ---------------------------------------------------------------------------

function extractGoogleFonts($: CheerioAPI): string[] {
  const out = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    for (const m of href.matchAll(/family=([^:&]+)/g)) {
      const fam = decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
      if (fam) out.add(fam);
    }
  });
  return [...out];
}

// System / emoji / common-fallback fonts that are almost never the brand face.
const SYSTEM_FONTS = new Set([
  "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji",
  "blinkmacsystemfont", "-apple-system", "apple-system", "segoe ui", "helvetica neue",
  "helvetica", "arial", "tahoma", "verdana", "times new roman", "times", "courier new",
  "courier", "georgia", "roboto", "noto sans", "liberation sans", "ui-sans-serif",
  "sf pro text", "sf pro display", "sf pro icons", "sfmono-regular", "sf mono",
]);

/** Clean one raw font-family token; return null if it's junk/fallback/system. */
function cleanFontName(raw: string): string | null {
  const name = raw.trim().replace(/["')(]/g, "").replace(/\\/g, "").trim();
  if (!name || name.length < 2) return null;
  if (/^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z]+|emoji|math|fangsong|var\(.*|--)/i.test(name)) return null;
  if (/(emoji|icon|symbol|webfont|fallback)/i.test(name)) return null;
  if (SYSTEM_FONTS.has(name.toLowerCase())) return null;
  return name;
}

/** Highest-signal: the fonts a site actually loads via @font-face. */
function fontFaceFonts(css: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const fm = block[1].match(/font-family\s*:\s*([^;}\n]+)/i);
    if (!fm) continue;
    const name = cleanFontName(fm[1]);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

/** Lower-signal: the first real font in each font-family stack. */
function extractDeclaredFonts(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(/font-family\s*:\s*([^;}\n]+)/gi)) {
    for (const raw of m[1].split(",")) {
      const name = cleanFontName(raw);
      if (!name) continue;
      const k = name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(name);
      break; // only the first real font in each stack (the intended face)
    }
  }
  return out;
}

function radiusStyle(text: string): "sharp" | "rounded" | "pill" {
  if (/border-radius\s*:\s*(9999px|999px|50%|9999rem)/i.test(text) || /rounded-full/i.test(text)) return "pill";
  const m = [...text.matchAll(/border-radius\s*:\s*(\d+)px/gi)].map((x) => parseInt(x[1], 10));
  if (m.length) {
    const avg = m.reduce((a, b) => a + b, 0) / m.length;
    if (avg < 4) return "sharp";
    if (avg > 16) return "pill";
    return "rounded";
  }
  if (/rounded-(xl|2xl|3xl)/i.test(text)) return "pill";
  if (/rounded/i.test(text)) return "rounded";
  return "sharp";
}

function density($: CheerioAPI): "dense" | "comfortable" {
  const body = $("body");
  if (!body.length) return "comfortable";
  let total = 0;
  body.find("*").each(() => { total += 1; });
  const kids = body.children().length;
  if (total > 600 || kids > 25) return "dense";
  return "comfortable";
}

// ---------------------------------------------------------------------------
// Role assignment from the extracted palette
// ---------------------------------------------------------------------------

function assignRoles(colors: string[], theme: "dark" | "light"): SiteDNA["roles"] {
  if (!colors.length) {
    return theme === "dark"
      ? { background: "#0a0a0f", foreground: "#f5f5f5", primary: "#6366f1", accent: "#22d3ee" }
      : { background: "#ffffff", foreground: "#0a0a0a", primary: "#4f46e5", accent: "#0ea5e9" };
  }
  const byLum = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const background = theme === "dark" ? byLum[0] : byLum[byLum.length - 1];
  const foreground = theme === "dark" ? byLum[byLum.length - 1] : byLum[0];
  const vivid = [...colors].sort((a, b) => saturation(b) - saturation(a)).filter((c) => saturation(c) > 0.25);
  const primary = vivid[0] ?? colors[0];
  const accent = vivid[1] ?? vivid[0] ?? colors[1] ?? primary;
  return { background, foreground, primary, accent };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Same-origin stylesheet hrefs (so the caller can fetch them for deeper extraction). */
export function stylesheetHrefs(html: string, baseUrl: string, max = 4): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  let origin = "";
  try { origin = new URL(baseUrl).origin; } catch { /* ignore */ }
  $('link[rel~="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try { abs = new URL(href, baseUrl).toString(); } catch { return; }
    // same-origin only (avoid third-party/font CDNs blowing the budget)
    if (origin && !abs.startsWith(origin)) return;
    if (!out.includes(abs)) out.push(abs);
  });
  return out.slice(0, max);
}

export function extractSiteDNA(html: string, url: string, extraCss = ""): SiteDNA {
  const $ = cheerio.load(html);

  // text corpus for signature detection: all <style>, style attrs, script srcs, class names, raw head
  // External stylesheet contents (extraCss) are folded into the style corpus.
  const styleText = $("style").map((_, el) => $(el).text()).get().join("\n") + "\n" + extraCss;
  const inlineStyles = $("[style]").map((_, el) => $(el).attr("style") ?? "").get().join("\n");
  const scriptSrcs = $("script[src]").map((_, el) => $(el).attr("src") ?? "").get().join("\n");
  const classNames = $("[class]").slice(0, 4000).map((_, el) => $(el).attr("class") ?? "").get().join(" ");
  const headHtml = $("head").html() ?? "";
  const corpus = `${styleText}\n${inlineStyles}\n${scriptSrcs}\n${classNames}\n${headHtml}`;

  const cssCorpus = `${styleText}\n${inlineStyles}\n${classNames}`;
  const colors = rankedHex(`${styleText}\n${inlineStyles}`).slice(0, 8);

  // theme: prefer meta theme-color, else dominant background luminance
  const themeColor = $('meta[name="theme-color"]').attr("content");
  let theme: "dark" | "light" = "dark";
  if (themeColor && /^#?[0-9a-fA-F]{3,8}$/.test(themeColor.trim())) {
    theme = luminance(normHex(themeColor.startsWith("#") ? themeColor : "#" + themeColor)) < 0.5 ? "dark" : "light";
  } else if (colors.length) {
    theme = luminance(colors[0]) < 0.5 ? "dark" : "light";
  }

  const googleFonts = extractGoogleFonts($);
  // Priority: Google Fonts (link) > @font-face (loaded) > first-in-stack declarations.
  const isMono = (f: string) => /(mono|code|courier|consol)/i.test(f);
  const fonts = [
    ...new Set([
      ...googleFonts,
      ...fontFaceFonts(styleText),
      ...extractDeclaredFonts(`${styleText}\n${inlineStyles}`),
    ]),
  ]
    // keep order but push mono/code faces to the back so a display font wins the first slot
    .sort((a, b) => (isMono(a) ? 1 : 0) - (isMono(b) ? 1 : 0))
    .slice(0, 6);

  const libs = detectFrom(corpus, LIB_SIGNATURES);
  const features = detectFrom(cssCorpus, FEATURE_SIGNATURES);
  if ($("video").length) features.push("video");
  if ($("canvas").length) features.push("canvas");
  if ($("svg").length > 6) features.push("rich-svg");

  return {
    url,
    title: ($("title").first().text() || $('meta[property="og:title"]').attr("content") || "").trim().slice(0, 120),
    description: ($('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "").trim().slice(0, 240),
    theme,
    colors,
    roles: assignRoles(colors, theme),
    fonts,
    googleFonts,
    libs,
    features: [...new Set(features)],
    radiusStyle: radiusStyle(cssCorpus),
    density: density($),
  };
}
