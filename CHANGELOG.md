# Changelog

All notable changes to **skins-mcp**. Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
this project uses semantic-ish versioning. The live HTTP server reports its version at `/health`.

## 0.8.3
- **Optional server lock** (`SKINS_AUTH_TOKEN`): when set, `/sse` and `/messages` require a bearer/query token; `/health` stays open and reports `locked`. Off by default (backwards-compatible). Logic extracted to `src/auth.ts` and unit-tested.
- **Test suite + CI:** zero-dependency `node:test` suite (18 tests) covering the brief engine's guarantees, reference-library validity, DNA extraction, and the auth gate; GitHub Actions runs type-check → test → build on every push/PR. Removed the unused `jest.config.js`.
- Added a brief-engine **ADR** (`docs/plans/brief-engine.md`).

## 0.8.2
- **Killed the indigo AI-slop default.** Re-paletted the most-matched dark archetypes — `apex` → emerald/lime, `cosmic` → cyan/gold — so a generic "dark AI dashboard" no longer returns indigo/violet.
- Every brief now carries an explicit **anti-AI-slop colour rule** (forbids indigo/violet on near-black).
- **Motion is enforced:** every brief ends with a `Motion — REQUIRED` section containing paste-ready reveal / count-up / cursor-parallax JS + CSS (with `prefers-reduced-motion`).

## 0.8.1
- Every redesign brief opens with a hard **`⛔ REBUILD FROM SCRATCH`** order and includes a concrete `:root` **CSS token block** in the new palette — the strongest levers to stop reskins.

## 0.8.0
- Added bold, non-blue **music/audio archetypes** (`Static — Warm Analog`, `Pulse — Vibrant Stream`) so radio/streaming vibes stop matching generic dark-indigo blueprints.
- Strengthened the "transformation, not a reskin" directive.

## 0.7.0
- **Extraction pipeline:** `DeepReference` validator + `npm run add-reference` script + [docs/EXTRACTION_RECIPE.md](docs/EXTRACTION_RECIPE.md) — grow the reference library on rails. Added the e-commerce archetype.

## 0.6.0
- **Deep reference library** (`src/references/deep-references.ts`): curated full design blueprints (palette, type, motion, section-by-section, signature). `generate_brief` prefers a strong deep-reference match over the 61 thin motionsites summaries.

## 0.5.0
- **`generate_brief_from_url`** — extract any live site's **design DNA** (palette + roles, fonts via `@font-face`/Google Fonts, animation libraries, glass/gradient/3D features; fetches external stylesheets too) and return a brief in that site's design language. New `src/scrapers/site-dna.ts`.

## 0.3.1
- The brief engine now emits an **asset plan**: per-image generation prompts (Higgsfield-ready) + free-stock fallbacks, plus an image strategy.

## 0.3.0
- **`generate_brief`** — the "make it cook" tool. Returns a design brief + build directive (palette, motion, technique toolkit, anti-slop quality bar) for the calling model to build from, instead of canned components. New `src/generators/brief.ts`, `src/tools/from-brief.ts`.

## 0.2.0
- Merged the **motionsites.ai** feature: `generate_from_motionsites` tool, 61 bundled production hero specs (`src/scrapers/`), a motionsites-aware `generate_from_vibe`, and an optional **HTTP/SSE** transport (`src/server.ts`, `npm run serve`).
- Corrected docs to the bundled-local reality (the library is shipped with the server — no runtime scraping).

## 0.1.0
- Initial MCP server: `generate_from_vibe`, `generate_from_url`, `generate_from_image`; 9 presets; the deterministic token → components → layout → preview pipeline; canonical five-output shape; verify scripts and demo driver.
