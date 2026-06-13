/**
 * test/references.test.ts — the curated library is well-formed.
 *
 * Guards the moat: every DeepReference is structurally valid and uses only
 * real toolkit techniques, so a bad hand- or pipeline-authored entry can't
 * silently ship.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEEP_REFERENCES, searchDeepReferences } from "../src/references/deep-references";

/** Keep in sync with the toolkit in src/generators/brief.ts (TECHNIQUES). */
const TECHNIQUE_IDS = new Set([
  "cinematic-hero", "3d-perspective-floor", "gradient-shimmer-text", "mouse-parallax",
  "cursor-spotlight", "holo-foil-tilt", "infinite-marquee", "intersection-reveal",
  "count-up", "draw-in-stroke", "magnetic-hover", "character-reveal",
  "sticky-stack-cards", "glass-nav-condense", "scroll-progress", "texture-overlays",
  "micro-interactions",
]);
const HEX = /^#[0-9a-fA-F]{6}$/;
const KEBAB = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const SLOP = new Set(["#7c5cff", "#6366f1", "#818cf8", "#a78bfa"]);

test("library has a meaningful number of blueprints", () => {
  assert.ok(DEEP_REFERENCES.length >= 13, `only ${DEEP_REFERENCES.length} references`);
});

test("every blueprint is structurally valid", () => {
  const ids = new Set<string>();
  for (const r of DEEP_REFERENCES) {
    assert.ok(KEBAB.test(r.id), `bad id: ${r.id}`);
    assert.ok(!ids.has(r.id), `duplicate id: ${r.id}`);
    ids.add(r.id);
    assert.ok(r.theme === "dark" || r.theme === "light", `${r.id}: bad theme`);
    assert.ok(r.keywords.length >= 3, `${r.id}: too few keywords`);
    for (const k of ["background", "surface", "foreground", "primary", "accent"] as const) {
      assert.ok(HEX.test(r.palette[k]), `${r.id}: palette.${k} not hex`);
    }
    assert.ok(r.palette.hexes.length >= 3 && r.palette.hexes.every((h) => HEX.test(h)), `${r.id}: bad hexes`);
    assert.ok(r.sections.length >= 3, `${r.id}: too few sections`);
    assert.ok(r.sections.every((s) => s.name && s.detail), `${r.id}: empty section`);
    assert.ok(r.techniques.length >= 3, `${r.id}: too few techniques`);
    for (const t of r.techniques) assert.ok(TECHNIQUE_IDS.has(t), `${r.id}: unknown technique ${t}`);
    assert.ok(r.signature.length > 0, `${r.id}: missing signature`);
  }
});

test("no blueprint defaults to the indigo AI-slop palette", () => {
  for (const r of DEEP_REFERENCES) {
    assert.ok(!SLOP.has(r.palette.primary.toLowerCase()), `${r.id} primary is slop`);
  }
});

test("search routes common vibes to the right blueprint", () => {
  assert.equal(searchDeepReferences("luxury fashion editorial")[0].id, "luxe-editorial");
  assert.equal(searchDeepReferences("fantasy football broadcast")[0].id, "broadcast-sports");
  assert.ok(searchDeepReferences("warm analog radio station")[0].score > 0);
});
