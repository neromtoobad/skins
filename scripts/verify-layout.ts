/**
 * Verification script for AC-6.
 * Asserts that generateLayout produces a complete DemoPage .tsx source
 * that compiles with tsc --strict, contains the required six sections
 * in order, uses a parent motion.div with staggerChildren derived from
 * tokens.motion, and references durationBase + easeOut.
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { generateLayout } from "../src/generators/layout";
import { presets } from "../src/vibes/presets";

function main(): void {
  let failures = 0;
  const fail = (msg: string): void => {
    failures += 1;
    process.stderr.write(`  FAIL: ${msg}\n`);
  };
  const pass = (msg: string): void => {
    process.stdout.write(`  PASS: ${msg}\n`);
  };

  // Use the cyberpunk preset for a deterministic, well-formed input.
  const tokens = presets.cyberpunk.tokens;
  const tsx = generateLayout(tokens);

  // ----- shape: is a non-trivial string -----
  if (typeof tsx !== "string") {
    fail(`generateLayout did not return a string (got ${typeof tsx})`);
  } else if (tsx.length < 1500) {
    fail(`generateLayout output is suspiciously short (${tsx.length} chars)`);
  } else {
    pass(`generateLayout returned a non-trivial string (${tsx.length} chars)`);
  }

  // ----- imports -----
  if (!tsx.includes(`import { motion`)) {
    fail("layout does not import { motion } from framer-motion");
  } else {
    pass("layout imports { motion } from framer-motion");
  }
  if (!tsx.includes(`from "framer-motion"`)) {
    fail("layout does not import from framer-motion package");
  } else {
    pass("layout imports from framer-motion");
  }
  if (!tsx.includes(`import * as React`)) {
    fail("layout does not import * as React from react");
  } else {
    pass("layout imports * as React from react");
  }

  // ----- default export -----
  if (!/export\s+default\s+function\s+DemoPage/.test(tsx)) {
    fail("layout does not export default function DemoPage");
  } else {
    pass("layout exports default function DemoPage");
  }

  // ----- container + item variants -----
  if (!tsx.includes("containerVariants")) {
    fail("layout does not declare containerVariants");
  } else {
    pass("layout declares containerVariants");
  }
  if (!tsx.includes("itemVariants")) {
    fail("layout does not declare itemVariants");
  } else {
    pass("layout declares itemVariants");
  }
  // containerVariants should have staggerChildren derived from tokens
  if (
    !tsx.includes("staggerChildren:") ||
    !tsx.includes(String(tokens.motion.staggerChildren))
  ) {
    fail(
      `containerVariants does not set staggerChildren to ${tokens.motion.staggerChildren}`,
    );
  } else {
    pass(
      `containerVariants sets staggerChildren = ${tokens.motion.staggerChildren}`,
    );
  }
  // itemVariants should reference durationBase and easeOut
  if (!tsx.includes(String(tokens.motion.durationBase))) {
    fail(`itemVariants does not reference durationBase (${tokens.motion.durationBase})`);
  } else {
    pass(`itemVariants references durationBase = ${tokens.motion.durationBase}`);
  }
  if (!tsx.includes(JSON.stringify(tokens.motion.easeOut))) {
    fail(`itemVariants does not reference easeOut (${tokens.motion.easeOut})`);
  } else {
    pass(`itemVariants references easeOut = ${tokens.motion.easeOut}`);
  }

  // ----- parent motion.div wraps everything -----
  if (!/<motion\.div\b[^>]*variants=\{containerVariants\}/.test(tsx)) {
    fail("layout does not have a parent <motion.div variants={containerVariants}>");
  } else {
    pass("layout has a parent <motion.div variants={containerVariants}>");
  }
  if (!/initial="hidden"/.test(tsx) || !/animate="visible"/.test(tsx)) {
    fail("layout parent does not set initial=\"hidden\" and animate=\"visible\"");
  } else {
    pass("layout parent sets initial=\"hidden\" and animate=\"visible\"");
  }

  // ----- six sections in order -----
  const sectionChecks: Array<{ name: string; re: RegExp }> = [
    { name: "Navbar",  re: /<motion\.nav\b/ },
    { name: "Hero",    re: /<motion\.section\b[^>]*id="hero"/ },
    { name: "Stats",   re: /id="stats"/ },
    { name: "Form",    re: /<motion\.section\b[^>]*id="signup"/ },
    { name: "Cards",   re: /id="features"/ },
    { name: "Footer",  re: /<motion\.footer\b/ },
  ];
  const positions: Array<{ name: string; pos: number }> = [];
  for (const c of sectionChecks) {
    const m = tsx.match(c.re);
    if (!m || m.index === undefined) {
      fail(`section "${c.name}" not found in layout (regex: ${c.re})`);
    } else {
      positions.push({ name: c.name, pos: m.index });
      pass(`section "${c.name}" found at offset ${m.index}`);
    }
  }
  // Verify ordering
  const sorted = [...positions].sort((a, b) => a.pos - b.pos);
  const expectedOrder = sectionChecks.map((c) => c.name);
  const actualOrder = sorted.map((p) => p.name);
  if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
    fail(
      `sections are not in expected order. Got: ${actualOrder.join(" → ")}, expected: ${expectedOrder.join(" → ")}`,
    );
  } else {
    pass(`sections appear in expected order: ${actualOrder.join(" → ")}`);
  }

  // ----- write to a tmp .tsx and run tsc --strict on the temp project -----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skins-layout-verify-"));
  const layoutFile = path.join(tmp, "layout.tsx");
  const tscConfigPath = path.join(tmp, "tsconfig.json");
  try {
    fs.writeFileSync(layoutFile, tsx, "utf8");
    fs.writeFileSync(
      tscConfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            moduleResolution: "node",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ["./*.tsx"],
        },
        null,
        2,
      ),
    );
    // Symlink the real node_modules so type resolution works.
    fs.symlinkSync(
      path.resolve(__dirname, "..", "node_modules"),
      path.join(tmp, "node_modules"),
      "junction",
    );

    // Use the project's tsc binary directly.
    const projectRoot = path.resolve(__dirname, "..");
    const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
    try {
      execSync(`${tscBin} -p ${tscConfigPath}`, {
        cwd: tmp,
        stdio: ["ignore", "pipe", "pipe"],
      });
      pass("tsc --strict on generated layout.tsx: exit 0");
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
      fail(
        `tsc --strict on generated layout.tsx failed (exit ${err.status ?? "?"}): ${(err.stdout ?? err.stderr ?? Buffer.from("")).toString().slice(0, 2000)}`,
      );
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // ----- cross-preset: staggerChildren propagates correctly -----
  for (const presetName of ["cyberpunk", "luxury", "glassmorphism", "terminal"]) {
    const t = presets[presetName].tokens;
    const out = generateLayout(t);
    if (!out.includes(`staggerChildren: ${t.motion.staggerChildren}`)) {
      fail(
        `${presetName}: layout does not use staggerChildren = ${t.motion.staggerChildren}`,
      );
    } else {
      pass(
        `${presetName}: layout uses staggerChildren = ${t.motion.staggerChildren} (motionStyle=${t.motion === presets[presetName].tokens.motion ? presets[presetName].motionStyle : "?"})`,
      );
    }
    if (!out.includes(String(t.motion.durationBase))) {
      fail(`${presetName}: layout does not reference durationBase = ${t.motion.durationBase}`);
    } else {
      pass(`${presetName}: layout references durationBase = ${t.motion.durationBase}`);
    }
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
