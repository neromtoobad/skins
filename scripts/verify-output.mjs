#!/usr/bin/env node
/**
 * scripts/verify-output.mjs — AC-15 verification script.
 *
 * Reads every `components.json` under every subdirectory of
 * `demo-output/` and asserts that every component:
 *
 *   1. contains `import { motion } from "framer-motion"`,
 *   2. contains a `variants` declaration, and
 *   3. has every Tailwind class name matching the regex
 *      /^[a-z][a-z0-9-]*(\:[a-z0-9-]+)*$/, with class names joined by
 *      spaces.
 *
 * The class-name check inspects the `className={…}` expressions in the
 * source: plain string-literal classNames are split on whitespace, and
 * array-form classNames (`className={[…].join(" ")}`) have each string
 * and template-literal element stripped of its `${…}` interpolations
 * (which we trust the generator to produce as valid Tailwind class
 * fragments) and then validated. Any token that does not match the
 * regex is a failure.
 *
 * On full success the script prints `all checks passed` to stdout and
 * exits with code 0. On any failure it prints a summary to stderr and
 * exits with code 1.
 *
 * This file is intentionally written in plain ESM JavaScript (no
 * TypeScript) so it can be invoked with `node` directly, without a
 * build step, mirroring the `verify` script in `package.json`:
 *
 *     "verify": "tsc --noEmit && node scripts/verify-output.mjs"
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DEMO_OUTPUT_DIR = join(PROJECT_ROOT, "demo-output");

/** The five component names that the generator must produce. */
const EXPECTED_COMPONENTS = ["Button", "Card", "Input", "Navbar", "StatCard"];

/**
 * The Tailwind utility-class regex taken straight from the AC-15 spec.
 * Matches tokens like `bg-fuchsia-500`, `hover:opacity-90`, and
 * `lg:max-w-6xl`. Will NOT match tokens that start with a digit (e.g.
 * `3xl`), contain uppercase letters, or have unbalanced colons.
 */
const TAILWIND_CLASS_RE = /^[a-z][a-z0-9-]*(\:[a-z0-9-]+)*$/;

/**
 * Acceptable spellings of the framer-motion import. The AC quotes
 * `import { motion } from "framer-motion"` verbatim, but the generator
 * also emits `motion, type HTMLMotionProps, type Variants` in the same
 * brace group, so we match any import that pulls in `motion` from
 * `framer-motion`.
 */
const MOTION_IMPORT_RE =
  /import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*["']framer-motion["']/;

// ---------------------------------------------------------------------------
// Verification state + helpers
// ---------------------------------------------------------------------------

let failures = 0;

function fail(msg) {
  failures += 1;
  process.stderr.write(`  FAIL: ${msg}\n`);
}

function pass(msg) {
  process.stdout.write(`  PASS: ${msg}\n`);
}

/**
 * Strip every `${…}` template-literal interpolation from a string,
 * keeping only the static parts. This is what lets us validate the
 * hard-coded portions of `className` arrays that mix literal class
 * fragments with `${bg(t.colors.primary)}`-style interpolations
 * without trying to actually evaluate them.
 */
function stripInterpolations(s) {
  return s.replace(/\$\{[\s\S]*?\}/g, "");
}

// ---------------------------------------------------------------------------
// Class-name extraction
// ---------------------------------------------------------------------------

/**
 * Find every `className={…}` expression in the source and return an
 * array of the *static* class-string contents — i.e. the whitespace-
 * joined class tokens we'd see in the DOM once interpolations are
 * substituted in.
 *
 * Handles three shapes the generator emits:
 *
 *   (a) `className="foo bar"`                 — plain string literal
 *   (b) `className='foo bar'`                 — single-quoted literal
 *   (c) `className={`foo ${expr} bar`}`        — single template literal
 *   (d) `className={["foo", "bar"].join(" ")}` — array form
 *   (e) `className={[\n  "foo",\n  `${expr} ${expr}`,\n].join(" ")}` — array form
 *
 * For (d)/(e) we walk each string/template-literal element in the array
 * and collect their static text. Template-literal interpolations are
 * stripped (we trust the generator to produce valid Tailwind fragments
 * from the DesignTokens at runtime).
 */
function extractClassStrings(code) {
  const out = [];

  // (a) className="..." — straight string literal.
  for (const m of code.matchAll(/className\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)) {
    out.push(m[1]);
  }

  // (b) className='...' — single-quoted string literal.
  for (const m of code.matchAll(/className\s*=\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g)) {
    out.push(m[1]);
  }

  // (c) className={`…`} — single template literal, no surrounding array.
  for (const m of code.matchAll(/className\s*=\s*\{\s*`([^`]*)`\s*\}/g)) {
    out.push(stripInterpolations(m[1]));
  }

  // (d)/(e) className={[…].join(" ")} — array form. The regex is
  //     deliberately non-greedy on the brackets so it stops at the
  //     FIRST matching `]`, which in this generator is always the
  //     close of the className array.
  const arrayRe =
    /className\s*=\s*\{\s*(\[[\s\S]*?\]\s*\.\s*join\(\s*["'][^"']*["']\s*\)\s*)\}/g;
  for (const m of code.matchAll(arrayRe)) {
    const arrBlock = m[1];
    // Pull out every "…", '…', and `…` literal in the array block.
    const litRe =
      /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`)/g;
    for (const lm of arrBlock.matchAll(litRe)) {
      const lit = lm[1] !== undefined ? lm[1] : lm[2] !== undefined ? lm[2] : lm[3];
      out.push(stripInterpolations(lit));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Per-component checks
// ---------------------------------------------------------------------------

/**
 * Verify a single component. `code` is the TSX source string for that
 * component, `name` is the component's key in the JSON record, and
 * `subdir` is the demo-output subdirectory it came from (used to keep
 * the FAIL/PASS lines unambiguous when printing).
 */
function verifyComponent(name, code, subdir) {
  // (1) framer-motion import
  if (!MOTION_IMPORT_RE.test(code)) {
    fail(
      `${subdir}/${name}: missing \`import { motion } from "framer-motion"\``,
    );
  } else {
    pass(`${subdir}/${name}: contains import { motion } from "framer-motion"`);
  }

  // (2) variants declaration — the AC requires "a `variants` object".
  //     We accept any of the three patterns the generator emits:
  //       (a) `const x: Variants = { ... }`        — typed assignment
  //       (b) `const x = { ... } as Variants`     — assertion
  //       (c) `variants={...}`                    — prop usage
  //     The union regex below matches any of the three. We deliberately
  //     do NOT match the `Variants` type name on its own (it appears in
  //     the import statement), so removing the actual variants object
  //     causes a failure.
  const VARIANTS_OBJECT_RE =
    /(?::\s*Variants\s*=|as\s+Variants\b|variants\s*=\s*\{)/;
  if (!VARIANTS_OBJECT_RE.test(code)) {
    fail(`${subdir}/${name}: missing \`variants\` object`);
  } else {
    pass(`${subdir}/${name}: contains a variants object`);
  }

  // (3) Every class name token must match the Tailwind class regex.
  const classStrings = extractClassStrings(code);
  if (classStrings.length === 0) {
    fail(`${subdir}/${name}: no className expressions found in source`);
    return;
  }

  let total = 0;
  let invalid = 0;
  /** @type {string[]} */
  const examples = [];
  for (const s of classStrings) {
    for (const token of s.split(/\s+/).filter((t) => t.length > 0)) {
      total += 1;
      if (!TAILWIND_CLASS_RE.test(token)) {
        invalid += 1;
        if (examples.length < 5) examples.push(JSON.stringify(token));
      }
    }
  }

  if (invalid === 0) {
    pass(
      `${subdir}/${name}: all ${total} class name token(s) match ${TAILWIND_CLASS_RE}`,
    );
  } else {
    fail(
      `${subdir}/${name}: ${invalid}/${total} class name token(s) fail ${TAILWIND_CLASS_RE} (examples: ${examples.join(", ")})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

/**
 * Return the immediate child directory names of `demo-output/`. We
 * treat any directory as a candidate mode folder; the AC spec calls
 * for components.json files under every subdir of demo-output, so the
 * natural shape is to iterate the immediate children. We do not
 * constrain the names (the demo currently produces `vibe`, `url`,
 * `image`, but the script should happily accept anything).
 */
function listModeDirs() {
  let entries;
  try {
    entries = readdirSync(DEMO_OUTPUT_DIR);
  } catch {
    return [];
  }
  return entries.filter((name) => {
    try {
      return statSync(join(DEMO_OUTPUT_DIR, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  // ----- prereq: demo-output must exist -----
  if (!statSync(DEMO_OUTPUT_DIR, { throwIfNoEntry: false })) {
    process.stderr.write(
      `  FAIL: ${DEMO_OUTPUT_DIR} does not exist — run \`npm run demo\` first.\n`,
    );
    process.exit(1);
  }

  const modeDirs = listModeDirs();
  if (modeDirs.length === 0) {
    process.stderr.write(
      `  FAIL: no subdirectories found in ${DEMO_OUTPUT_DIR} — run \`npm run demo\` first.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `verifying components.json in ${modeDirs.length} subdir(s): ${modeDirs.join(", ")}\n\n`,
  );

  for (const subdir of modeDirs) {
    const componentsPath = join(DEMO_OUTPUT_DIR, subdir, "components.json");
    if (!statSync(componentsPath, { throwIfNoEntry: false })) {
      fail(`${subdir}: missing components.json`);
      continue;
    }

    /** @type {Record<string, unknown>} */
    let components;
    try {
      components = JSON.parse(readFileSync(componentsPath, "utf8"));
    } catch (e) {
      fail(`${subdir}: components.json is not valid JSON (${(e && e.message) || e})`);
      continue;
    }

    for (const name of EXPECTED_COMPONENTS) {
      const code = components[name];
      if (code === undefined) {
        fail(`${subdir}: components.json is missing component "${name}"`);
        continue;
      }
      if (typeof code !== "string") {
        fail(
          `${subdir}/${name}: components["${name}"] is not a string (got ${typeof code})`,
        );
        continue;
      }
      verifyComponent(name, code, subdir);
    }
  }

  if (failures === 0) {
    process.stdout.write("\nall checks passed\n");
    process.exit(0);
  } else {
    process.stderr.write(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }
}

main();
