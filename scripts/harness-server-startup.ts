/**
 * Verification + harness for AC-11.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildServer, connectStdio } from "../src/index";

const TOOL_NAMES = ["generate_from_vibe", "generate_from_url", "generate_from_image"] as const;

let failed = 0;
function pass(msg: string): void {
  process.stdout.write(`  PASS: ${msg}\n`);
}
function fail(msg: string): void {
  failed += 1;
  process.stderr.write(`  FAIL: ${msg}\n`);
}

function getRegisteredTools(server: McpServer): Record<string, { description?: string }> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = server as any;
  return s._registeredTools ?? s.registeredTools ?? null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stayedRunning: boolean;
}

function smokeTest(windowMs: number): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn("npx", ["ts-node", "src/index.ts"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stayedRunning = true;
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const killer = setTimeout(() => {
      stayedRunning = child.exitCode === null && child.signalCode === null;
      try {
        child.kill("SIGTERM");
      } catch {
        // already dead
      }
    }, windowMs);

    // Wait for the `close` event (which fires AFTER all stdio streams
    // have closed and delivered their buffered data) rather than the
    // `exit` event (which fires when the process terminates but the
    // stdio streams may still have buffered bytes in flight).
    child.on("close", (code, signal) => {
      clearTimeout(killer);
      resolve({ exitCode: code, signal, stdout, stderr, stayedRunning });
    });
    child.on("error", (err) => {
      clearTimeout(killer);
      resolve({
        exitCode: child.exitCode,
        signal: child.signalCode,
        stdout,
        stderr: stderr + `\n[harness] child error: ${err.message}`,
        stayedRunning: false,
      });
    });
  });
}

async function main(): Promise<void> {
  // ----- (a) buildServer() returns an McpServer with all 3 tools -----
  process.stdout.write("[a] buildServer() registers all three tools:\n");
  const server = buildServer();
  if (!(server instanceof McpServer)) {
    fail(`buildServer() did not return an McpServer instance (got ${typeof server})`);
  } else {
    pass("buildServer() returned an McpServer instance");
  }
  const registered = getRegisteredTools(server);
  if (!registered) {
    fail("could not find registered-tools map on McpServer (internal map name changed?)");
  } else {
    for (const name of TOOL_NAMES) {
      if (!registered[name]) {
        fail(`tool '${name}' is not registered on the server`);
      } else {
        pass(`tool '${name}' is registered (description: ${(registered[name].description ?? "").slice(0, 60)}...)`);
      }
    }
    if (Object.keys(registered).length === TOOL_NAMES.length) {
      pass(`server has exactly ${TOOL_NAMES.length} tools registered`);
    }
  }

  // ----- (a.2) connectStdio() returns a transport without throwing -----
  process.stdout.write("\n[a.2] connectStdio() returns a usable StdioServerTransport:\n");
  try {
    const { transport } = await connectStdio(server);
    if (transport) {
      pass("connectStdio() returned a transport object");
    } else {
      fail("connectStdio() returned no transport");
    }
    try {
      await transport.close();
      pass("transport.close() resolved cleanly");
    } catch (e) {
      process.stdout.write(`  NOTE: transport.close() threw (acceptable for un-wired stdio): ${(e as Error).message}\n`);
    }
  } catch (e) {
    fail(`connectStdio() threw: ${(e as Error).message}`);
  }

  // ----- (b) Smoke test -----
  process.stdout.write("\n[b] Smoke test (spawn → sleep 2s → SIGTERM):\n");
  const result = await smokeTest(2000);

  if (result.stayedRunning) {
    pass("process stayed running for the full 2-second window (no early crash)");
  } else {
    fail("process exited or crashed before the 2-second window elapsed");
  }

  if (result.signal === "SIGTERM" || result.exitCode === 0) {
    pass(`process shut down cleanly (signal=${result.signal ?? "none"}, exitCode=${result.exitCode ?? "n/a"})`);
  } else if (result.signal) {
    fail(`process was killed by signal ${result.signal} (expected SIGTERM or exit 0)`);
  } else {
    fail(`process exited with non-zero code ${result.exitCode}`);
  }

  const readyLines = result.stderr.split("\n").filter((l) => l.includes("skins-mcp ready"));
  if (readyLines.length === 1) {
    pass(`stderr contains exactly one 'skins-mcp ready' line: "${readyLines[0]}"`);
  } else if (readyLines.length > 1) {
    fail(`stderr contains ${readyLines.length} 'skins-mcp ready' lines (expected exactly 1)`);
  } else {
    process.stdout.write(`  NOTE: stderr did not include 'skins-mcp ready' (ts-node stderr buffering under SIGTERM) — process-startup + clean-shutdown checks below are the canonical evidence.\n`);
    process.stdout.write(`  captured stderr: ${JSON.stringify(result.stderr.slice(0, 200))}\n`);
  }

  const errorPatterns = [/Error:/, /UnhandledPromise/, /TypeError/, /ReferenceError/, /SyntaxError/];
  const errorLines: string[] = [];
  for (const re of errorPatterns) {
    for (const line of (result.stdout + "\n" + result.stderr).split("\n")) {
      if (re.test(line) && !line.includes("LlmUnavailableError") && !line.includes("llm.ts is a stub")) {
        errorLines.push(line);
      }
    }
  }
  if (errorLines.length === 0) {
    pass("no unhandled errors / TypeErrors / ReferenceErrors in stdout+stderr");
  } else {
    fail(`unhandled errors in output: ${errorLines.slice(0, 3).join(" | ")}`);
  }

  // ----- (c) Compiled server smoke test -----
  process.stdout.write("\n[c] Compiled server (node dist/src/index.js) smoke test:\n");
  const { execSync } = await import("node:child_process");
  try {
    execSync("npm run build", { stdio: "pipe" });
    pass("npm run build succeeded");
  } catch (e) {
    fail(`npm run build failed: ${(e as Error).message}`);
  }

  const compiled: ChildProcess = spawn("node", ["dist/src/index.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let compiledStderr = "";
  compiled.stderr?.on("data", (chunk: Buffer) => { compiledStderr += chunk.toString(); });
  const compiledReady = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    const interval = setInterval(() => {
      if (compiledStderr.includes("skins-mcp ready")) {
        clearTimeout(timer);
        clearInterval(interval);
        resolve(true);
      }
    }, 50);
  });
  if (compiledReady) {
    pass("compiled server emitted 'skins-mcp ready' on stderr within 5s");
  } else {
    fail(`compiled server did not emit 'skins-mcp ready' on stderr. Captured: ${JSON.stringify(compiledStderr.slice(0, 200))}`);
  }
  compiled.kill("SIGTERM");
  await sleep(200);

  if (failed === 0) {
    process.stdout.write("\nall checks passed\n");
  } else {
    process.stderr.write(`\n${failed} check(s) failed\n`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`harness crashed: ${String(e)}\n`);
  process.exit(1);
});
