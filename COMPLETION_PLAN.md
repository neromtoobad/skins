# skins-mcp — Completion Plan (motionsites feature)

**Goal:** finish the in-progress `generate_from_motionsites` feature, merge it into the real
`neromtoobad/skins` repo *in place* (convert this loose `~/Downloads/skins` folder into the full
repo), get `tsc` + `verify` green, fix the doc/code mismatches, then commit & push.

## The situation (why these steps exist)

- The **GitHub repo** is the finished 3-tool base (`generate_from_vibe`, `generate_from_url`,
  `generate_from_image`) with the full `src/` tree, `claude.md` standards, a 16-AC plan, `demo.ts`,
  and `scripts/verify-output.mjs`. It has **no motionsites code**.
- This **`~/Downloads/skins` folder** is the **unmerged 4th feature** — 9 loose files that add the
  motionsites tool and a motionsites-aware vibe tool. They can't compile here because every base
  module they import (`../types`, `../generators/*`, `../vibes/presets`) lives only in the repo.

So "completing" = dropping these 9 files into the right `src/` paths inside the full repo, wiring
the demo/verify/docs, and shipping. Default scope below is **"ship what you built"** (bundled-local
library + honest docs). The **full-vision** extras (real runtime scraper, LLM, etc.) are in the
appendix.

### Where the 9 loose files go

| This folder (loose)              | Destination in repo                         | Action          |
| -------------------------------- | ------------------------------------------- | --------------- |
| `motionsites-data.ts`            | `src/scrapers/motionsites-data.ts`          | new             |
| `motionsites.ts`                 | `src/scrapers/motionsites.ts`               | new             |
| `motionsites-token-extractor.ts` | `src/scrapers/motionsites-token-extractor.ts` | new           |
| `from-motionsites.ts`            | `src/tools/from-motionsites.ts`             | new             |
| `from-vibe.ts`                   | `src/tools/from-vibe.ts`                    | **overwrites** base |
| `index.ts`                       | `src/index.ts`                              | **overwrites** base |
| `server.ts`                      | `src/server.ts`                             | new (HTTP/SSE)  |
| `README.md`                      | `README.md`                                 | **overwrites** base |
| `package.json`                   | (do **not** overwrite — edit repo's instead) | reconcile      |

Import paths already assume this layout, so once the files are in place they resolve cleanly.

---

## Phase 0 — Back up first

```bash
cp -R ~/Downloads/skins ~/Downloads/skins-backup
```

## Phase 1 — Stage the feature files aside

```bash
cd ~/Downloads/skins
mkdir -p .incoming
mv README.md package.json index.ts server.ts from-vibe.ts from-motionsites.ts \
   motionsites.ts motionsites-token-extractor.ts motionsites-data.ts .incoming/
ls -A          # should now show only: .incoming  COMPLETION_PLAN.md
```

## Phase 2 — Bring the full repo into this folder (in place)

```bash
cd ~/Downloads/skins
git init
git remote add origin https://github.com/neromtoobad/skins.git
git fetch origin
git branch -r                       # confirm the default branch name (assume origin/main below)
git checkout -t origin/main         # populates the working tree from the repo
git checkout -b feat/motionsites    # work on a feature branch
```

(The working tree only contains the untracked `.incoming/` + `COMPLETION_PLAN.md`, so the checkout
won't conflict. If the default branch is `master`, substitute it.)

## Phase 3 — Drop the feature files into place

```bash
cd ~/Downloads/skins
mkdir -p src/scrapers

mv .incoming/motionsites-data.ts            src/scrapers/motionsites-data.ts
mv .incoming/motionsites.ts                 src/scrapers/motionsites.ts
mv .incoming/motionsites-token-extractor.ts src/scrapers/motionsites-token-extractor.ts
mv .incoming/from-motionsites.ts            src/tools/from-motionsites.ts
mv .incoming/from-vibe.ts                   src/tools/from-vibe.ts     # overwrite base
mv .incoming/index.ts                       src/index.ts              # overwrite base
mv .incoming/server.ts                      src/server.ts             # new

mv .incoming/README.md                      README.md                 # overwrite base
rm .incoming/package.json                   # DON'T use this one — edit repo's in Phase 4
rmdir .incoming 2>/dev/null || true
```

## Phase 4 — Reconcile `package.json` (edit the repo's, don't replace it)

Start from the repo's `package.json` (already in place) and make only these edits — this avoids
importing the loose copy's problems (a stray `postinstall` git-submodule line; missing `keywords`):

1. `dependencies`: add `"express": "^5.1.0"`.
2. `devDependencies`: add `"@types/express": "^5.0.0"`.
3. `scripts`: add
   - `"serve": "ts-node src/server.ts"`
   - `"serve:prod": "node dist/src/server.js"`
4. Bump `"version"` to `"0.2.0"` (matches `src/server.ts`).
5. **Fix the pre-existing path bug:** change `"main"` and `"bin.skins-mcp"` from `"dist/index.js"`
   to `"dist/src/index.js"` — with `tsconfig` `rootDir: "./"`, `src/index.ts` builds to
   `dist/src/index.js`, not `dist/index.js`. (This is also what the README's Claude Desktop config
   already points at.)
6. Do **not** add a `postinstall` script.

```bash
npm install     # regenerates package-lock.json (now including express)
```

## Phase 5 — Fix the doc/code mismatches (the "honesty" pass)

These are real gaps between what the README/comments claim and what the code does. Fix the docs to
match the bundled-local reality (or, for #7, the code).

1. **README — runtime-scrape claim is false.** The code is 100% local. Replace every
   "scrapes this library at runtime" / "Fetches the motionsites.ai prompt library from GitHub
   (cached for one hour)" with bundled-local wording, e.g. *"bundles the motionsites.ai prompt
   library locally (61 specs shipped with the server — no network calls)."*
2. **README — "65+" is wrong.** The data file has **61** entries
   (`grep -c 'promptUrl:' src/scrapers/motionsites-data.ts`). Replace "65+" with "61".
3. **README — "Eight design presets ship" but there are nine** (the table already lists nine,
   incl. `terminal`). Change the count to **nine**.
4. **README — stack table says "express 4.x"** but you're on express 5. Update to 5.x and add a
   line that the HTTP server uses SSE.
5. **`src/index.ts` header comment** still says *"the three MCP tools …"* / *"Register all three
   tools"*. Update to four and add `generate_from_motionsites`. (The code already registers it.)
6. **`claude.md`** says "three MCP tools" and its directory-layout block omits `src/scrapers/`,
   `src/tools/from-motionsites.ts`, and `src/server.ts`. Update it — `claude.md` is the standards
   file agents read first, so keep it accurate. Note the SSE server is an intentional addition (the
   original plan listed HTTP/SSE as out-of-scope).
7. **README documents a `source` field on the vibe output that the code doesn't return.** The
   "Canonical output shape" and the vibe "How it works" step 5 promise a `source`, but
   `generateFromVibe` returns only the five keys. Either (a) drop the claim, or (b) add a `source`
   to the return (recommended — set it to the winning motionsites match name, or the preset name).
8. **`src/tools/from-motionsites.ts`** imports `findBestMatch` but never uses it — delete the
   unused import (cosmetic; `noUnusedLocals` is off so it won't fail the build).

## Phase 6 — Give the new tool demo + verify coverage

`scripts/verify-output.mjs` auto-discovers **any** subdir of `demo-output/` that has a
`components.json`, so the only work is adding a 4th demo mode — verification then comes for free.

Edit `demo.ts`:

1. Import the tool:
   ```ts
   import { generateFromMotionsites } from "./src/tools/from-motionsites";
   ```
2. Add `"motionsites"` to the `MODES` tuple:
   ```ts
   const MODES = ["vibe", "url", "image", "motionsites"] as const;
   ```
3. Add a runner (note the union narrowing — pass `"closest"`, then guard on
   `result.ok && result.mode !== "list"` so TS sees the `ToolOutput` fields):
   ```ts
   async function runMotionsitesMode(): Promise<ModeResult> {
     const modeDir = path.join(OUTPUT_ROOT, "motionsites");
     const QUERY = "dark saas hero";
     process.stdout.write(`[motionsites] generating from query: ${JSON.stringify(QUERY)}\n`);
     try {
       const result = await generateFromMotionsites(QUERY, "closest");
       if (result.ok && result.mode !== "list") {
         writeSuccessOutputs(modeDir, result);
         writeReadme(modeDir, "motionsites", {
           input: `${QUERY} → ${result.source.name} (${result.source.category})`,
           tokens: {
             primary: result.tokens.colors.primary,
             secondary: result.tokens.colors.secondary,
             accent: result.tokens.colors.accent,
             display: result.tokens.typography.fontFamily.display,
             body: result.tokens.typography.fontFamily.body,
             durationBase: result.tokens.motion.durationBase,
           },
           extra: { "Source design": result.source.name, "Prompt URL": result.source.promptUrl },
         });
         return { mode: "motionsites", ok: true };
       }
       const err = result.ok ? "list mode returned no design system" : result.error;
       writeFailureReadme(modeDir, "motionsites", QUERY, err);
       return { mode: "motionsites", ok: false, error: err };
     } catch (e) {
       const msg = (e as Error).message ?? String(e);
       writeFailureReadme(modeDir, "motionsites", QUERY, msg);
       return { mode: "motionsites", ok: false, error: msg };
     }
   }
   ```
4. In `main()`, add `results.push(await runMotionsitesMode());` after the image run, and update the
   "running all three modes" / "three modes" log strings to "four".

(`Mode` is derived from `MODES`, so `writeReadme`/`writeFailureReadme`/`verifyOutputs` accept the
new `"motionsites"` value automatically.)

## Phase 7 — Quality gate (must all pass before commit)

```bash
npx tsc --noEmit                              # type-checks src/** incl. server.ts + the demo edits
npm run demo                                  # writes demo-output/{vibe,url,image,motionsites}/
npm run verify                                # tsc + verify-output.mjs → "all checks passed"
open demo-output/motionsites/preview.html     # eyeball the new tool's output (no console errors)
npm run build                                 # confirm dist/ emits cleanly
# optional: smoke-test the HTTP server
npm run serve &                               # → "skins-mcp ready at http://localhost:3000/sse"
curl -s localhost:3000/health ; echo ; kill %1
```

Common snags:
- `tsc` errors about `express` types → Phase 4 deps weren't installed; re-run `npm install`.
- `tsc` error "property 'tokens' does not exist" in `demo.ts` → the union guard in Phase 6.3 is
  missing (`result.mode !== "list"`).

## Phase 8 — Commit & push (outward-facing — your call)

```bash
git add -A
git status      # expect: src/scrapers/*, src/tools/from-motionsites.ts, src/server.ts,
                #         modified src/index.ts, src/tools/from-vibe.ts, README.md, claude.md,
                #         package.json, package-lock.json, demo.ts
git commit -m "feat: add generate_from_motionsites tool, motionsites-aware vibe, and HTTP/SSE server"
git push -u origin feat/motionsites
# then open a PR on GitHub, or merge to main
```

Pushing needs your GitHub auth (`gh auth login`, or an HTTPS token / SSH key for `neromtoobad`).
`COMPLETION_PLAN.md` will be an untracked file — delete it or `git mv` it into `docs/` if you want
to keep it.

---

## Definition of done
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run demo` writes all 4 mode folders
- [ ] `npm run verify` prints "all checks passed"
- [ ] `demo-output/motionsites/preview.html` renders with no console errors
- [ ] README, `claude.md`, and `src/index.ts` comments describe **four** tools and a **bundled-local**
      (not runtime-scraped) library, with correct counts (61 designs, 9 presets)
- [ ] Pushed to `feat/motionsites` and a PR is open

---

## Appendix — if you instead want the full README vision

These are the extra builds that would make the bigger marketing claims literally true (bigger scope;
skip for "ship what you built"):

1. **Real runtime scraper + 1h cache.** Add `fetchPromptLibrary()` in `src/scrapers/motionsites.ts`
   that GETs the prompt index from GitHub raw, parses it, and caches in an in-memory map with a
   timestamp (1-hour TTL). Fall back to the bundled `MOTIONSITES_PROMPTS` on any network failure so
   the "runs fully offline" promise still holds. `searchPrompts` becomes async (or hydrate once at
   startup). Then the "scrapes at runtime / cached for one hour" README text is accurate as-is.
2. **motionsites-aware `from-url` / `from-image`.** After those tools extract colors/fonts, infer a
   category and run `searchPrompts`, merging a strong match over the extracted tokens — same pattern
   `from-vibe.ts` already uses. The README implies the whole system is motionsites-driven; this
   delivers it.
3. **Surface `source` everywhere + LLM fallback.** Return a `source` object from `from-vibe` (preset
   vs. motionsites winner) per #7 above, and confirm the `generateTokens` LLM path (already present
   in `src/generators/tokens.ts`, gated on `OPENAI_API_KEY`) is wired through the vibe tool when no
   preset/motionsites match scores well.
