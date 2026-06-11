#!/usr/bin/env node
/**
 * scripts/add-reference.mjs — the extraction-pipeline append step.
 *
 * Validates a candidate DeepReference (JSON) and appends it to
 * src/references/deep-references.ts at the ADD-REFERENCE-MARKER. A valid
 * JSON object is also a valid TS array element, so after appending,
 * `tsc --noEmit` structurally re-validates the whole library for free.
 *
 * Usage:
 *   node scripts/add-reference.mjs <candidate.json>          # validate + append
 *   node scripts/add-reference.mjs <candidate.json> --check  # validate only
 *
 * See docs/EXTRACTION_RECIPE.md for how an agent produces the candidate.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REF_FILE = join(ROOT, "src", "references", "deep-references.ts");
const MARKER = "// ADD-REFERENCE-MARKER";

// Keep in sync with the toolkit in src/generators/brief.ts (TECHNIQUES).
const VALID_TECHNIQUES = new Set([
  "cinematic-hero", "3d-perspective-floor", "gradient-shimmer-text", "mouse-parallax",
  "cursor-spotlight", "holo-foil-tilt", "infinite-marquee", "intersection-reveal",
  "count-up", "draw-in-stroke", "magnetic-hover", "character-reveal",
  "sticky-stack-cards", "glass-nav-condense", "scroll-progress", "texture-overlays",
  "micro-interactions",
]);

const HEX = /^#[0-9a-fA-F]{6}$/;
const KEBAB = /^[a-z][a-z0-9-]*[a-z0-9]$/;

function isStr(v) { return typeof v === "string" && v.trim().length > 0; }
function isStrArr(v, min) { return Array.isArray(v) && v.length >= min && v.every(isStr); }

function validate(ref, existingIds) {
  const e = [];
  if (!isStr(ref.id) || !KEBAB.test(ref.id)) e.push("`id` must be kebab-case (e.g. 'ecommerce-product').");
  if (existingIds.has(ref.id)) e.push(`id "${ref.id}" already exists in the library.`);
  for (const k of ["name", "category", "summary", "signature"]) if (!isStr(ref[k])) e.push(`\`${k}\` must be a non-empty string.`);
  if (ref.theme !== "dark" && ref.theme !== "light") e.push("`theme` must be 'dark' or 'light'.");
  if (!isStrArr(ref.keywords, 3)) e.push("`keywords` must be an array of >= 3 lowercase strings (for matching).");

  const p = ref.palette ?? {};
  for (const k of ["background", "surface", "foreground", "primary", "accent"]) {
    if (!isStr(p[k]) || !HEX.test(p[k])) e.push(`\`palette.${k}\` must be a #rrggbb hex.`);
  }
  if (!Array.isArray(p.hexes) || p.hexes.length < 3 || !p.hexes.every((h) => HEX.test(h))) {
    e.push("`palette.hexes` must be an array of >= 3 #rrggbb hexes.");
  }

  const f = ref.fonts ?? {};
  for (const k of ["display", "body", "mono", "note"]) if (!isStr(f[k])) e.push(`\`fonts.${k}\` must be a non-empty string.`);

  const m = ref.motion ?? {};
  if (!isStr(m.style)) e.push("`motion.style` must be a non-empty string.");
  if (!isStrArr(m.beats, 2)) e.push("`motion.beats` must be an array of >= 2 strings.");

  if (!Array.isArray(ref.sections) || ref.sections.length < 3) e.push("`sections` must have >= 3 entries.");
  else ref.sections.forEach((s, i) => {
    if (!isStr(s?.name) || !isStr(s?.detail)) e.push(`sections[${i}] needs { name, detail } non-empty strings.`);
  });

  if (!isStrArr(ref.techniques, 3)) e.push("`techniques` must be an array of >= 3 strings.");
  else for (const t of ref.techniques) if (!VALID_TECHNIQUES.has(t)) e.push(`technique "${t}" is not in the toolkit. Valid: ${[...VALID_TECHNIQUES].join(", ")}`);

  return e;
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: node scripts/add-reference.mjs <candidate.json> [--check]");
    process.exit(2);
  }

  let candidate;
  try {
    candidate = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch (err) {
    console.error(`Could not read/parse ${file}: ${err.message}`);
    process.exit(2);
  }

  const tsSource = readFileSync(REF_FILE, "utf8");
  const existingIds = new Set([...tsSource.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]));

  const errors = validate(candidate, existingIds);
  if (errors.length) {
    console.error(`✗ invalid candidate (${errors.length} issue(s)):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ candidate "${candidate.id}" is valid.`);
  if (checkOnly) {
    console.log("(--check) not appended.");
    return;
  }

  if (!tsSource.includes(MARKER)) {
    console.error(`Could not find ${MARKER} in ${REF_FILE}.`);
    process.exit(2);
  }

  // A valid JSON object is a valid TS array element. Indent it under the array.
  const entry = JSON.stringify(candidate, null, 2)
    .split("\n")
    .map((l) => "  " + l)
    .join("\n");
  const block = `${entry},\n  ${MARKER}`;
  const updated = tsSource.replace(`  ${MARKER}`, block);
  writeFileSync(REF_FILE, updated);

  console.log(`✓ appended "${candidate.id}" to src/references/deep-references.ts`);
  console.log("  next: run `npx tsc --noEmit` to structurally validate, then commit.");
}

main();
