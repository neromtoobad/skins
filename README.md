SKINS MCP

**Turn a vibe, a URL, an image, or a design name into a production-ready React + Tailwind + Framer Motion design system — in one tool call.**

Most developers ship great logic and mediocre UI. skins-mcp fixes that. It gives your AI assistant a direct line to real design intelligence: battle-tested color systems, motion specs extracted from 61 premium hero sections, and a five-output bundle (tokens, components, layout, preview, files) that drops straight into any React codebase.

No API key required. No design background required. One call and you have a design system.

> **Just want to use it?** It's already hosted — connect Claude Code in one line:
> ```bash
> claude mcp add --transport sse skins https://skins-mcp-production.up.railway.app/sse
> ```
> Full developer walkthrough (all clients, every tool, example calls, how to drop the output into your app): **[USING.md](USING.md)**.

---

## What it does

skins-mcp is a [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes four tools. Every tool returns the same canonical shape so downstream code never needs to special-case anything.

**`generate_from_vibe`** — describe what you want in plain English. "dark luxury crypto dashboard", "soft pastel fintech app", "brutalist web3 portfolio". The server matches your description against nine curated design presets and — if it finds a closer match — against 61 real production hero sections bundled from motionsites.ai. The best-matching design spec drives the output.

**`generate_from_url`** — pass any public URL. The server scrapes its dominant colors, font families, and layout density, then builds a design system that actually matches the site you pointed at.

**`generate_from_image`** — pass a base64 image. k-means color quantization extracts a five-color palette, maps each centroid to the closest Tailwind tier, and generates a design system from your image's visual identity.

**`generate_from_motionsites`** — pass a design name, category, or keyword. The server looks up the matching prompt in the bundled motionsites.ai library (61 production hero specs shipped with the server, covering SaaS, agency, portfolio, landing pages, Web3, fintech, biotech, and more), extracts its exact color values, spacing, motion timing, and typography, and generates a full design system from that spec. This is the tool that makes skins-mcp genuinely different.

---

## Why this matters

UI debt is real. Most developers spend weeks shipping features and one afternoon on design. The result is inconsistent spacing, mismatched colors, animations that feel wrong, and components that look like they came from five different projects.

skins-mcp gives you a shortcut that doesn't feel like a shortcut. The output is not a theme file or a color palette — it is five production-ready artifacts:

- **Design tokens** — a full `DesignTokens` bundle covering colors, typography, spacing, motion timing, shadows, and border radius. Every value is a real Tailwind v3.4+ utility class.
- **Five TSX components** — `Button`, `Card`, `Input`, `Navbar`, `StatCard` — all fully typed, animated with Framer Motion, and wired to the token system.
- **A full-page layout** — a `DemoPage` TSX that composes all five components into a real page you can open and edit.
- **A self-contained HTML preview** — open it in any browser with no build step. Shows exactly what the design system looks like rendered.
- **Copy-paste `.tsx` files** — each component as its own file, ready to drop into `src/components/`.

You call one tool. You get a design system you can actually ship.

---

## The motionsites.ai integration

The fourth tool is where skins-mcp becomes a research engine.

motionsites.ai is a premium library of production hero section prompts. Each prompt is a detailed specification: exact hex colors, font choices, animation curves, z-index layering, component structure, spacing values. These are not mood boards — they are engineering specs written to be implemented directly.

skins-mcp bundles this library locally — all 61 specs ship with the server, so there are no runtime network calls — and extracts real design intelligence from every prompt:

- Hex colors mapped to Tailwind tiers via Euclidean RGB distance
- Font families preserved as Google Font names
- Animation keywords (`pulse`, `glow`, `float`, `reveal`, `stagger`) mapped to motion profiles
- Layout density inferred from component count

When you call `generate_from_motionsites` with `"dark saas hero"`, you are not getting a generic dark theme. You are getting a design system derived from the same spec that produced a real, shipped, premium hero section.

The vibe tool also benefits. When your description matches a motionsites category — SaaS, agency, portfolio, fintech, Web3 — the server merges the extracted motionsites tokens over the base preset. So `"neon cyberpunk terminal"` does not just hit the local cyberpunk preset. It also checks whether any of the 61 production specs match, and if they score higher, those tokens win.

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/neromtoobad/skins.git
cd skins

# 2. Install
npm install

# 3. Build
npm run build

# 4. Run the demo (tests all four tools, writes demo-output/)
npm run demo

# 5. Open the previews
open demo-output/vibe/preview.html
open demo-output/url/preview.html
open demo-output/image/preview.html
open demo-output/motionsites/preview.html
```

To run as an HTTP server (gives you a shareable MCP URL):

```bash
npm run serve
# skins-mcp ready at http://localhost:3000/sse
```

---

## Connecting to Claude Desktop

**Option A — local stdio (no server needed):**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "skins-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/skins/dist/src/index.js"]
    }
  }
}
```

Fully quit and reopen Claude Desktop. The four tools appear under the hammer icon.

**Option B — hosted URL (no clone, no install):**

The server is live at `https://skins-mcp-production.up.railway.app/sse`. Claude Code connects to it directly:

```bash
claude mcp add --transport sse skins https://skins-mcp-production.up.railway.app/sse
```

Claude Desktop and Codex speak stdio, so bridge the URL with `mcp-remote`:

```json
{
  "mcpServers": {
    "skins-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://skins-mcp-production.up.railway.app/sse"]
    }
  }
}
```

See **[USING.md](USING.md)** for every client and tool example.

---

## The four tools

### `generate_from_vibe`

Match a free-form description against built-in presets and the motionsites.ai library.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vibe` | string | yes | Natural-language description. Example: `"dark luxury crypto dashboard"` |

**How it works:**

1. Scores the vibe against eight built-in presets using keyword matching.
2. Simultaneously scores against all 61 bundled motionsites prompts.
3. Whichever scores higher drives the token generation.
4. If the LLM path is configured and nothing scores well, generates a fresh token bundle via the model.
5. Returns the canonical five outputs plus a `source` field indicating which preset or motionsites design won.

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_vibe",
    "arguments": { "vibe": "dark luxury crypto dashboard" }
  }
}
```

---

### `generate_from_url`

Scrape a public web page and generate a design system from its visual identity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | Absolute URL of any public web page |

**How it works:**

1. Fetches the URL with a 10-second timeout.
2. Parses HTML with cheerio, extracts up to six dominant hex colors and font-family declarations.
3. Computes a layout density hint from element count.
4. Maps extracted colors to Tailwind tiers and generates the full design system.

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_url",
    "arguments": { "url": "https://stripe.com" }
  }
}
```

---

### `generate_from_image`

Quantize an image to a five-color palette and generate a design system from it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageBase64` | string | yes | Base64-encoded image (PNG, JPEG, WebP) |
| `mimeType` | string | no | Optional MIME type hint |

**How it works:**

1. Decodes the base64 buffer.
2. Sharp resizes to 64×64 raw RGB.
3. k-means++ (k=5) over 4096 pixels produces a population-sorted palette.
4. Each centroid maps to the closest Tailwind v3.4 tier via Euclidean RGB distance.
5. The top three palette colors override `primary`, `secondary`, `accent`.
6. Returns the canonical five outputs plus a `palette` field with hex values and tier names for debugging.

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_image",
    "arguments": {
      "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png"
    }
  }
}
```

---

### `generate_from_motionsites`

Browse or generate from 61 production hero section design specs (bundled locally).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Design name, category, or keyword. Example: `"dark saas"`, `"portfolio"`, `"Apex SaaS"` |
| `mode` | string | no | `"closest"` (default), `"list"`, or `"random"` |

**Modes:**

- `closest` — finds the best matching design and generates a full design system from its spec
- `list` — returns a JSON array of all matching designs with names, categories, and prompt URLs. Use this to browse before committing to a generation.
- `random` — picks a random match and generates. Good for exploration and inspiration.

**How it works:**

1. Reads the bundled motionsites.ai prompt library (61 specs shipped with the server — no network).
2. Scores all 61 prompts against the query by name, category, and keyword match.
3. Fetches the winning prompt's full specification.
4. Extracts hex colors, fonts, animation keywords, and layout hints from the spec.
5. Maps extracted values to Tailwind tiers and motion profiles.
6. Runs the standard token → components → layout → preview pipeline.
7. Returns the canonical five outputs plus a `source` object:

```json
{
  "source": {
    "name": "Apex SaaS",
    "category": "SaaS",
    "promptUrl": "https://github.com/aayushsoam/motionsites.ai/blob/main/prompts/Apex_SaaS.md"
  }
}
```

**Example calls:**

```json
{ "name": "generate_from_motionsites", "arguments": { "query": "dark saas hero" } }
{ "name": "generate_from_motionsites", "arguments": { "query": "portfolio", "mode": "list" } }
{ "name": "generate_from_motionsites", "arguments": { "query": "web3", "mode": "random" } }
```

---

## Canonical output shape

Every successful tool call returns the same JSON object regardless of which tool was called.

```typescript
interface ToolOutput {
  tokens: DesignTokens;
  components: Record<string, string>; // Button, Card, Input, Navbar, StatCard
  layout: string;                     // full-page DemoPage TSX
  preview: string;                    // self-contained HTML, open in any browser
  files: Record<string, string>;      // alias of components, one file per component
  source?: {                          // present on vibe and motionsites tools
    preset?: string;
    motionsites?: { name: string; category: string; promptUrl: string };
  };
}
```

The `DesignTokens` type covers every design decision your components need:

```typescript
interface DesignTokens {
  colors: {
    primary: string;    // e.g. "fuchsia-500"
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  typography: {
    fontFamily: { display: string; body: string; mono: string };
    fontSize: { xs: string; sm: string; base: string; lg: string; xl: string; "2xl": string; "3xl": string; "4xl": string };
    fontWeight: { normal: string; medium: string; semibold: string; bold: string };
  };
  spacing: { xs: string; sm: string; md: string; lg: string; xl: string; "2xl": string; "3xl": string };
  motion: {
    durationBase: number;
    durationFast: number;
    durationSlow: number;
    easeOut: string;
    easeIn: string;
    easeInOut: string;
    staggerChildren: number;
  };
  shadows: { none: string; sm: string; md: string; lg: string; xl: string; glow: string };
  radius: { none: string; sm: string; md: string; lg: string; xl: string; full: string };
}
```

Every color value is a real Tailwind v3.4+ `family-shade` string like `"emerald-400"` or `"slate-950"`. Every font is a real Google Font. Every motion value is a number or CSS easing string that Framer Motion understands directly.

---

## Built-in presets

Nine design presets ship with the server. No API key or network access needed.

| Preset | Keywords | Primary color | Display font | Motion |
|--------|----------|---------------|--------------|--------|
| `cyberpunk` | neon, magenta, terminal, matrix, synthwave | `fuchsia-500` | Orbitron | snappy |
| `brutalist` | brutal, stark, monospace, industrial, harsh | `neutral-900` | Archivo Black | snappy |
| `luxury` | elegant, premium, jewel, serif, rich, gold | `amber-600` | Playfair Display | slow |
| `pastel` | soft, cute, gentle, kawaii, candy, powder | `pink-300` | Quicksand | smooth |
| `monochrome` | minimal, grayscale, achromatic, graphite, noir | `neutral-900` | Inter | smooth |
| `retro` | vintage, 70s, 80s, sepia, warm, diner, faded | `orange-600` | DM Serif Display | smooth |
| `organic` | natural, earthy, botanical, forest, sage | `green-700` | Fraunces | slow |
| `glassmorphism` | glass, frosted, translucent, blur, aurora | `indigo-500` | Poppins | smooth |
| `terminal` | cli, console, hacker, phosphor, crt, ascii | `green-400` | JetBrains Mono | snappy |

When a vibe matches multiple presets, the highest-scoring one wins. The preset is always the fallback when the motionsites path finds no strong match and the LLM path is disabled.

---

## motionsites.ai design categories

The `generate_from_motionsites` tool and the enhanced `generate_from_vibe` draw from these categories:

| Category | Example designs |
|----------|----------------|
| SaaS / AI | Apex SaaS, Synapse Dark Hero, Finlytic AI Agent, Neuralyn, Mindloop, Digitwist AI Builder |
| Landing Pages | AI Designer Agency, Space Voyage, NOVA Space Systems, Orbis NFT, NeoVision |
| Hero Sections | AI Automation Hero, Bloom AI, Stellar AI, Power AI, Aethera Studio |
| Portfolio | Bold Portfolio Hero, Dark Portfolio Hero, Portfolio Cosmic, Viktor Portfolio |
| Agency | Buzzentic Agency, Framelix 3D Studios, Velorah, Orbit Engineers |
| Fintech | Nickel Payments, Wealth Video Hero, ClearInvoice SaaS Hero |
| Web3 / NFT | Orbis NFT, ClubX Investors |
| Security | AKOR Security, Nexus IT Solutions |
| Biotech | Bionova Biotech |
| Logistics | Targo Logistics Hero |

Search by category name, design name, or any keyword. The `list` mode lets you browse all matches before generating.

---

## Environment variables

All optional. The server runs fully offline without any of them.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | none | Enables LLM refinement for vibes with no strong preset or motionsites match |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override to point at any OpenAI-compatible endpoint (Ollama, LM Studio, Azure, Together) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name for LLM refinement |
| `PORT` | `3000` | Port for the HTTP/SSE server (`npm run serve`) |

---

## HTTP server

Run `npm run serve` to start the HTTP server. This gives you a URL other developers and tools can connect to without cloning the repo.

```
GET  /sse      — SSE endpoint for MCP connections
POST /messages — JSON-RPC message handler
GET  /health   — returns { ok: true, tools: [...] }
```

**Self-hosting on Railway:**

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Railway gives you a public URL — this project's live deployment is `https://skins-mcp-production.up.railway.app/sse`. Share that URL and any developer can connect in one line (see [USING.md](USING.md)).

---

## npm scripts

| Script | Command | What it does |
|--------|---------|-------------|
| `npm run start` | `ts-node src/index.ts` | Start the stdio MCP server |
| `npm run serve` | `ts-node src/server.ts` | Start the HTTP/SSE server |
| `npm run serve:prod` | `node dist/src/server.js` | Start the compiled HTTP server |
| `npm run demo` | `ts-node demo.ts` | Run all four tools end-to-end, write demo-output/ |
| `npm run build` | `tsc` | Type-check and emit dist/ |
| `npm run verify` | `tsc --noEmit && node scripts/verify-output.mjs` | Type-check + validate demo output shape |

---

## Architecture

```
src/
├── types.ts                      # DesignTokens, ToolOutput, Preset, etc.
├── llm.ts                        # OpenAI-compatible client + LlmUnavailableError
├── index.ts                      # stdio MCP server entry point
├── server.ts                     # HTTP/SSE server entry point
├── vibes/
│   └── presets.ts                # 8+ built-in design presets
├── scrapers/
│   ├── motionsites.ts            # fetches + caches the motionsites.ai prompt library
│   └── motionsites-token-extractor.ts  # parses prompts → Partial<DesignTokens>
├── generators/
│   ├── tokens.ts                 # vibe/colors/fontHints → DesignTokens
│   ├── components.ts             # DesignTokens → 5 TSX components
│   ├── layout.ts                 # DesignTokens → full-page TSX layout
│   └── preview.ts                # DesignTokens + layout → self-contained HTML
└── tools/
    ├── from-vibe.ts              # generate_from_vibe (now motionsites-aware)
    ├── from-url.ts               # generate_from_url
    ├── from-image.ts             # generate_from_image
    └── from-motionsites.ts       # generate_from_motionsites
```

**Data flow for every tool:**

```
input
  └─► extract signals (colors / vibe / prompt spec)
        └─► score against presets + motionsites library
              └─► generateTokens()
                    ├─► generateComponents()
                    ├─► generateLayout()
                    └─► generatePreview()
                          └─► ToolOutput (tokens + components + layout + preview + files)
```

`generateTokens` is the only step with branching logic. Every downstream generator is a pure function of the resolved tokens. Same tokens always produces the same output.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.4, strict mode |
| Runtime | Node.js ≥ 18 |
| MCP SDK | `@modelcontextprotocol/sdk` 1.x |
| HTTP server | `express` 5.x (SSE transport) |
| Schema validation | `zod` 3.x |
| HTML parsing | `cheerio` 1.x |
| Image processing | `sharp` 0.33.x |
| LLM client | `openai` 4.x (OpenAI-compatible) |
| Design library | motionsites.ai (61 production hero specs, bundled locally) |
| UI primitives (generated output) | React 18, Tailwind 3.4+, Framer Motion 11 |

---

## License

MIT
