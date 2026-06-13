/**
 * test/site-dna.test.ts — live-site design-DNA extraction (offline fixture).
 *
 * Exercises the `generate_brief_from_url` engine against a controlled HTML
 * fixture (no network), so the palette/font/library/feature extraction is
 * pinned.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSiteDNA } from "../src/scrapers/site-dna";
import { buildBriefFromDNA } from "../src/generators/brief";

const FIXTURE = `<!doctype html><html><head>
<title>Acme — Bold Studio</title>
<meta name="theme-color" content="#0b0b10">
<meta name="description" content="A bold creative studio.">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
  :root{ --x:#ff5a3c }
  body{ background:#0b0b10; color:#f0f0f0; font-family:'Clash Display', sans-serif }
  .btn{ border-radius:9999px; background:linear-gradient(90deg,#ff5a3c,#000); backdrop-filter: blur(8px) }
  @keyframes spin{ to{ transform:rotate(360deg) } }
</style>
<script src="https://cdn.jsdelivr.net/npm/framer-motion/dist/index.js"></script>
</head><body><h1>Hi</h1><canvas></canvas></body></html>`;

test("extracts the real palette, theme, fonts, libraries and features", () => {
  const dna = extractSiteDNA(FIXTURE, "https://acme.example");
  assert.equal(dna.theme, "dark");
  assert.ok(dna.colors.includes("#ff5a3c"), "missing accent hex");
  assert.ok(dna.googleFonts.includes("Space Grotesk"), "missing Google font");
  assert.ok(dna.libs.includes("framer-motion"), "missing framer-motion");
  assert.ok(dna.features.includes("gradients"), "missing gradients");
  assert.ok(dna.features.includes("glassmorphism"), "missing glass");
  assert.equal(dna.radiusStyle, "pill");
  assert.match(dna.title, /Acme/);
});

test("a URL brief opens with the rebuild order and a token scaffold", () => {
  const dna = extractSiteDNA(FIXTURE, "https://acme.example");
  const brief = buildBriefFromDNA(dna).brief;
  assert.ok(brief.startsWith("⛔ REBUILD FROM SCRATCH"));
  assert.ok(brief.includes(":root {"));
  assert.ok(brief.includes("## Motion — REQUIRED"));
});

test("malformed / empty HTML degrades gracefully (no throw)", () => {
  assert.doesNotThrow(() => extractSiteDNA("<html></html>", "https://x.example"));
});
