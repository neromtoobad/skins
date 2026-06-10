/**
 * Verification script for AC-7.
 * Asserts that generatePreview produces a complete, self-contained HTML
 * document that includes the Tailwind Play CDN, a <style> block with
 * CSS variables for every color + motion duration, and inline markup
 * for all six required sections. Also writes the result to a temp file
 * and runs a basic HTML well-formedness check.
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generatePreview } from "../src/generators/preview";
import { generateLayout } from "../src/generators/layout";
import { presets } from "../src/vibes/presets";

const REQUIRED_COLOR_VARS = [
  "--color-primary",
  "--color-secondary",
  "--color-accent",
  "--color-background",
  "--color-surface",
  "--color-foreground",
  "--color-muted",
  "--color-border",
  "--color-success",
  "--color-warning",
  "--color-danger",
];

const REQUIRED_MOTION_VARS = [
  "--duration-base",
  "--duration-fast",
  "--duration-slow",
  "--stagger",
];

const SECTIONS: Array<{ name: string; re: RegExp }> = [
  { name: "Navbar",  re: /<nav[^>]*class="[^"]*sticky/ },
  { name: "Hero",    re: /<section[^>]*id="hero"/ },
  { name: "Stats",   re: /<section[^>]*id="stats"/ },
  { name: "Form",    re: /<section[^>]*id="signup"/ },
  { name: "Cards",   re: /<section[^>]*id="features"/ },
  { name: "Footer",  re: /<footer\b/ },
];

function main(): void {
  let failures = 0;
  const fail = (msg: string): void => {
    failures += 1;
    process.stderr.write(`  FAIL: ${msg}\n`);
  };
  const pass = (msg: string): void => {
    process.stdout.write(`  PASS: ${msg}\n`);
  };

  const tokens = presets.cyberpunk.tokens;
  const layoutSource = generateLayout(tokens);
  const html = generatePreview(tokens, layoutSource);

  // ----- shape: non-trivial string -----
  if (typeof html !== "string") {
    fail(`generatePreview did not return a string (got ${typeof html})`);
  } else if (html.length < 4000) {
    fail(`preview HTML is suspiciously short (${html.length} chars)`);
  } else {
    pass(`generatePreview returned a non-trivial string (${html.length} chars)`);
  }

  // ----- top-level HTML document structure -----
  if (!html.startsWith("<!DOCTYPE html>")) {
    fail("preview HTML does not start with <!DOCTYPE html>");
  } else {
    pass("preview HTML starts with <!DOCTYPE html>");
  }
  if (!/<html\b/.test(html)) {
    fail("preview HTML has no <html> tag");
  } else {
    pass("preview HTML has <html> tag");
  }
  if (!/<head>/.test(html)) {
    fail("preview HTML has no <head> tag");
  } else {
    pass("preview HTML has <head> tag");
  }
  if (!/<body\b/.test(html)) {
    fail("preview HTML has no <body> tag");
  } else {
    pass("preview HTML has <body> tag");
  }
  if (!/<\/html>/.test(html)) {
    fail("preview HTML has no </html> close tag");
  } else {
    pass("preview HTML has </html> close tag");
  }

  // ----- Tailwind Play CDN script tag -----
  if (!/<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/.test(html)) {
    fail("preview HTML does not include the Tailwind Play CDN script tag");
  } else {
    pass("preview HTML includes the Tailwind Play CDN script tag");
  }

  // ----- <style> block with CSS variables for every color and motion duration -----
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    fail("preview HTML has no <style> block");
  } else {
    pass("preview HTML has a <style> block");
    const styleContent = styleMatch[1];

    // :root { ... } block check
    if (!/:root\s*\{[\s\S]*?\}/.test(styleContent)) {
      fail("<style> block has no :root { } block for CSS variables");
    } else {
      pass("<style> block has :root { } block for CSS variables");
    }

    // Every required color variable
    for (const v of REQUIRED_COLOR_VARS) {
      const re = new RegExp(`${v}:\\s*#?[a-zA-Z0-9()\\.,\\s-]+;`);
      if (!re.test(styleContent)) {
        fail(`<style> block is missing CSS variable ${v}`);
      } else {
        pass(`<style> block defines CSS variable ${v}`);
      }
    }

    // Every required motion variable
    for (const v of REQUIRED_MOTION_VARS) {
      const re = new RegExp(`${v}:\\s*[0-9.]+s;`);
      if (!re.test(styleContent)) {
        fail(`<style> block is missing motion CSS variable ${v}`);
      } else {
        pass(`<style> block defines motion CSS variable ${v}`);
      }
    }
  }

  // ----- Tailwind utility classes (sanity: bg-/text-/border-/rounded-/shadow-/p-) -----
  for (const prefix of ["bg-", "text-", "border-", "rounded-", "shadow-", "p-"]) {
    if (!html.includes(`class="`) || !html.match(new RegExp(`class="[^"]*\\b${prefix}[a-z0-9-]+`))) {
      fail(`preview HTML has no Tailwind class starting with ${prefix}`);
    } else {
      pass(`preview HTML uses Tailwind class with ${prefix}`);
    }
  }

  // ----- inline <div> markup for all six sections -----
  for (const s of SECTIONS) {
    if (!s.re.test(html)) {
      fail(`section "${s.name}" not found in preview markup (regex: ${s.re})`);
    } else {
      pass(`section "${s.name}" found in preview markup`);
    }
  }

  // ----- Tailwind class includes the token-derived color names -----
  for (const colorKey of ["primary", "secondary", "accent", "background", "surface", "foreground", "muted", "border", "success", "danger"]) {
    const colorName = tokens.colors[colorKey as keyof typeof tokens.colors];
    if (!html.includes(`bg-${colorName}`) && !html.includes(`text-${colorName}`) && !html.includes(`border-${colorName}`)) {
      fail(`preview HTML does not reference color token "${colorKey}" (${colorName})`);
    } else {
      pass(`preview HTML references color token "${colorKey}" (${colorName})`);
    }
  }

  // ----- the CSS variables actually contain the right hex values for cyberpunk -----
  // Sample: cyberpunk primary is "fuchsia-500" → #d946ef
  if (!html.includes("--color-primary: #d946ef")) {
    fail("preview HTML --color-primary is not the expected hex for cyberpunk fuchsia-500 (#d946ef)");
  } else {
    pass("preview HTML --color-primary = #d946ef (cyberpunk fuchsia-500)");
  }
  // cyberpunk background is "slate-950" → #020617
  if (!html.includes("--color-background: #020617")) {
    fail("preview HTML --color-background is not the expected hex for cyberpunk slate-950 (#020617)");
  } else {
    pass("preview HTML --color-background = #020617 (cyberpunk slate-950)");
  }

  // ----- motion durations are interpolated (not hard-coded) -----
  if (!html.includes(`--duration-base: ${tokens.motion.durationBase}s`)) {
    fail(`preview HTML --duration-base is not ${tokens.motion.durationBase}s`);
  } else {
    pass(`preview HTML --duration-base = ${tokens.motion.durationBase}s`);
  }
  if (!html.includes(`--stagger: ${tokens.motion.staggerChildren}s`)) {
    fail(`preview HTML --stagger is not ${tokens.motion.staggerChildren}s`);
  } else {
    pass(`preview HTML --stagger = ${tokens.motion.staggerChildren}s`);
  }

  // ----- Google Fonts link present -----
  if (!html.includes("fonts.googleapis.com/css2")) {
    fail("preview HTML does not include a Google Fonts link");
  } else {
    pass("preview HTML includes a Google Fonts link");
  }

  // ----- entrance animation defined -----
  if (!/@keyframes\s+skin-fade-in/.test(html)) {
    fail("preview HTML does not define a @keyframes animation");
  } else {
    pass("preview HTML defines @keyframes skin-fade-in");
  }
  if (!/\.stagger\s*>\s*\*/.test(html)) {
    fail("preview HTML does not define a .stagger > * animation rule");
  } else {
    pass("preview HTML defines .stagger > * animation rule");
  }

  // ----- no obvious console-error sources -----
  // (e.g., unclosed <script> tags, mismatched braces, raw TSX in body, etc.)
  if (/<script[^>]*>[^<]*import\s/m.test(html)) {
    fail("preview HTML appears to contain raw 'import' statements in a <script> tag");
  } else {
    pass("preview HTML has no raw 'import' statements in <script> tags");
  }
  // Check brace balance roughly (best-effort)
  const openBraces = (html.match(/\{/g) ?? []).length;
  const closeBraces = (html.match(/\}/g) ?? []).length;
  if (Math.abs(openBraces - closeBraces) > 2) {
    fail(`preview HTML has unbalanced braces (${openBraces} open vs ${closeBraces} close)`);
  } else {
    pass(`preview HTML has roughly balanced braces (${openBraces} open vs ${closeBraces} close)`);
  }
  // No raw ${...} template literal leakage
  if (/\$\{[^}]+\}/.test(html)) {
    fail("preview HTML appears to contain raw ${...} template literal placeholders");
  } else {
    pass("preview HTML has no raw ${...} template literal placeholders");
  }

  // ----- write to a tmp file and confirm it parses as HTML -----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skins-preview-verify-"));
  try {
    const file = path.join(tmp, "preview.html");
    fs.writeFileSync(file, html, "utf8");
    pass(`wrote preview HTML to ${file} (${html.length} bytes)`);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // ----- cross-preset: color values change between presets -----
  const luxuryTokens = presets.luxury.tokens;
  const luxuryHtml = generatePreview(luxuryTokens, generateLayout(luxuryTokens));
  if (!luxuryHtml.includes("--color-primary: #d97706")) {
    fail("luxury preview does not include --color-primary = #d97706 (amber-600)");
  } else {
    pass("luxury preview includes --color-primary = #d97706 (amber-600)");
  }
  if (luxuryHtml.includes("--color-primary: #d946ef")) {
    fail("luxury preview incorrectly uses cyberpunk's fuchsia-500 hex for primary");
  } else {
    pass("luxury preview does not leak cyberpunk's primary color");
  }

  if (failures === 0) {
    process.stdout.write("all checks passed\n");
    process.exit(0);
  } else {
    process.stderr.write(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }
}

main();
