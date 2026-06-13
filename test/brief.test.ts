/**
 * test/brief.test.ts — the brief engine's guarantees.
 *
 * These lock in the behaviours the product promises: no AI-slop palette,
 * a hard rebuild order on redesigns, paste-ready tokens, and enforced
 * motion code. Run via `npm test` (zero deps — Node's built-in runner).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrief } from "../src/generators/brief";

/** The indigo/violet "AI slop" hexes the product is built to avoid. */
const SLOP = new Set(["#7c5cff", "#6366f1", "#818cf8", "#a78bfa", "#4f46e5"]);

test("dark AI/SaaS no longer returns the indigo AI-slop palette", () => {
  const r = buildBrief("dark ai saas dashboard");
  assert.ok(!SLOP.has(r.palette.primary.toLowerCase()), `primary ${r.palette.primary} is slop`);
  assert.equal(r.palette.primary.toLowerCase(), "#19d9a0"); // apex re-paletted to emerald
});

test("music/radio matches a warm, non-blue archetype", () => {
  const r = buildBrief("music radio streaming app");
  assert.match(r.source.name, /Static|Pulse/);
  assert.ok(/^#ff/i.test(r.palette.primary), `expected warm primary, got ${r.palette.primary}`);
});

test("a redesign (target provided) opens with the hard rebuild order", () => {
  const r = buildBrief("dark ai saas", "redesign my analytics dashboard");
  assert.ok(r.brief.startsWith("⛔ REBUILD FROM SCRATCH"), "must lead with the rebuild order");
});

test("every brief ships paste-ready tokens, anti-slop rule, and required motion code", () => {
  const r = buildBrief("bold sports broadcast", "a fantasy football app");
  assert.ok(r.brief.includes(":root {"), "missing :root token scaffold");
  assert.ok(r.brief.includes("Escape AI-slop"), "missing anti-slop colour rule");
  assert.ok(r.brief.includes("## Motion — REQUIRED"), "missing required-motion section");
  assert.ok(r.brief.includes("IntersectionObserver"), "missing paste-ready motion code");
});

test("strong deep-reference matches win over thin motionsites summaries", () => {
  assert.equal(buildBrief("bold world cup fantasy football").source.type, "deep-reference");
  assert.match(buildBrief("minimal luxury fashion brand").source.name, /Maison/);
  assert.match(buildBrief("developer cli tool").source.name, /Forge/);
});

test("the asset plan ships a generation prompt + fallback for every slot", () => {
  const { assets } = buildBrief("dark ai saas dashboard");
  assert.ok(assets.length >= 3);
  for (const a of assets) {
    assert.ok(a.genPrompt.length > 0, `slot ${a.slot} missing genPrompt`);
    assert.ok(a.fallback.length > 0, `slot ${a.slot} missing fallback`);
  }
});

test("generation is deterministic — same input, same brief", () => {
  assert.equal(buildBrief("dark ai saas", "x").brief, buildBrief("dark ai saas", "x").brief);
});
