/**
 * Verification script for AC-5.
 * Asserts that generateComponents produces the required five components,
 * that each contains the required framer-motion import + variants +
 * tokens.motion references, and that each compiles with tsc --strict.
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { generateComponents } from "../src/generators/components";
import { presets } from "../src/vibes/presets";

const EXPECTED = ["Button", "Card", "Input", "Navbar", "StatCard"] as const;

function main(): void {
  let failures = 0;
  const fail = (msg: string): void => {
    failures += 1;
    process.stderr.write(`  FAIL: ${msg}\n`);
  };
  const pass = (msg: string): void => {
    process.stdout.write(`  PASS: ${msg}\n`);
  };

  // Use the cyberpunk preset tokens for a deterministic, well-formed input.
  const tokens = presets.cyberpunk.tokens;

  // ----- shape: all five keys present and string-typed -----
  const components = generateComponents(tokens);
  for (const name of EXPECTED) {
    if (typeof components[name] !== "string") {
      fail(`components.${name} is not a string (got ${typeof components[name]})`);
    } else if (components[name].length < 200) {
      fail(`components.${name} is suspiciously short (${components[name].length} chars)`);
    } else {
      pass(`components.${name} is a non-trivial string (${components[name].length} chars)`);
    }
  }

  // ----- per-component content checks -----
  for (const name of EXPECTED) {
    const code = components[name];
    if (!code.includes(`import { motion`)) {
      fail(`${name} does not import { motion } from framer-motion`);
    } else {
      pass(`${name} imports { motion } from framer-motion`);
    }
    if (!code.includes("framer-motion")) {
      fail(`${name} does not reference framer-motion package`);
    } else {
      pass(`${name} references framer-motion`);
    }
    if (!code.includes("variants")) {
      fail(`${name} does not declare a variants object`);
    } else {
      pass(`${name} declares a variants object`);
    }
    if (!code.includes(String(tokens.motion.durationBase))) {
      fail(`${name} does not reference durationBase (${tokens.motion.durationBase})`);
    } else {
      pass(`${name} references durationBase = ${tokens.motion.durationBase}`);
    }
    if (!code.includes(JSON.stringify(tokens.motion.easeOut))) {
      fail(`${name} does not reference easeOut (${tokens.motion.easeOut})`);
    } else {
      pass(`${name} references easeOut = ${tokens.motion.easeOut}`);
    }
    if (!/export\s+(default\s+|const\s+|function\s+)/.test(code)) {
      fail(`${name} has no export statement`);
    } else {
      pass(`${name} has an export statement`);
    }
  }

  // ----- tailwind class-name sanity -----
  for (const name of EXPECTED) {
    const code = components[name];
    const classFrags = code.match(/className\s*=\s*\{/g) ?? [];
    if (classFrags.length === 0) {
      fail(`${name} has no className fragments`);
    } else {
      pass(`${name} has ${classFrags.length} className fragment(s)`);
    }
  }

  // ----- write each to a tmp .tsx and run tsc --strict on the temp project -----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skins-verify-"));
  const tscConfigPath = path.join(tmp, "tsconfig.json");
  try {
    for (const name of EXPECTED) {
      const file = path.join(tmp, `${name}.tsx`);
      fs.writeFileSync(file, components[name], "utf8");
    }
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

    // Use the project's tsc binary directly so we don't depend on cd.
    const projectRoot = path.resolve(__dirname, "..");
    const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
    try {
      const out = execSync(`${tscBin} -p ${tscConfigPath}`, {
        cwd: tmp,
        stdio: ["ignore", "pipe", "pipe"],
      });
      pass(`tsc --strict on all 5 generated .tsx files: exit 0 (stdout: ${out.toString().slice(0, 200) || "<empty>"})`);
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
      fail(
        `tsc --strict on generated .tsx files failed (exit ${err.status ?? "?"}): ${(err.stdout ?? err.stderr ?? Buffer.from("")).toString().slice(0, 1500)}`,
      );
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
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
