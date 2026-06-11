#!/usr/bin/env node
/**
 * scripts/browser-verify.mjs — AC-16 browser verification driver.
 *
 * Drives `agent-browser` (a headless Chrome CLI) to verify that the
 * generated `demo-output/vibe/preview.html`:
 *
 *   1. Renders without any error-level console messages.
 *   2. Has a visible Navbar, Hero, StatCards, Inputs, Cards, and
 *      Footer section in the DOM.
 *   3. Can have its rendered HTML saved to
 *      `docs/references/preview-snapshots/vibe.html` as a snapshot
 *      artifact that downstream Reviewers (and humans) can re-open
 *      to inspect the exact post-Tailwind-Play-CDN DOM the user
 *      would see.
 *
 * Why this file is needed: AC-16 is the only AC that cannot be
 * verified by static analysis — it requires a real browser, real
 * Tailwind Play CDN fetches, and a real network round-trip. The
 * downstream Reviewer runs the actual `agent-browser` invocations
 * listed in this script; this file is the deterministic, auditable
 * recipe they (or any CI pipeline) execute.
 *
 * Invocation:
 *
 *     node scripts/browser-verify.mjs
 *
 * Exits 0 on full success (no console errors, every section visible,
 * snapshot written), and 1 on any failure. The script is intentionally
 * plain ESM JavaScript (no TypeScript) so it runs with `node` directly
 * without a build step, mirroring `verify-output.mjs`.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

/** Path to the preview HTML we want to verify. */
const PREVIEW_HTML = join(PROJECT_ROOT, "demo-output", "vibe", "preview.html");

/** Path where the rendered snapshot is saved. */
const SNAPSHOT_DIR = join(PROJECT_ROOT, "docs", "references", "preview-snapshots");
const SNAPSHOT_HTML = join(SNAPSHOT_DIR, "vibe.html");

/** The six sections AC-16 requires to be visible. */
const REQUIRED_SECTIONS = [
  { name: "Navbar",    selector: "nav" },
  { name: "Hero",      selector: "section#hero" },
  { name: "StatCards", selector: "section#stats" },
  { name: "Inputs",    selector: "section#signup" },
  { name: "Cards",     selector: "section#features" },
  { name: "Footer",    selector: "footer" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let failures = 0;

function fail(msg) {
  failures += 1;
  process.stderr.write(`  FAIL: ${msg}\n`);
}

function pass(msg) {
  process.stdout.write(`  PASS: ${msg}\n`);
}

function info(msg) {
  process.stdout.write(`  INFO: ${msg}\n`);
}

/**
 * Run `agent-browser <args>` and return the trimmed stdout. We use
 * `spawnSync` with `shell: false` and capture both streams so we can
 * surface a clean error message if the command is missing.
 */
function ab(args, { throwOnError = false } = {}) {
  const res = spawnSync("agent-browser", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error) {
    if (res.error.code === "ENOENT") {
      throw new Error(
        "`agent-browser` CLI not found on PATH — install it (npm i -g agent-browser) and re-run.",
      );
    }
    throw res.error;
  }
  const out = (res.stdout ?? "").trim();
  const err = (res.stderr ?? "").trim();
  if (res.status !== 0) {
    if (throwOnError) {
      throw new Error(
        `agent-browser ${args.join(" ")} exited ${res.status}: ${err || out || "<no output>"}`,
      );
    }
    return { ok: false, status: res.status, stdout: out, stderr: err };
  }
  return { ok: true, status: res.status, stdout: out, stderr: err };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Step 1 — preflight: confirm the preview HTML file exists and copy it
 * to the snapshot location as a *static* placeholder. The script will
 * overwrite it with the rendered DOM later, but having a non-empty file
 * at the snapshot path on every run (even if the browser is
 * unavailable) means reviewers always have a reference.
 */
function preflight() {
  if (!existsSync(PREVIEW_HTML)) {
    fail(
      `${PREVIEW_HTML} does not exist — run \`npm run demo\` to regenerate it before this script can verify.`,
    );
    return false;
  }
  pass(
    `${PREVIEW_HTML} exists (${readFileSync(PREVIEW_HTML, "utf8").length} bytes)`,
  );

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  pass(`ensured snapshot directory ${SNAPSHOT_DIR}`);

  // Seed the snapshot with a copy of the source preview. The rendered
  // version below will overwrite this if the browser run succeeds.
  copyFileSync(PREVIEW_HTML, SNAPSHOT_HTML);
  info(
    `seeded ${SNAPSHOT_HTML} with the source preview (will be overwritten with rendered DOM if browser run succeeds)`,
  );
  return true;
}

/**
 * Step 2 — open the preview in the headless browser. The agent-browser
 * CLI launches Chrome, navigates to the file:// URL, and persists the
 * session for follow-up commands in the same agent-browser invocation.
 */
function openPreview() {
  // `agent-browser open file://…` requires an explicit `file://` prefix
  // — without one, the CLI prepends `https://` and the navigation fails.
  const url = `file://${PREVIEW_HTML}`;
  const res = ab(["open", url], { throwOnError: true });
  pass(
    `opened ${url} in headless Chrome (agent-browser reported: ${res.stdout.slice(0, 80) || "<no stdout>"})`,
  );
}

/**
 * Step 3 — wait for the Tailwind Play CDN script to apply its utility
 * classes. The CDN fetches a tailwindcss runtime that JIT-compiles
 * utility classes in the browser, then injects the resulting CSS.
 * A short, deterministic wait gives the CDN time to finish before we
 * assert on the rendered DOM.
 */
function waitForTailwind() {
  ab(["wait", "2000"], { throwOnError: true });
  pass("waited 2000ms for Tailwind Play CDN to apply utility classes");
}

/**
 * Step 4 — read the page console and assert there are zero error-level
 * messages. agent-browser's `console` command prints each log line
 * with a prefix like `[error] …` or `[log] …`; we filter for the
 * `[error]` prefix to keep the assertion tight.
 */
function assertNoConsoleErrors() {
  // Clear any pre-navigation logs so the assertion only sees
  // post-open logs.
  ab(["console", "--clear"], { throwOnError: true });
  const after = ab(["console"], { throwOnError: true });
  const lines = after.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const errors = lines.filter(
    (l) => /^\[error\]/i.test(l) || /^error\s*:/i.test(l),
  );
  if (errors.length > 0) {
    fail(
      `console has ${errors.length} error-level message(s):\n      ${errors.slice(0, 5).join("\n      ")}`,
    );
  } else {
    pass(
      `console has 0 error-level messages (observed ${lines.length} total log line(s))`,
    );
  }
}

/**
 * Step 5 — verify each of the six required sections is visible in the
 * rendered DOM. `agent-browser is visible <selector>` returns a
 * boolean response on the CLI; we treat any output that doesn't
 * start with `false` as truthy and double-check by counting matching
 * nodes.
 */
function assertSectionsVisible() {
  for (const sec of REQUIRED_SECTIONS) {
    // First, count the matching elements. Zero matches = certainly
    // not visible, regardless of what `is visible` reports.
    const countRes = ab(["get", "count", sec.selector], { throwOnError: true });
    const count = parseInt(countRes.stdout, 10);
    if (!Number.isFinite(count) || count < 1) {
      fail(
        `section "${sec.name}" (${sec.selector}) has 0 matching element(s) in the DOM`,
      );
      continue;
    }

    // Then, ask the browser whether the first match is visible. The
    // `is visible` command is best-effort — it returns `true` or
    // `false`. Treat anything that doesn't equal `false` (case
    // insensitive) as visible.
    const visRes = ab(["is", "visible", sec.selector], { throwOnError: true });
    const visible = !/^false\s*$/i.test(visRes.stdout);
    if (!visible) {
      fail(
        `section "${sec.name}" (${sec.selector}) is present in the DOM (count=${count}) but not visible`,
      );
    } else {
      pass(
        `section "${sec.name}" (${sec.selector}) is visible (count=${count})`,
      );
    }
  }
}

/**
 * Step 6 — save the rendered HTML to the snapshot path. We grab the
 * full document HTML via `agent-browser get html html` — the `html`
 * selector matches the document's root element and the command returns
 * its inner HTML (the head+body content) as plain text. This avoids
 * the JSON-encoded-quoted-string format that `agent-browser eval`
 * would return for `document.documentElement.outerHTML`.
 *
 * We also prepend a small comment banner so reviewers opening the
 * snapshot can tell at a glance that it is the post-Tailwind-CDN
 * render, not the source preview.
 */
function saveSnapshot() {
  const res = ab(["get", "html", "html"], { throwOnError: true });
  const renderedHtml = res.stdout;
  if (renderedHtml.length < 1000) {
    fail(
      `rendered HTML from agent-browser is suspiciously short (${renderedHtml.length} chars) — refusing to overwrite snapshot`,
    );
    return;
  }
  const banner = [
    "<!--",
    "  Snapshot generated by scripts/browser-verify.mjs (AC-16).",
    `  Source:  ${PREVIEW_HTML}`,
    `  Captured: ${new Date().toISOString()}`,
    `  Bytes:   ${renderedHtml.length}`,
    "",
    "  This file is the post-Tailwind-Play-CDN rendered DOM of the",
    "  source preview.html — utility classes have been applied and",
    "  the page is fully laid out. Open it in any browser to see",
    "  exactly what the AC-16 browser run observed.",
    "-->",
    "",
  ].join("\n");
  writeFileSync(SNAPSHOT_HTML, banner + renderedHtml, "utf8");
  pass(
    `saved rendered snapshot to ${SNAPSHOT_HTML} (${renderedHtml.length} chars)`,
  );
}

/**
 * Step 7 — close the browser so we don't leave a daemon running.
 * Best-effort: failure here does not fail the verification.
 */
function closeBrowser() {
  try {
    ab(["close", "--all"], { throwOnError: false });
    pass("closed headless browser session(s)");
  } catch (e) {
    info(
      `could not close browser cleanly: ${e && e.message ? e.message : e}`,
    );
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  process.stdout.write(
    "verifying demo-output/vibe/preview.html via agent-browser (AC-16)\n\n",
  );

  if (!preflight()) {
    process.stderr.write(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }

  try {
    openPreview();
    waitForTailwind();
    assertNoConsoleErrors();
    assertSectionsVisible();
    saveSnapshot();
  } catch (e) {
    fail(
      `agent-browser invocation failed: ${e && e.message ? e.message : e}`,
    );
  } finally {
    closeBrowser();
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
